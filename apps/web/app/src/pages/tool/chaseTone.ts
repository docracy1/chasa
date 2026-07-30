/** Tone helpers — pass a t() function so labels resolve in the active locale. */

export function toneClass(days: number): "sage" | "amber" | "rust" {
  if (days <= 7) return "sage";
  if (days <= 30) return "amber";
  return "rust";
}

export function toneLabel(days: number, t: (key: string) => string): string {
  if (days <= 7) return t("tone.friendly");
  if (days <= 30) return t("tone.professional");
  return t("tone.direct");
}

export function chaseTip(days: number, t: (key: string) => string): string {
  if (days === 0) return t("tone.tip0");
  if (days <= 3) return t("tone.tip3");
  if (days <= 7) return t("tone.tip7");
  if (days <= 14) return t("tone.tip14");
  if (days <= 30) return t("tone.tip30");
  return t("tone.tipLate");
}
