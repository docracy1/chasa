/** US-first formatting for dates shown in the app. */
export const US_LOCALE = "en-US";

export function formatUsDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString(US_LOCALE, { month: "short", day: "numeric", year: "numeric" });
}

export function formatUsDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString(US_LOCALE, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatUsWeekday(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString(US_LOCALE, { weekday: "short", month: "short", day: "numeric" });
}
