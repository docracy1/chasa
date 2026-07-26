import type { Context, MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Env } from "../types";
import { isPaidPlan, type Plan } from "./billing";
import { generateOpaqueToken, hashOpaqueToken } from "./token";
import { sendMagicLinkEmail } from "./email";

const MAGIC_LINK_TTL_SECONDS = 15 * 60;
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export const SESSION_COOKIE_NAME = "chasa_session";

export interface AccountContext {
  /** Session account id (the signed-in user). */
  id: string;
  email: string;
  plan: Plan;
  isPaid: boolean;
  /**
   * Workspace data scope — owner account id when this user is a team member,
   * otherwise same as `id`. Use for aging/clients/connectors/etc.
   */
  workspaceId: string;
  /** Role in the workspace; owners are always admin. */
  role: "admin" | "member";
}

function normalizePlan(raw: string | null | undefined, isPaid: boolean): Plan {
  if (raw === "solo" || raw === "pro" || raw === "enterprise" || raw === "free") return raw;
  return isPaid ? "solo" : "free";
}

function isHttps(url: string): boolean {
  return url.startsWith("https://");
}

export function sessionCookieOptions(env: Env) {
  const https = isHttps(env.PUBLIC_APP_URL);
  return {
    httpOnly: true as const,
    secure: https,
    sameSite: (https ? "None" : "Lax") as "None" | "Lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

async function findOrCreateAccount(
  env: Env,
  email: string
): Promise<{ id: string; plan: Plan; isPaid: boolean; isNew: boolean }> {
  const normalized = email.trim().toLowerCase();
  const existing = await env.CHASA_DB.prepare(`SELECT id, is_paid, plan FROM accounts WHERE email = ?`)
    .bind(normalized)
    .first<{ id: string; is_paid: number; plan: string | null }>();

  if (existing) {
    await env.CHASA_DB.prepare(`UPDATE accounts SET last_login_at = ? WHERE id = ?`)
      .bind(new Date().toISOString(), existing.id)
      .run();
    const plan = normalizePlan(existing.plan, existing.is_paid === 1);
    return { id: existing.id, plan, isPaid: isPaidPlan(plan), isNew: false };
  }

  const id = crypto.randomUUID();
  await env.CHASA_DB.prepare(
    `INSERT INTO accounts (id, email, created_at, is_paid, plan) VALUES (?, ?, ?, 0, 'free')`
  )
    .bind(id, normalized, new Date().toISOString())
    .run();
  return { id, plan: "free", isPaid: false, isNew: true };
}

/** Soft cooldown between magic-link emails for the same address (Turnstile is the main bot gate). */
const MAGIC_LINK_COOLDOWN_SECONDS = 60;

export async function requestMagicLink(env: Env, email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const now = new Date();
  const cooldownSince = new Date(now.getTime() - MAGIC_LINK_COOLDOWN_SECONDS * 1000).toISOString();
  const recent = await env.CHASA_DB.prepare(
    `SELECT 1 as hit FROM magic_links WHERE email = ? AND created_at > ? LIMIT 1`
  )
    .bind(normalized, cooldownSince)
    .first<{ hit: number }>();
  if (recent) {
    return { ok: false, error: "Please wait a minute before requesting another link." };
  }

  const token = generateOpaqueToken();
  const tokenHash = await hashOpaqueToken(token, env.TOKEN_SECRET);
  const expiresAt = new Date(now.getTime() + MAGIC_LINK_TTL_SECONDS * 1000);

  await env.CHASA_DB.prepare(
    `INSERT INTO magic_links (token_hash, email, created_at, expires_at) VALUES (?, ?, ?, ?)`
  )
    .bind(tokenHash, normalized, now.toISOString(), expiresAt.toISOString())
    .run();

  // Go through the app origin (Pages /api proxy), not api.chasa.io directly — otherwise the
  // session cookie is set on the API host and never sent with same-origin /api calls from the app.
  // Cookie options omit Domain= so the browser scopes the cookie to the app host (pages.dev or chasa.io).
  const verifyUrl = `${env.PUBLIC_APP_URL}/api/auth/verify?token=${encodeURIComponent(token)}`;
  await sendMagicLinkEmail(env, normalized, verifyUrl);

  return { ok: true };
}

export async function consumeMagicLink(
  env: Env,
  token: string
): Promise<
  | { ok: true; sessionToken: string; isPaid: boolean; plan: Plan; accountId: string; isNew: boolean }
  | { ok: false; error: string }
> {
  const tokenHash = await hashOpaqueToken(token, env.TOKEN_SECRET);
  const now = new Date().toISOString();

  const row = await env.CHASA_DB.prepare(
    `SELECT email FROM magic_links WHERE token_hash = ? AND expires_at > ? AND consumed_at IS NULL`
  )
    .bind(tokenHash, now)
    .first<{ email: string }>();

  if (!row) {
    return { ok: false, error: "That link is invalid or has expired. Request a new one." };
  }

  await env.CHASA_DB.prepare(`UPDATE magic_links SET consumed_at = ? WHERE token_hash = ?`)
    .bind(now, tokenHash)
    .run();

  const account = await findOrCreateAccount(env, row.email);
  const sessionToken = await createSession(env, account.id);
  return {
    ok: true,
    sessionToken,
    isPaid: account.isPaid,
    plan: account.plan,
    accountId: account.id,
    isNew: account.isNew,
  };
}

export async function createSession(env: Env, accountId: string): Promise<string> {
  const token = generateOpaqueToken();
  const tokenHash = await hashOpaqueToken(token, env.TOKEN_SECRET);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);

  await env.CHASA_DB.prepare(
    `INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)`
  )
    .bind(tokenHash, accountId, now.toISOString(), expiresAt.toISOString())
    .run();

  return token;
}

export async function resolveAccount(env: Env, sessionToken: string): Promise<AccountContext | null> {
  const tokenHash = await hashOpaqueToken(sessionToken, env.TOKEN_SECRET);
  const now = new Date().toISOString();

  const row = await env.CHASA_DB.prepare(
    `SELECT a.id as id, a.email as email, a.is_paid as is_paid, a.plan as plan,
            a.workspace_owner_id as workspace_owner_id
     FROM sessions s JOIN accounts a ON a.id = s.account_id
     WHERE s.token_hash = ? AND s.expires_at > ?`
  )
    .bind(tokenHash, now)
    .first<{
      id: string;
      email: string;
      is_paid: number;
      plan: string | null;
      workspace_owner_id: string | null;
    }>();

  if (!row) return null;

  // Fire-and-forget last-seen bump; never blocks or fails the request.
  env.CHASA_DB.prepare(`UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?`)
    .bind(now, tokenHash)
    .run()
    .catch((err) => console.error("session last_seen_at update failed", err));

  let workspaceId = row.id;
  let role: "admin" | "member" = "admin";
  let plan = normalizePlan(row.plan, row.is_paid === 1);

  if (row.workspace_owner_id) {
    const owner = await env.CHASA_DB.prepare(
      `SELECT id, is_paid, plan FROM accounts WHERE id = ?`
    )
      .bind(row.workspace_owner_id)
      .first<{ id: string; is_paid: number; plan: string | null }>();
    if (owner) {
      workspaceId = owner.id;
      plan = normalizePlan(owner.plan, owner.is_paid === 1);
      const membership = await env.CHASA_DB.prepare(
        `SELECT role FROM workspace_members
         WHERE account_id = ? AND email = ? AND status = 'active'`
      )
        .bind(owner.id, row.email)
        .first<{ role: string }>();
      if (membership?.role === "member" || membership?.role === "admin") {
        role = membership.role;
      } else {
        role = "member";
      }
    }
  }

  return {
    id: row.id,
    email: row.email,
    plan,
    isPaid: isPaidPlan(plan),
    workspaceId,
    role,
  };
}

export async function destroySession(env: Env, sessionToken: string): Promise<void> {
  const tokenHash = await hashOpaqueToken(sessionToken, env.TOKEN_SECRET);
  await env.CHASA_DB.prepare(`DELETE FROM sessions WHERE token_hash = ?`).bind(tokenHash).run();
}

type AuthVariables = { account: AccountContext | null };
export type AuthEnv = { Bindings: Env; Variables: AuthVariables };

export const optionalAccount: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const sessionToken = getCookie(c, SESSION_COOKIE_NAME);
  const account = sessionToken ? await resolveAccount(c.env, sessionToken) : null;
  c.set("account", account);
  await next();
};

export const requireAccount: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const sessionToken = getCookie(c, SESSION_COOKIE_NAME);
  const account = sessionToken ? await resolveAccount(c.env, sessionToken) : null;
  if (!account) return c.json({ error: "Sign in required" }, 401);
  c.set("account", account);
  await next();
};

/**
 * Solo ($7) / Pro ($17) / Enterprise — any paid plan.
 * Use for connectors, webhooks, branding, chase plans, tracking, team, QBO/Xero, SMS drafts.
 * Do NOT gate those to requireProAccount — parity features are Solo+.
 */
export const requirePaidAccount: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const sessionToken = getCookie(c, SESSION_COOKIE_NAME);
  const account = sessionToken ? await resolveAccount(c.env, sessionToken) : null;
  if (!account) return c.json({ error: "Sign in required" }, 401);
  if (!account.isPaid) return c.json({ error: "This requires a paid account (Solo, Pro, or Enterprise)" }, 402);
  c.set("account", account);
  await next();
};

/** @deprecated Prefer requirePaidAccount — parity features are Solo+. Kept for rare Pro-only gates. */
export const requireProAccount: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const sessionToken = getCookie(c, SESSION_COOKIE_NAME);
  const account = sessionToken ? await resolveAccount(c.env, sessionToken) : null;
  if (!account) return c.json({ error: "Sign in required" }, 401);
  if (account.plan !== "pro" && account.plan !== "enterprise") {
    return c.json({ error: "This requires Pro or Enterprise" }, 402);
  }
  c.set("account", account);
  await next();
};

/** Workspace admin only (owner or invited admin). */
export const requireWorkspaceAdmin: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const sessionToken = getCookie(c, SESSION_COOKIE_NAME);
  const account = sessionToken ? await resolveAccount(c.env, sessionToken) : null;
  if (!account) return c.json({ error: "Sign in required" }, 401);
  if (!account.isPaid) return c.json({ error: "This requires a paid account (Solo, Pro, or Enterprise)" }, 402);
  if (account.role !== "admin") return c.json({ error: "Admin role required" }, 403);
  c.set("account", account);
  await next();
};

export function setSessionCookie(c: Context, env: Env, token: string) {
  setCookie(c, SESSION_COOKIE_NAME, token, sessionCookieOptions(env));
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
}
