import { Hono } from "hono";
import { requireAccount, requirePaidAccount, type AuthEnv } from "../lib/auth";
import {
  findAccountIdByStripeCustomerId,
  getStripeCustomerId,
  parseCheckoutPlan,
  priceIdForPlan,
  setAccountPlan,
  setStripeCustomerId,
  setStripeSubscriptionId,
} from "../lib/billing";
import { verifyAndExtract } from "../lib/billingProviders/stripe";

const billing = new Hono<AuthEnv>();

billing.post("/checkout", requireAccount, async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) {
    return c.json({ error: "Billing isn't set up on this deployment yet." }, 501);
  }

  const body = (await c.req.json().catch(() => ({}))) as { plan?: unknown };
  const plan = parseCheckoutPlan(body.plan);
  if (!plan) {
    return c.json({ error: "Choose a plan: solo, pro, or enterprise." }, 400);
  }

  const priceId = priceIdForPlan(c.env, plan);
  if (!priceId) {
    return c.json({ error: "That plan isn't configured yet." }, 501);
  }

  const account = c.get("account")!;

  const params = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: `${c.env.PUBLIC_APP_URL}/app/account?checkout=success`,
    cancel_url: `${c.env.PUBLIC_APP_URL}/app/account?checkout=cancelled`,
    client_reference_id: account.id,
    customer_email: account.email,
    "metadata[plan]": plan,
    "subscription_data[metadata][plan]": plan,
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    console.error(`Stripe checkout session creation failed (${res.status}): ${await res.text()}`);
    return c.json({ error: "Could not start checkout. Please try again." }, 502);
  }

  const session = (await res.json()) as { url: string | null };
  if (!session.url) {
    return c.json({ error: "Could not start checkout. Please try again." }, 502);
  }
  return c.json({ url: session.url });
});

// Not behind requireAccount/cookies — Stripe calls this server-to-server with no cookies or
// Origin header. The signature check below is the actual authentication.
billing.post("/webhook", async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header("Stripe-Signature") ?? null;
  const result = await verifyAndExtract(rawBody, signature, c.env);

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
    return_url: `${c.env.PUBLIC_APP_URL}/app/account`,
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
    console.error(`Stripe portal session creation failed (${res.status}): ${await res.text()}`);
    return c.json({ error: "Could not open the billing portal. Please try again." }, 502);
  }

  const session = (await res.json()) as { url: string | null };
  if (!session.url) {
    return c.json({ error: "Could not open the billing portal. Please try again." }, 502);
  }
  return c.json({ url: session.url });
});

export default billing;
