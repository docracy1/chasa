/** Trim and cap user-controlled strings before DB or AI prompts. */
export function clampString(value: unknown, maxLen: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

export function clampOptionalString(value: unknown, maxLen: number): string | undefined {
  const s = clampString(value, maxLen);
  return s || undefined;
}

export function clampNumber(value: unknown, min: number, max: number): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

/** Strip control chars that could break prompt structure. */
export function sanitizeForPrompt(text: string): string {
  return text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "").trim();
}

export function wrapUserContent(label: string, content: string): string {
  return `[${label}]\n${sanitizeForPrompt(content)}\n[/${label}]`;
}

/** Reject private/link-local IP hostnames for outbound webhook URLs. */
export function isBlockedWebhookHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1") return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (/^10\./.test(host) || /^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (host === "169.254.169.254" || host.startsWith("metadata.")) return true;
  return false;
}
