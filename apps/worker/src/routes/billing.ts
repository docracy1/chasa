import { Hono } from "hono";
import { requireAccount, requirePaidAccount, type AuthEnv } from "../lib/auth";
import {
  findAccountIdByStripeCustomerId,
  getStripeCustomerId,
  priceIdForPlan,
  setAccountPlan,
  setStripeCustomerId,
  setStripeSubscriptionId,
} from "../lib/billing";
import { verifyAndExtract } from "../lib/billingProviders/stripe";
import { claimStripeEvent, parseStripeEventId } from "../lib/stripeEvents";
import { billingCheckoutSchema, parseJsonBody } from "../lib/schemas";
import { requestAppOrigin } from "../lib/appUrl";

const billing = new Hono<AuthEnv>();

type StripeErrorBody = {
  error?: {
    type?: string;
    code?: string;
    message?: string;
    param?: string;
  };
};

type StripePrice = {
  id?: string;
  type?: "one_time" | "recurring";
  active?: boolean;
  error?: { message?: string };
};

function stripeClientMessage(status: number, body: StripeErrorBody, fallback: string): string {
  const msg = body.error?.message?.trim();
  const code = body.error?.code;
  if (status === 401 || code === "api_key_expired" || /invalid api key/i.test(msg ?? "")) {
    return "Stripe API key is invalid or was rotated. Re-set STRIPE_SECRET_KEY on the Worker.";
  }
  if (code === "resource_missing" || /no such price/i.test(msg ?? "")) {
    return msg
      ? `Stripe price not found (${msg}). Check STRIPE_PRICE_* in wrangler.toml matches live mode.`
      : "Stripe price not found. Check STRIPE_PRICE_* IDs match your live Stripe account.";
  }
  if (/one_time.*subscription|subscription.*one_time|recurring price in `subscription`/i.test(msg ?? "")) {
    return "That Stripe price is one-time, but checkout was started in subscription mode.";
  }
  if (msg) return `Stripe: ${msg}`;
  return fallback;
}

async function fetchStripePrice(
  secretKey: string,
  priceId: string
): Promise<{ ok: true; price: StripePrice } | { ok: false; status: number; body: StripeErrorBody; raw: string }> {
  const res = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const raw = await res.text();
  let parsed: StripePrice & StripeErrorBody = {};
  try {
    parsed = JSON.parse(raw) as StripePrice & StripeErrorBody;
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    return { ok: false, status: res.status, body: parsed, raw };
  }
  return { ok: true, price: parsed };
}

billing.post("/checkout", requireAccount, async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) {
    return c.json({ error: "Billing isn't set up on this deployment yet." }, 501);
  }

  const parsed = await parseJsonBody(c.req, billingCheckoutSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const plan = parsed.data.plan;

  const priceId = priceIdForPlan(c.env, plan);
  if (!priceId) {
    return c.json({ error: `That plan isn't configured yet (${plan}).` }, 501);
  }

  if (!c.env.PUBLIC_APP_URL) {
    return c.json({ error: "PUBLIC_APP_URL is not configured on the Worker." }, 501);
  }

  const priceLookup = await fetchStripePrice(c.env.STRIPE_SECRET_KEY, priceId);
  if (!priceLookup.ok) {
    console.error(`Stripe price lookup failed (${priceLookup.status}) price=${priceId}: ${priceLookup.raw}`);
    return c.json(
      {
        error: stripeClientMessage(
          priceLookup.status,
          priceLookup.body,
          "Could not load that Stripe price. Please try again."
        ),
        plan,
        priceId,
      },
      502
    );
  }

  // Solo/Pro are recurring subscriptions; Enterprise is a one-time price ($500) → payment mode.
  const mode = priceLookup.price.type === "recurring" ? "subscription" : "payment";

  const account = c.get("account")!;

  const params = new URLSearchParams({
    mode,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: `${requestAppOrigin(c)}/app/account?checkout=success`,
    cancel_url: `${requestAppOrigin(c)}/app/account?checkout=cancelled`,
    client_reference_id: account.id,
    "metadata[plan]": plan,
  });

  if (mode === "subscription") {
    params.set("subscription_data[metadata][plan]", plan);
  }

  // Prefer existing Stripe customer so upgrades don't fail when email already has a customer.
  const existingCustomerId = await getStripeCustomerId(c.env, account.id);
  if (existingCustomerId) {
    params.set("customer", existingCustomerId);
  } else {
    params.set("customer_email", account.email);
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const raw = await res.text();
    let parsed: StripeErrorBody = {};
    try {
      parsed = JSON.parse(raw) as StripeErrorBody;
    } catch {
      /* ignore */
    }
    console.error(
      `Stripe checkout session creation failed (${res.status}) plan=${plan} price=${priceId} mode=${mode} app=${c.env.PUBLIC_APP_URL}: ${raw}`
    );
    return c.json(
      {
        error: stripeClientMessage(res.status, parsed, "Could not start checkout. Please try again."),
        plan,
        priceId,
        mode,
      },
      502
    );
  }

  const session = (await res.json()) as { url: string | null };
  if (!session.url) {
    return c.json({ error: "Stripe returned a checkout session without a URL." }, 502);
  }
  return c.json({ url: session.url });
});

// Not behind requireAccount/cookies — Stripe calls this server-to-server with no cookies or
// Origin header. The signature check below is the actual authentication.
billing.post("/webhook", async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header("Stripe-Signature") ?? null;
  const result = await verifyAndExtract(rawBody, signature, c.env);
  const eventId = parseStripeEventId(rawBody);

  if (result && eventId) {
    const isNew = await claimStripeEvent(c.env, eventId);
    if (!isNew) return c.json({ ok: true, duplicate: true });
  }

  if (result?.type === "checkout_completed") {
    await setAccountPlan(c.env, result.accountId, result.plan);
    if (result.customerId) await setStripeCustomerId(c.env, result.accountId, result.customerId);
    if (result.subscriptionId) await setStripeSubscriptionId(c.env, result.accountId, result.subscriptionId);
  } else if (result?.type === "subscription_deleted") {
    const accountId = await findAccountIdByStripeCustomerId(c.env, result.customerId);
    if (accountId) {
      await setAccountPlan(c.env, accountId, "free");
      await setStripeSubscriptionId(c.env, accountId, null);
    }
  }

  // Always 200: Stripe retries (and eventually disables the endpoint) on non-2xx responses, and
  // "signature didn't verify" / "not an event type we act on" aren't retry-worthy conditions.
  return c.json({ ok: true });
});

// Redirects a paid account to Stripe's hosted Customer Portal to cancel or manage billing — no
// bespoke cancel-subscription UI to build or keep in sync with Stripe's proration/dunning rules.
billing.post("/portal", requirePaidAccount, async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) {
    return c.json({ error: "Billing isn't set up on this deployment yet." }, 501);
  }
  const account = c.get("account")!;
  const customerId = await getStripeCustomerId(c.env, account.id);
  if (!customerId) {
    return c.json({ error: "No billing account on file yet." }, 404);
  }

  const params = new URLSearchParams({
    customer: customerId,
    return_url: `${requestAppOrigin(c)}/app/account`,
  });

  const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const raw = await res.text();
    let parsed: StripeErrorBody = {};
    try {
      parsed = JSON.parse(raw) as StripeErrorBody;
    } catch {
      /* ignore */
    }
    console.error(`Stripe portal session creation failed (${res.status}): ${raw}`);
    return c.json(
      {
        error: stripeClientMessage(res.status, parsed, "Could not open the billing portal. Please try again."),
      },
      502
    );
  }

  const session = (await res.json()) as { url: string | null };
  if (!session.url) {
    return c.json({ error: "Stripe returned a portal session without a URL." }, 502);
  }
  return c.json({ url: session.url });
});

/** Signed-in diagnostic — confirms price IDs resolve in the Stripe account behind STRIPE_SECRET_KEY. */
billing.get("/status", requireAccount, async (c) => {
  const key = c.env.STRIPE_SECRET_KEY;
  if (!key) {
    return c.json({ ok: false, error: "STRIPE_SECRET_KEY missing" }, 501);
  }

  const plans = ["solo", "pro", "enterprise"] as const;
  const prices: Record<string, unknown> = {};
  for (const plan of plans) {
    const priceId = priceIdForPlan(c.env, plan);
    if (!priceId) {
      prices[plan] = { configured: false };
      continue;
    }
    const res = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const data = (await res.json()) as {
      id?: string;
      active?: boolean;
      type?: string;
      unit_amount?: number;
      currency?: string;
      recurring?: { interval?: string } | null;
      error?: { message?: string; type?: string };
    };
    prices[plan] = {
      configured: true,
      priceId,
      httpStatus: res.status,
      active: data.active ?? null,
      type: data.type ?? null,
      unitAmount: data.unit_amount ?? null,
      currency: data.currency ?? null,
      interval: data.recurring?.interval ?? null,
      checkoutMode: data.type === "recurring" ? "subscription" : "payment",
      error: data.error?.message ?? null,
    };
  }

  return c.json({
    ok: true,
    publicAppUrl: c.env.PUBLIC_APP_URL,
    prices,
  });
});

export default billing;
