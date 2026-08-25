import type { Plan } from "./billing";

// Accepts the retired "solo"/"enterprise" identifiers too, in case any row somehow still carries
// one (the 0034 migration rewrites existing rows, but this keeps reads safe regardless).
export function normalizePlan(raw: string | null | undefined, isPaid: boolean): Plan {
  if (raw === "solo") return "pro";
  if (raw === "enterprise") return "business";
  if (raw === "pro" || raw === "business" || raw === "free") return raw;
  return isPaid ? "pro" : "free";
}

/** Custom-domain SSL caps — Pro competes with ZeroSSL Basic (1 domain); Business is multi-domain. */
export function sslDomainLimit(plan: Plan): number {
  if (plan === "business") return 25;
  if (plan === "pro") return 1;
  return 0;
}
