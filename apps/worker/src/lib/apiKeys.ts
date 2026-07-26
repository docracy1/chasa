import { getCookie } from "hono/cookie";
import type { MiddlewareHandler } from "hono";
import type { Env } from "../types";
import { hashOpaqueToken } from "./token";
import { isPaidPlan, type Plan } from "./billing";
import {
  resolveAccount,
  SESSION_COOKIE_NAME,
  type AccountContext,
  type AuthEnv,
} from "./auth";

function normalizePlan(raw: string | null | undefined, isPaid: boolean): Plan {
  if (raw === "solo" || raw === "pro" || raw === "enterprise" || raw === "free") return raw;
  return isPaid ? "solo" : "free";
}

export async function createApiKey(
  env: Env,
  accountId: string,
  name = "Default"
): Promise<{ id: string; token: string; prefix: string; createdAt: string }> {
  const raw = `chasa_${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const token_hash = await hashOpaqueToken(raw, env.TOKEN_SECRET);
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  const prefix = raw.slice(0, 14);

  await env.CHASA_DB.prepare(
    `INSERT INTO api_keys (id, account_id, name, token_hash, prefix, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(id, accountId, name.slice(0, 40), token_hash, prefix, created_at)
    .run();

  return { id, token: raw, prefix, createdAt: created_at };
}

export async function listApiKeys(env: Env, accountId: string) {
  const res = await env.CHASA_DB.prepare(
    `SELECT id, name, prefix, created_at, last_used_at FROM api_keys WHERE account_id = ? ORDER BY created_at DESC`
  )
    .bind(accountId)
    .all<{ id: string; name: string; prefix: string; created_at: string; last_used_at: string | null }>();
  return (res.results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    prefix: r.prefix,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
  }));
}

export async function revokeApiKey(env: Env, accountId: string, id: string): Promise<boolean> {
  const res = await env.CHASA_DB.prepare(`DELETE FROM api_keys WHERE id = ? AND account_id = ?`)
    .bind(id, accountId)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

async function resolveAccountFromApiKey(env: Env, bearer: string): Promise<AccountContext | null> {
  if (!bearer.startsWith("chasa_")) return null;
  const token_hash = await hashOpaqueToken(bearer, env.TOKEN_SECRET);
  const row = await env.CHASA_DB.prepare(
    `SELECT k.id as key_id, a.id as id, a.email as email, a.is_paid as is_paid, a.plan as plan
     FROM api_keys k
     JOIN accounts a ON a.id = k.account_id
     WHERE k.token_hash = ?`
  )
    .bind(token_hash)
    .first<{ key_id: string; id: string; email: string; is_paid: number; plan: string | null }>();

  if (!row) return null;

  await env.CHASA_DB.prepare(`UPDATE api_keys SET last_used_at = ? WHERE id = ?`)
    .bind(new Date().toISOString(), row.key_id)
    .run();

  const plan = normalizePlan(row.plan, row.is_paid === 1);
  return {
    id: row.id,
    email: row.email,
    plan,
    isPaid: isPaidPlan(plan),
    workspaceId: row.id,
    role: "admin",
  };
}

/** Accept session cookie OR Bearer API key (paid). */
export const requirePaidApiOrSession: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const auth = c.req.header("Authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    const account = await resolveAccountFromApiKey(c.env, token);
    if (!account) return c.json({ error: "Invalid API key" }, 401);
    if (!account.isPaid) {
      return c.json({ error: "API keys require Solo, Pro ($17), or Enterprise" }, 402);
    }
    c.set("account", account);
    await next();
    return;
  }

  const sessionToken = getCookie(c, SESSION_COOKIE_NAME);
  const account = sessionToken ? await resolveAccount(c.env, sessionToken) : null;
  if (!account) return c.json({ error: "Sign in or provide Bearer API key" }, 401);
  if (!account.isPaid) {
    return c.json({ error: "This requires Solo, Pro ($17), or Enterprise" }, 402);
  }
  c.set("account", account);
  await next();
};
