import type { Env } from "../types";

/**
 * Set by the Pages `/api` proxy to the origin the browser is actually on. Anyone can send this
 * header straight to api.chasa.io, so it is only honoured when it passes `isAllowedAppOrigin`.
 */
export const APP_ORIGIN_HEADER = "x-chasa-app-origin";

/**
 * Trusted regardless of `PUBLIC_APP_URL`, so the domain cutover works in both directions: pages.dev
 * keeps working after the var flips to chasa.io, and chasa.io works before it flips.
 */
const PRODUCTION_ORIGINS = ["https://chasa.io", "https://www.chasa.io"];
/** Project domain plus branch/commit preview subdomains, e.g. `abc123.chasa-71s.pages.dev`. */
const PAGES_ORIGIN = /^https:\/\/([a-z0-9-]+\.)?chasa(-[a-z0-9-]+)?\.pages\.dev$/;
const LOCALHOST_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

/** Normalises to a bare origin (lowercased host, no path or trailing slash); "" when unparseable. */
function toOrigin(value: string): string {
  try {
    return new URL(value.trim()).origin;
  } catch {
    return "";
  }
}

export function configuredAppOrigin(env: Env): string {
  return toOrigin(env.PUBLIC_APP_URL || "");
}

export function isAllowedAppOrigin(value: string, env: Env): boolean {
  const origin = toOrigin(value);
  if (!origin) return false;
  if (origin === configuredAppOrigin(env)) return true;
  if (PRODUCTION_ORIGINS.includes(origin)) return true;
  return PAGES_ORIGIN.test(origin) || LOCALHOST_ORIGIN.test(origin);
}

/** Structural subset of Hono's Context, so this stays usable from any route without a type cycle. */
type OriginRequest = { req: { header: (name: string) => string | undefined }; env: Env };

/**
 * The origin to build user-facing links from: magic links, post-login redirects, Stripe returns
 * and team invites. Preferring the caller's own origin over `PUBLIC_APP_URL` keeps preview deploys
 * self-contained and makes a custom-domain cutover safe — a user who starts on pages.dev is sent
 * back to pages.dev even after the var flips to chasa.io.
 *
 * Requests without a trusted origin (provider OAuth callbacks, cron) fall back to `PUBLIC_APP_URL`.
 */
export function requestAppOrigin(c: OriginRequest): string {
  const candidates = [c.req.header(APP_ORIGIN_HEADER), c.req.header("Origin")];
  for (const candidate of candidates) {
    if (candidate && isAllowedAppOrigin(candidate, c.env)) return toOrigin(candidate);
  }
  return configuredAppOrigin(c.env);
}
