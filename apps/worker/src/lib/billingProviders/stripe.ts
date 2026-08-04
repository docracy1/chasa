import { hmacKey } from "../token";
import type { Env } from "../../types";
import { parseCheckoutPlan, planFromPriceId, type Plan } from "../billing";

export type StripeWebhookResult =
  | {
      type: "checkout_completed";
      accountId: string;
      plan: Plan;
      customerId: string | null;
      subscriptionId: string | null;
    }
  | { type: "subscription_deleted"; customerId: string }
  | { type: "subscription_updated"; customerId: string; status: string; plan: Plan | null }
  | { type: "payment_failed"; customerId: string };

const REPLAY_TOLERANCE_SECONDS = 300; // matches Stripe's own default tolerance

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// Stripe's Stripe-Signature header looks like "t=1614556800,v1=<hex>,v1=<hex-for-rotated-secret>".
function parseSignatureHeader(header: string): { timestamp: string; signatures: string[] } | null {
  const parts = new Map<string, string[]>();
  for (const entry of header.split(",")) {
    const [key, value] = entry.split("=");
    if (!key || !value) continue;
    parts.set(key, [...(parts.get(key) ?? []), value]);
  }
  const timestamp = parts.get("t")?.[0];
  const signatures = parts.get("v1");
  if (!timestamp || !signatures?.length) return null;
  return { timestamp, signatures };
}

/**
 * Verifies a Stripe webhook's signature (HMAC-SHA256 over "{timestamp}.{rawBody}") and extracts
 * the event. Returns null for: no webhook secret configured, a missing/malformed/invalid
 * signature, a stale (replayed) event, or an event type we don't act on — the webhook route
 * itself always responds 200 regardless, since Stripe only needs to know we received it.
 *
 * Four event types are handled: "checkout.session.completed" unlocks the paid tier and records the
 * Stripe customer/subscription id; "customer.subscription.deleted" is the one signal that a
 * subscription actually ended (cancellation, or Stripe giving up after failed-payment retries),
 * so it's what revokes paid status; "customer.subscription.updated" catches everything short of
 * that — a plan change made through Stripe's own customer portal, or the status moving through
 * past_due/unpaid on a failed renewal — so the account's plan and billing_status stay in sync
 * without waiting for the subscription to be deleted outright; "invoice.payment_failed" is a
 * heads-up notification only (no plan change), since Stripe's retry schedule is what actually
 * decides whether the subscription survives. All four resolve back to an account via billing.ts's
 * findAccountIdByStripeCustomerId, since none of these payloads carry a client_reference_id.
 */
export async function verifyAndExtract(
  rawBody: string,
  signatureHeader: string | null,
  env: Env
): Promise<StripeWebhookResult | null> {
  if (!env.STRIPE_WEBHOOK_SECRET || !signatureHeader) return null;

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return null;

  const eventAgeSeconds = Math.abs(Date.now() / 1000 - Number(parsed.timestamp));
  if (eventAgeSeconds > REPLAY_TOLERANCE_SECONDS) return null;

  const key = await hmacKey(env.STRIPE_WEBHOOK_SECRET);
  const signedPayload = new TextEncoder().encode(`${parsed.timestamp}.${rawBody}`);
  const anyValid = await Promise.all(
    parsed.signatures.map((sig) =>
      crypto.subtle.verify("HMAC", key, hexToBytes(sig), signedPayload).catch(() => false)
    )
  );
  if (!anyValid.some(Boolean)) return null;

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return null;
  }

  if (event.type === "checkout.session.completed") {
    const obj = event.data?.object;
    const accountId = obj?.client_reference_id;
    if (typeof accountId !== "string" || !accountId) return null;
    const customer = obj?.customer;
    const subscription = obj?.subscription;
    const metadata = obj?.metadata as { plan?: unknown } | undefined;
    // Prefer session metadata (set at Checkout Session create). Fall back to line-item price id
    // when Stripe expands line_items, then legacy obj.price, then Solo.
    const lineItems = (obj?.line_items as { data?: Array<{ price?: string | { id?: string } }> } | undefined)
      ?.data;
    const firstPrice = lineItems?.[0]?.price;
    const lineItemPriceId =
      typeof firstPrice === "string" ? firstPrice : typeof firstPrice?.id === "string" ? firstPrice.id : null;
    const plan =
      parseCheckoutPlan(metadata?.plan) ??
      planFromPriceId(env, lineItemPriceId) ??
      planFromPriceId(env, typeof obj?.price === "string" ? obj.price : null) ??
      "solo";
    return {
      type: "checkout_completed",
      accountId,
      plan,
      customerId: typeof customer === "string" ? customer : null,
      subscriptionId: typeof subscription === "string" ? subscription : null,
    };
  }

  if (event.type === "customer.subscription.deleted") {
    const customerId = event.data?.object?.customer;
    if (typeof customerId !== "string" || !customerId) return null;
    return { type: "subscription_deleted", customerId };
  }

  if (event.type === "customer.subscription.updated") {
    const obj = event.data?.object;
    const customerId = obj?.customer;
    const status = obj?.status;
    if (typeof customerId !== "string" || !customerId || typeof status !== "string") return null;

    const items = (obj?.items as { data?: Array<{ price?: { id?: string } }> } | undefined)?.data;
    const priceId = items?.[0]?.price?.id;
    const plan = planFromPriceId(env, typeof priceId === "string" ? priceId : null);

    return { type: "subscription_updated", customerId, status, plan };
  }

  if (event.type === "invoice.payment_failed") {
    const customerId = event.data?.object?.customer;
    if (typeof customerId !== "string" || !customerId) return null;
    return { type: "payment_failed", customerId };
  }

  return null;
}
