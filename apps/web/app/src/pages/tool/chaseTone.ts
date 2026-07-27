export function toneClass(days: number): "sage" | "amber" | "rust" {
  if (days <= 7) return "sage";
  if (days <= 30) return "amber";
  return "rust";
}

export function toneLabel(days: number): string {
  if (days <= 7) return "Friendly";
  if (days <= 30) return "Professional";
  return "Direct";
}

export function chaseTip(days: number): string {
  if (days === 0) return "Due today — a short friendly nudge with a pay link works best.";
  if (days <= 3) return "1–3 days late — assume an oversight; ask for a payment date, no blame.";
  if (days <= 7) return "About a week late — firm but respectful; confirm they received the invoice.";
  if (days <= 14) return "Two weeks late — offer a short payment plan if cash flow is the issue.";
  if (days <= 30) return "Approaching a month — formal tone; set a clear new deadline.";
  return "30+ days — direct consequence (pause work / next steps). Still factual, not angry.";
}
