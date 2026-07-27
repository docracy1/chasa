import { getCookie } from "hono/cookie";
import type { MiddlewareHandler } from "hono";
import type { Env } from "../types";
import { hashOpaqueToken } from "./token";
import {
  resolveAccount,
  SESSION_COOKIE_NAME,
  type AccountContext,
  type AuthEnv,
} from "./auth";
import { resolveAccountFromApiKeyBearer } from "./apiKeyResolve";

export async function createApiKey(
  env: Env,
  accountId: string,
  name = "Default"
): Promise<{ id: string; token: string; prefix: string; createdAt: string }> {
  const raw = `chasa_${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const token_hash = await hashOpaqueToken(raw, env.TOKEN_SECRET, "api-key");
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

/** Accept session cookie OR Bearer API key (paid). */
export const requirePaidApiOrSession: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const auth = c.req.header("Authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    const account = await resolveAccountFromApiKeyBearer(c.env, token);
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

/** API keys and session must be workspace admin for key management. */
export const requirePaidApiOrSessionAdmin: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const auth = c.req.header("Authorization") || "";
  let account: AccountContext | null = null;

  if (auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    account = await resolveAccountFromApiKeyBearer(c.env, token);
    if (!account) return c.json({ error: "Invalid API key" }, 401);
  } else {
    const sessionToken = getCookie(c, SESSION_COOKIE_NAME);
    account = sessionToken ? await resolveAccount(c.env, sessionToken) : null;
    if (!account) return c.json({ error: "Sign in or provide Bearer API key" }, 401);
  }

  if (!account.isPaid) {
    return c.json({ error: "This requires Solo, Pro ($17), or Enterprise" }, 402);
  }
  if (account.role !== "admin") {
    return c.json({ error: "Admin role required for API keys" }, 403);
  }
  c.set("account", account);
  await next();
};
