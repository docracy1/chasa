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

const admin = new Hono<AdminEnv>();

admin.post("/login", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    email?: unknown;
    password?: unknown;
    turnstileToken?: unknown;
  };
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  const turnstileToken = typeof body.turnstileToken === "string" ? body.turnstileToken : undefined;
  const check = await verifyTurnstile(c.env, turnstileToken, clientIp(c));
  if (!check.ok) return c.json({ error: check.error }, 400);
  const result = await loginAdmin(c.env, email, password);
  if (!result.ok) return c.json({ error: result.error }, 401);
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
  const stats = await getFunnelStats(c.env, days);
  return c.json(stats);
});

admin.get("/traffic", requireAdmin, async (c) => {
  const daysRaw = Number(c.req.query("days") || "30");
  const days = Number.isFinite(daysRaw) ? Math.min(Math.max(daysRaw, 1), 90) : 30;
  const stats = await getTrafficStats(c.env, days);
  return c.json(stats);
});

admin.get("/signups", requireAdmin, async (c) => {
  const rows = await c.env.CHASA_DB.prepare(
    `SELECT email, plan, created_at, is_paid FROM accounts ORDER BY created_at DESC`
  ).all<{ email: string; plan: string | null; created_at: string; is_paid: number }>();

  const accounts = (rows.results ?? []).map((r) => ({
    email: r.email,
    plan: r.plan || (r.is_paid ? "solo" : "free"),
    createdAt: r.created_at,
  }));

  const free = accounts.filter((a) => a.plan === "free");
  const paid = accounts.filter((a) => a.plan !== "free");
  const enterprise = accounts.filter((a) => a.plan === "enterprise");

  return c.json({
    total: accounts.length,
    free,
    paid,
    enterprise,
  });
});

admin.post("/grant-enterprise", requireAdmin, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) return c.json({ error: "Enter a valid email." }, 400);

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
  const body = (await c.req.json().catch(() => ({}))) as {
    title?: string;
    slug?: string;
    description?: string;
    body?: string;
    published?: boolean;
  };
  const result = await createPost(c.env, {
    title: body.title ?? "",
    slug: body.slug,
    description: body.description,
    body: body.body ?? "",
    published: Boolean(body.published),
  });
  if ("error" in result) return c.json({ error: result.error }, 400);
  return c.json({ post: result });
});

admin.patch("/blog/:id", requireAdmin, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    title?: string;
    slug?: string;
    description?: string;
    body?: string;
    published?: boolean;
  };
  const result = await updatePost(c.env, c.req.param("id"), body);
  if ("error" in result) return c.json({ error: result.error }, 400);
  return c.json({ post: result });
});

admin.delete("/blog/:id", requireAdmin, async (c) => {
  await deletePost(c.env, c.req.param("id"));
  return c.json({ ok: true });
});

export default admin;
