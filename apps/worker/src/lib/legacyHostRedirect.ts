/** Permanent redirects for legacy API hostnames (chasa.io cutover). */
const LEGACY_API_HOSTS = new Set(["api.chasa.io"]);

export function legacyApiRedirectUrl(requestUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  if (!LEGACY_API_HOSTS.has(url.hostname)) return null;
  url.hostname = "api.docstoc.io";
  return url.toString();
}
