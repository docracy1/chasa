/** Many browsers/OSes silently ignore mailto: links longer than ~2k chars. */
const MAILTO_HREF_LIMIT = 2000;

export function buildMailtoHref(input: { to?: string; subject?: string; body?: string }): string {
  const to = input.to?.trim();
  const base = to ? `mailto:${to}` : "mailto:";
  const params: string[] = [];
  if (input.subject) params.push(`subject=${encodeURIComponent(input.subject)}`);
  if (input.body) params.push(`body=${encodeURIComponent(input.body)}`);
  return params.length ? `${base}?${params.join("&")}` : base;
}

export function openMailtoClient(input: {
  to?: string;
  subject?: string;
  body?: string;
}): { copiedBody: boolean } {
  let copiedBody = false;
  let href = buildMailtoHref(input);

  if (href.length > MAILTO_HREF_LIMIT && input.body) {
    void navigator.clipboard.writeText(input.body).catch(() => {});
    copiedBody = true;
    href = buildMailtoHref({ to: input.to, subject: input.subject });
  }

  if (href.length > MAILTO_HREF_LIMIT) {
    href = buildMailtoHref({ to: input.to });
  }

  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  return { copiedBody };
}
