import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import {
  ADMIN_COOKIE_NAME,
  clearAdminCookie,
  destroyAdminSession,
  loginAdmin,
  requireAdmin,
  resolveAdminAccess,
  setAdminCookie,
  type AdminEnv,
} from "../lib/adminAuth";
import { SESSION_COOKIE_NAME } from "../lib/auth";
import { getFunnelStats, getOutreachStats, getTrafficSources, getTrafficStats } from "../lib/analytics";
import { getCachedClaritySnapshot, refreshClaritySnapshot } from "../lib/clarityApi";
import { createPost, deletePost, listPosts, updatePost } from "../lib/blog";
import { sendMarketingEmail } from "../lib/email";
import { normalizeLocale } from "../lib/locale";
import { clientIp, verifyTurnstile } from "../lib/turnstile";
import {
  adminBlogPatchSchema,
  adminBlogPostSchema,
  adminBroadcastSchema,
  adminGrantEnterpriseSchema,
  adminLoginSchema,
  parseJsonBody,
} from "../lib/schemas";

const admin = new Hono<AdminEnv>();

admin.post("/login", async (c) => {
  const parsed = await parseJsonBody(c.req, adminLoginSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const { email, password, turnstileToken } = parsed.data;
  const check = await verifyTurnstile(c.env, turnstileToken, clientIp(c));
  if (!check.ok) return c.json({ error: check.error }, 400);
  const result = await loginAdmin(c.env, email, password, clientIp(c) || "unknown");
  if (!result.ok) return c.json({ error: result.error }, (result.status ?? 401) as 401 | 429);
  setAdminCookie(c, c.env, result.token);
  return c.json({ ok: true, email: email.trim().toLowerCase() });
});

admin.post("/logout", async (c) => {
  const token = getCookie(c, ADMIN_COOKIE_NAME);
  if (token) await destroyAdminSession(c.env, token);
  clearAdminCookie(c);
  return c.json({ ok: true });
});

admin.get("/me", async (c) => {
  const adminUser = await resolveAdminAccess(
    c.env,
    getCookie(c, ADMIN_COOKIE_NAME),
    getCookie(c, SESSION_COOKIE_NAME)
  );
  if (!adminUser) return c.json({ error: "Admin sign-in required" }, 401);
  return c.json({ email: adminUser.email });
});

admin.get("/funnels", requireAdmin, async (c) => {
  const daysRaw = Number(c.req.query("days") || "30");
  const days = Number.isFinite(daysRaw) ? Math.min(Math.max(daysRaw, 1), 90) : 30;
  // Only the event funnels take this filter — /traffic reads page_views, which is where the
  // dashboard gets its human-vs-bot breakdown from and so has to stay unfiltered.
  const humansOnly = c.req.query("humansOnly") === "1";
  const stats = await getFunnelStats(c.env, days, humansOnly);
  return c.json(stats);
});

admin.get("/traffic", requireAdmin, async (c) => {
  const daysRaw = Number(c.req.query("days") || "30");
  const days = Number.isFinite(daysRaw) ? Math.min(Math.max(daysRaw, 1), 90) : 30;
  const day = c.req.query("day") || null;
  const stats = await getTrafficStats(c.env, days, day);
  return c.json(stats);
});

admin.get("/traffic-sources", requireAdmin, async (c) => {
  const daysRaw = Number(c.req.query("days") || "30");
  const days = Number.isFinite(daysRaw) ? Math.min(Math.max(daysRaw, 1), 90) : 30;
  const humansOnly = c.req.query("humansOnly") === "1";
  const stats = await getTrafficSources(c.env, days, humansOnly);
  return c.json(stats);
});

admin.get("/outreach", requireAdmin, async (c) => {
  const daysRaw = Number(c.req.query("days") || "30");
  const days = Number.isFinite(daysRaw) ? Math.min(Math.max(daysRaw, 1), 90) : 30;
  const stats = await getOutreachStats(c.env, days);
  return c.json(stats);
});

admin.get("/clarity", requireAdmin, async (c) => {
  const configured = !!c.env.CLARITY_API_TOKEN;
  const snapshot = await getCachedClaritySnapshot(c.env);
  return c.json({ configured, snapshot });
});

admin.post("/clarity/refresh", requireAdmin, async (c) => {
  if (!c.env.CLARITY_API_TOKEN) return c.json({ error: "not_configured" }, 400);
  const result = await refreshClaritySnapshot(c.env);
  if (!result.ok) {
    const status = result.error === "too_soon" || result.error === "daily_quota_reached" ? 429 : 502;
    return c.json({ error: result.error }, status);
  }
  return c.json({ snapshot: result.snapshot });
});

admin.get("/signups", requireAdmin, async (c) => {
  const limitRaw = Number(c.req.query("limit") || "100");
  const offsetRaw = Number(c.req.query("offset") || "0");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 100;
  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

  const rows = await c.env.CHASA_DB.prepare(
    `SELECT email, plan, created_at, is_paid FROM accounts ORDER BY created_at DESC LIMIT ? OFFSET ?`
  )
    .bind(limit, offset)
    .all<{ email: string; plan: string | null; created_at: string; is_paid: number }>();

  const totalRow = await c.env.CHASA_DB.prepare(`SELECT COUNT(*) as n FROM accounts`).first<{ n: number }>();

  const accounts = (rows.results ?? []).map((r) => ({
    email: r.email,
    plan: r.plan || (r.is_paid ? "solo" : "free"),
    createdAt: r.created_at,
  }));

  const free = accounts.filter((a) => a.plan === "free");
  const paid = accounts.filter((a) => a.plan !== "free");
  const enterprise = accounts.filter((a) => a.plan === "enterprise");

  return c.json({
    total: totalRow?.n ?? accounts.length,
    limit,
    offset,
    free,
    paid,
    enterprise,
  });
});

admin.post("/grant-enterprise", requireAdmin, async (c) => {
  const parsed = await parseJsonBody(c.req, adminGrantEnterpriseSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const email = parsed.data.email.trim().toLowerCase();

  const existing = await c.env.CHASA_DB.prepare(`SELECT id FROM accounts WHERE email = ?`)
    .bind(email)
    .first<{ id: string }>();

  const now = new Date().toISOString();
  if (existing) {
    await c.env.CHASA_DB.prepare(
      `UPDATE accounts SET plan = 'enterprise', is_paid = 1, paid_at = COALESCE(paid_at, ?) WHERE id = ?`
    )
      .bind(now, existing.id)
      .run();
  } else {
    await c.env.CHASA_DB.prepare(
      `INSERT INTO accounts (id, email, created_at, is_paid, plan, paid_at) VALUES (?, ?, ?, 1, 'enterprise', ?)`
    )
      .bind(crypto.randomUUID(), email, now, now)
      .run();
  }

  return c.json({ ok: true, email, plan: "enterprise" });
});

admin.get("/blog", requireAdmin, async (c) => {
  const posts = await listPosts(c.env);
  return c.json({ posts });
});

admin.post("/blog", requireAdmin, async (c) => {
  const parsed = await parseJsonBody(c.req, adminBlogPostSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const body = parsed.data;
  const result = await createPost(c.env, {
    title: body.title,
    slug: body.slug,
    description: body.description,
    body: body.body,
    published: Boolean(body.published),
  });
  if ("error" in result) return c.json({ error: result.error }, 400);
  return c.json({ post: result });
});

admin.patch("/blog/:id", requireAdmin, async (c) => {
  const parsed = await parseJsonBody(c.req, adminBlogPatchSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const result = await updatePost(c.env, c.req.param("id"), parsed.data);
  if ("error" in result) return c.json({ error: result.error }, 400);
  return c.json({ post: result });
});

admin.delete("/blog/:id", requireAdmin, async (c) => {
  await deletePost(c.env, c.req.param("id"));
  return c.json({ ok: true });
});

/** Product news/update broadcast — only to accounts.marketing_opt_in accounts. dryRun just
 *  returns the recipient count so the admin UI can show "send to N people" before confirming. */
admin.post("/broadcast", requireAdmin, async (c) => {
  const parsed = await parseJsonBody(c.req, adminBroadcastSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const { subject, bodyHtml, dryRun } = parsed.data;

  const { results } = await c.env.CHASA_DB.prepare(
    `SELECT id, email, locale, marketing_unsub_token FROM accounts WHERE marketing_opt_in = 1`
  ).all<{ id: string; email: string; locale: string | null; marketing_unsub_token: string | null }>();
  const recipients = results ?? [];

  if (dryRun) {
    return c.json({ recipientCount: recipients.length });
  }

  const workerBase = (c.env.PUBLIC_WORKER_URL || "https://api.chasa.io").replace(/\/$/, "");
  let sent = 0;
  let failed = 0;

  for (const r of recipients) {
    let token = r.marketing_unsub_token;
    if (!token) {
      token = crypto.randomUUID();
      await c.env.CHASA_DB.prepare(`UPDATE accounts SET marketing_unsub_token = ? WHERE id = ?`)
        .bind(token, r.id)
        .run();
    }
    const unsubUrl = `${workerBase}/api/account/marketing-unsubscribe?token=${encodeURIComponent(token)}`;
    const result = await sendMarketingEmail(
      c.env,
      r.email,
      { subject, bodyHtml, unsubUrl },
      normalizeLocale(r.locale)
    );
    if (result.ok) sent++;
    else failed++;
  }

  return c.json({ recipientCount: recipients.length, sent, failed });
});

export default admin;
