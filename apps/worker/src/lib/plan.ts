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
 * Free: 5 × 90-day DV (ZeroSSL-style free wedge). Pro: multi-SAN. Business: wildcards + volume.
 */
export function sslDomainLimit(plan: Plan): number {
  if (plan === "business") return 25;
  if (plan === "pro") return 10;
  return 5;
}

/** Multi-SAN (several hostnames on one cert) — Pro and Business. */
export function sslAllowsMultiSan(plan: Plan): boolean {
  return plan === "pro" || plan === "business";
}

/** Wildcard certificates (*.example.com) — Business only (ZeroSSL Premium ~$69/mo wedge). */
export function sslAllowsWildcard(plan: Plan): boolean {
  return plan === "business";
}

/** Max identifiers per certificate order. */
export function sslMaxSansPerCert(plan: Plan): number {
  if (plan === "business") return 100;
  if (plan === "pro") return 10;
  return 1;
}

/**
 * Developer / external ACME-style API positioning — paid plans only.
 * Free still uses our managed ACME client in the product UI for its 5 certs.
 */
export function sslAllowsAcmeApi(plan: Plan): boolean {
  return plan === "pro" || plan === "business";
}
