import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { AuthEnv } from "../lib/auth";
import {
  consumeMagicLink,
  requestMagicLink,
  destroySession,
  setSessionCookie,
  clearSessionCookie,
  SESSION_COOKIE_NAME,
} from "../lib/auth";
import { trackEvent } from "../lib/analytics";
import { clientIp, turnstileSiteKey, verifyTurnstile } from "../lib/turnstile";
import { magicLinkRequestSchema, parseJsonBody } from "../lib/schemas";
import { requestAppOrigin } from "../lib/appUrl";

const auth = new Hono<AuthEnv>();

/** Public config for the login UI (site key is not secret). */
auth.get("/config", (c) => {
  return c.json({
    turnstileSiteKey: turnstileSiteKey(c.env),
    turnstileRequired: Boolean(c.env.TURNSTILE_SECRET_KEY?.trim()),
  });
});

auth.post("/request", async (c) => {
  const parsed = await parseJsonBody(c.req, magicLinkRequestSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);

  const check = await verifyTurnstile(c.env, parsed.data.turnstileToken, clientIp(c));
  if (!check.ok) return c.json({ error: check.error }, 400);

  const result = await requestMagicLink(c.env, parsed.data.email, requestAppOrigin(c));
  if (!result.ok) return c.json({ error: result.error }, 400);
  return c.json({ ok: true });
});

// The link the user clicks from their inbox. Verifies, sets the session cookie, and redirects
// straight into the app rather than round-tripping through a frontend callback page.
auth.get("/verify", async (c) => {
  const appOrigin = requestAppOrigin(c);
  const token = c.req.query("token");
  if (!token) return c.redirect(`${appOrigin}/app/login?error=missing_token`);

  const result = await consumeMagicLink(c.env, token);
  if (!result.ok) {
    return c.redirect(`${appOrigin}/app/login?error=invalid_token`);
  }

  const existing = getCookie(c, SESSION_COOKIE_NAME);
  if (existing) await destroySession(c.env, existing);

  setSessionCookie(c, c.env, result.sessionToken);
  if (result.isNew) {
    c.executionCtx.waitUntil(
      trackEvent(c.env, {
        name: "signup_completed",
        accountId: result.accountId,
        path: "/api/auth/verify",
        // Mail-scanning bots prefetch magic links, so this signup is not automatically a human one.
        userAgent: c.req.header("User-Agent")?.slice(0, 300) || null,
      }).catch(() => {})
    );
  }
  return c.redirect(`${appOrigin}/app/account`);
});

auth.post("/logout", async (c) => {
  const sessionToken = getCookie(c, SESSION_COOKIE_NAME);
  if (sessionToken) await destroySession(c.env, sessionToken);
  clearSessionCookie(c);
  return c.json({ ok: true });
});

export default auth;
