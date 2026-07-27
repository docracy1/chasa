import type { Plan } from "./billing";

export function normalizePlan(raw: string | null | undefined, isPaid: boolean): Plan {
  if (raw === "solo" || raw === "pro" || raw === "enterprise" || raw === "free") return raw;
  return isPaid ? "solo" : "free";
}
