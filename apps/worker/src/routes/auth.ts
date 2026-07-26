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

const auth = new Hono<AuthEnv>();

auth.post("/request", async (c) => {
  const body = await c.req.json<{ email?: string }>();
  const result = await requestMagicLink(c.env, body.email ?? "");
  if (!result.ok) return c.json({ error: result.error }, 400);
  return c.json({ ok: true });
});

// The link the user clicks from their inbox. Verifies, sets the session cookie, and redirects
// straight into the app rather than round-tripping through a frontend callback page.
auth.get("/verify", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.redirect(`${c.env.PUBLIC_APP_URL}/app/login?error=missing_token`);

  const result = await consumeMagicLink(c.env, token);
  if (!result.ok) {
    return c.redirect(`${c.env.PUBLIC_APP_URL}/app/login?error=invalid_token`);
  }

  setSessionCookie(c, c.env, result.sessionToken);
  if (result.isNew) {
    c.executionCtx.waitUntil(
      trackEvent(c.env, {
        name: "signup_completed",
        accountId: result.accountId,
        path: "/api/auth/verify",
      }).catch(() => {})
    );
  }
  return c.redirect(`${c.env.PUBLIC_APP_URL}/app/account`);
});

auth.post("/logout", async (c) => {
  const sessionToken = getCookie(c, SESSION_COOKIE_NAME);
  if (sessionToken) await destroySession(c.env, sessionToken);
  clearSessionCookie(c);
  return c.json({ ok: true });
});

export default auth;
