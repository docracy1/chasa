import { getCookie } from "hono/cookie";
import type { Context } from "hono";
import type { Env } from "../types";
import { resolveAccount, SESSION_COOKIE_NAME, type AccountContext } from "./auth";
import { resolveAccountFromApiKeyBearer } from "./apiKeyResolve";

export async function resolveMcpAccount(c: Context<{ Bindings: Env }>): Promise<AccountContext | null> {
  const authHeader = c.req.header("Authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (bearer) {
    const fromKey = await resolveAccountFromApiKeyBearer(c.env, bearer);
    if (fromKey) return fromKey;
  }
  const sessionToken = getCookie(c, SESSION_COOKIE_NAME);
  if (sessionToken) {
    return resolveAccount(c.env, sessionToken);
  }
  return null;
}
