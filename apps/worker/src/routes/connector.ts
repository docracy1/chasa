import { Hono } from "hono";
import { requirePaidAccount, type AuthEnv } from "../lib/auth";
import { createApiKey, listApiKeys, revokeApiKey } from "../lib/apiKeys";

const connector = new Hono<AuthEnv>();

connector.get("/keys", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const keys = await listApiKeys(c.env, acc.workspaceId);
  return c.json({ keys });
});

connector.post("/keys", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const body = (await c.req.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Default";
  const existing = await listApiKeys(c.env, acc.workspaceId);
  if (existing.length >= 5) {
    return c.json({ error: "Maximum 5 API keys per account." }, 400);
  }
  const created = await createApiKey(c.env, acc.workspaceId, name);
  // token shown once
  return c.json(created, 201);
});

connector.delete("/keys/:id", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const ok = await revokeApiKey(c.env, acc.workspaceId, c.req.param("id"));
  if (!ok) return c.json({ error: "Key not found" }, 404);
  return c.json({ ok: true });
});

export default connector;
