import { Hono, type Context } from "hono";
import { getCookie } from "hono/cookie";
import type { AuthEnv } from "../lib/auth";
import { SESSION_COOKIE_NAME, resolveAccount } from "../lib/auth";
import {
  isAllowedEvent,
  isExcludedAgent,
  NOTRACK_COOKIE_NAME,
  recordPageView,
  trackEvent,
} from "../lib/analytics";
import { isAdminEmail } from "../lib/adminAuth";
import { checkRateLimit, clientIpFromHeaders } from "../lib/rateLimit";
import { clientIp } from "../lib/turnstile";
import {
  analyticsPageviewSchema,
  analyticsTrackSchema,
  parseJsonBody,
} from "../lib/schemas";

const analytics = new Hono<AuthEnv>();

async function shouldSkipAnalytics(c: Context<AuthEnv>): Promise<boolean> {
  if (getCookie(c, NOTRACK_COOKIE_NAME) === "1") return true;
  if (isExcludedAgent(c.req.header("User-Agent"))) return true;
  const sessionToken = getCookie(c, SESSION_COOKIE_NAME);
  if (!sessionToken) return false;
  const account = await resolveAccount(c.env, sessionToken);
  return !!account && isAdminEmail(c.env, account.email);
}

analytics.post("/track", async (c) => {
  const ip = clientIp(c) || clientIpFromHeaders({ get: (n) => c.req.header(n) ?? null });
  const rl = await checkRateLimit(c.env, `analytics_track:${ip}`, 120, 3600);
  if (!rl.ok) return c.json({ error: "Too many requests" }, 429);

  const parsed = await parseJsonBody(c.req, analyticsTrackSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);

  const { name, properties, visitorId, path } = parsed.data;
  if (!isAllowedEvent(name)) {
    return c.json({ error: "Unknown event" }, 400);
  }

  if (await shouldSkipAnalytics(c)) return c.json({ ok: true });

  let accountId: string | null = null;
  const sessionToken = getCookie(c, SESSION_COOKIE_NAME);
  if (sessionToken) {
    const account = await resolveAccount(c.env, sessionToken);
    accountId = account?.id ?? null;
  }

  await trackEvent(c.env, {
    name,
    properties,
    visitorId: visitorId ?? null,
    accountId,
    path: path ?? null,
    userAgent: c.req.header("User-Agent")?.slice(0, 300) || null,
  });

  return c.json({ ok: true });
});

/** Aggregate page view — no visitor id stored. Country from CF-IPCountry only. */
analytics.post("/pageview", async (c) => {
  const ip = clientIp(c) || clientIpFromHeaders({ get: (n) => c.req.header(n) ?? null });
  const rl = await checkRateLimit(c.env, `analytics_pv:${ip}`, 200, 3600);
  if (!rl.ok) return c.json({ error: "Too many requests" }, 429);

  const parsed = await parseJsonBody(c.req, analyticsPageviewSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);

  if (await shouldSkipAnalytics(c)) return c.json({ ok: true });

  const path = parsed.data.path?.trim() || "/";
  const country = c.req.header("CF-IPCountry") || null;
  const userAgent = c.req.header("User-Agent")?.slice(0, 300) || null;

  await recordPageView(c.env, { path, country, userAgent });
  return c.json({ ok: true });
});

export default analytics;
