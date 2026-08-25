import type { Plan } from "./billing";

// Accepts the retired "solo"/"enterprise" identifiers too, in case any row somehow still carries
// one (the 0034 migration rewrites existing rows, but this keeps reads safe regardless).
export function normalizePlan(raw: string | null | undefined, isPaid: boolean): Plan {
  if (raw === "solo") return "pro";
  if (raw === "enterprise") return "business";
  if (raw === "pro" || raw === "business" || raw === "free") return raw;
  return isPaid ? "pro" : "free";
}
