import type { Env } from "../types";

export type Plan = "free" | "solo" | "pro" | "enterprise";

export function isPaidPlan(plan: Plan): boolean {
  return plan !== "free";
}

/** Team seat caps (owner counts as 1). Solo+ can invite; Free has no team. */
export function seatLimitForPlan(plan: Plan): number {
  switch (plan) {
    case "solo":
      return 3;
    case "pro":
      return 5;
    case "enterprise":
      return 25;
    default:
      return 1;
  }
}

export function planFromPriceId(env: Env, priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  if (priceId === env.STRIPE_PRICE_SOLO) return "solo";
  if (priceId === env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === env.STRIPE_PRICE_ENTERPRISE) return "enterprise";
  return null;
}

export function priceIdForPlan(env: Env, plan: Plan): string | null {
  if (plan === "solo") return env.STRIPE_PRICE_SOLO ?? null;
  if (plan === "pro") return env.STRIPE_PRICE_PRO ?? null;
  if (plan === "enterprise") return env.STRIPE_PRICE_ENTERPRISE ?? null;
  return null;
}

export function parseCheckoutPlan(raw: unknown): Plan | null {
  if (raw === "solo" || raw === "pro" || raw === "enterprise") return raw;
  return null;
}

export async function setAccountPlan(env: Env, accountId: string, plan: Plan): Promise<void> {
  const paid = isPaidPlan(plan);
  await env.CHASA_DB.prepare(`UPDATE accounts SET plan = ?, is_paid = ?, paid_at = ? WHERE id = ?`)
    .bind(plan, paid ? 1 : 0, paid ? new Date().toISOString() : null, accountId)
    .run();
}

/** @deprecated Prefer setAccountPlan — kept for call sites that only flip paid/free. */
export async function markAccountPaid(env: Env, accountId: string, paid: boolean): Promise<void> {
  await setAccountPlan(env, accountId, paid ? "solo" : "free");
}

// Set-once: a customer shouldn't get reassigned to a different Stripe customer id later.
export async function setStripeCustomerId(env: Env, accountId: string, customerId: string): Promise<void> {
  await env.CHASA_DB.prepare(
    `UPDATE accounts SET stripe_customer_id = ? WHERE id = ? AND stripe_customer_id IS NULL`
  )
    .bind(customerId, accountId)
    .run();
}

export async function setStripeSubscriptionId(env: Env, accountId: string, subscriptionId: string | null): Promise<void> {
  await env.CHASA_DB.prepare(`UPDATE accounts SET stripe_subscription_id = ? WHERE id = ?`)
    .bind(subscriptionId, accountId)
    .run();
}

export async function findAccountIdByStripeCustomerId(env: Env, customerId: string): Promise<string | null> {
  const row = await env.CHASA_DB.prepare(`SELECT id FROM accounts WHERE stripe_customer_id = ?`)
    .bind(customerId)
    .first<{ id: string }>();
  return row?.id ?? null;
}

export async function getStripeCustomerId(env: Env, accountId: string): Promise<string | null> {
  const row = await env.CHASA_DB.prepare(`SELECT stripe_customer_id FROM accounts WHERE id = ?`)
    .bind(accountId)
    .first<{ stripe_customer_id: string | null }>();
  return row?.stripe_customer_id ?? null;
}
