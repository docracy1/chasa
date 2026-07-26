import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { AuthEnv } from "../lib/auth";
import { SESSION_COOKIE_NAME, resolveAccount } from "../lib/auth";
import { isAllowedEvent, recordPageView, trackEvent } from "../lib/analytics";

const analytics = new Hono<AuthEnv>();

analytics.post("/track", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    name?: unknown;
    properties?: Record<string, unknown>;
    visitorId?: unknown;
    path?: unknown;
  };

  const name = typeof body.name === "string" ? body.name : "";
  if (!isAllowedEvent(name)) {
    return c.json({ error: "Unknown event" }, 400);
  }

  const visitorId = typeof body.visitorId === "string" ? body.visitorId.slice(0, 80) : null;
  const path = typeof body.path === "string" ? body.path.slice(0, 300) : null;

  let accountId: string | null = null;
  const sessionToken = getCookie(c, SESSION_COOKIE_NAME);
  if (sessionToken) {
    const account = await resolveAccount(c.env, sessionToken);
    accountId = account?.id ?? null;
  }

  await trackEvent(c.env, {
    name,
    properties: body.properties && typeof body.properties === "object" ? body.properties : undefined,
    visitorId,
    accountId,
    path,
  });

  return c.json({ ok: true });
});

/** Aggregate page view — no visitor id stored. Country from CF-IPCountry only. */
analytics.post("/pageview", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { path?: unknown };
  const path = typeof body.path === "string" ? body.path : "/";
  const country = c.req.header("CF-IPCountry") || null;
  const userAgent = c.req.header("User-Agent") || null;

  await recordPageView(c.env, { path, country, userAgent });
  return c.json({ ok: true });
});

export default analytics;
