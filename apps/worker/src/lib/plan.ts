import type { Plan } from "./billing";

// Accepts the retired "solo"/"enterprise" identifiers too, in case any row somehow still carries
// one (the 0034 migration rewrites existing rows, but this keeps reads safe regardless).
export function normalizePlan(raw: string | null | undefined, isPaid: boolean): Plan {
  if (raw === "solo") return "pro";
  if (raw === "enterprise") return "business";
  if (raw === "pro" || raw === "business" || raw === "free") return raw;
  return isPaid ? "pro" : "free";
}

/**
 * Certificate slot caps (each row = one LE cert, which may cover multiple names on Pro/Business).
 * All plans: 5 × 90-day DV slots.
 * Pro adds multi-SAN + ACME API. Business adds those plus 1 wildcard cert (within the 5).
 */
export function sslDomainLimit(_plan: Plan): number {
  return 5;
}

/** Multi-SAN (several hostnames on one cert) — Pro and Business. */
export function sslAllowsMultiSan(plan: Plan): boolean {
  return plan === "pro" || plan === "business";
}

/** Wildcard certificates (*.example.com) — Business only. */
export function sslAllowsWildcard(plan: Plan): boolean {
  return plan === "business";
}

/** How many wildcard certificates a plan may hold at once (among the 5 slots). */
export function sslWildcardLimit(plan: Plan): number {
  return plan === "business" ? 1 : 0;
}

/** Max identifiers per certificate order. */
export function sslMaxSansPerCert(plan: Plan): number {
  if (plan === "business") return 100;
  if (plan === "pro") return 10;
  return 1;
}

/**
 * Developer / external ACME-style API — Pro and Business.
 * Free still uses our managed ACME client in the product UI for its 5 certs.
 */
export function sslAllowsAcmeApi(plan: Plan): boolean {
  return plan === "pro" || plan === "business";
}
