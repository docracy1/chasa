import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import {
  ADMIN_COOKIE_NAME,
  clearAdminCookie,
  destroyAdminSession,
  loginAdmin,
  requireAdmin,
  resolveAdmin,
  setAdminCookie,
  type AdminEnv,
} from "../lib/adminAuth";
import { getFunnelStats, getTrafficStats } from "../lib/analytics";
import { createPost, deletePost, listPosts, updatePost } from "../lib/blog";
import { clientIp, verifyTurnstile } from "../lib/turnstile";
import {
  adminBlogPatchSchema,
  adminBlogPostSchema,
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
  const token = getCookie(c, ADMIN_COOKIE_NAME);
  const adminUser = token ? await resolveAdmin(c.env, token) : null;
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
  const stats = await getTrafficStats(c.env, days);
  return c.json(stats);
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

export default admin;
