const FREE_LIMIT = 5;

function monthKey(): string {
  const now = new Date();
  return `docstoc_usage_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function getUsedCount(): number {
  const raw = localStorage.getItem(monthKey());
  return raw ? Number(raw) || 0 : 0;
}

export function incrementUsedCount(): number {
  const next = getUsedCount() + 1;
  localStorage.setItem(monthKey(), String(next));
  return next;
}

export function remaining(): number {
  return Math.max(0, FREE_LIMIT - getUsedCount());
}

export function isAtLimit(): boolean {
  return getUsedCount() >= FREE_LIMIT;
}

export { FREE_LIMIT };
