import { Hono } from "hono";
import { requireWorkspaceAdmin, type AuthEnv } from "../lib/auth";
import { createApiKey, listApiKeys, revokeApiKey } from "../lib/apiKeys";
import { connectorKeySchema, parseJsonBody } from "../lib/schemas";

const connector = new Hono<AuthEnv>();

connector.get("/keys", requireWorkspaceAdmin, async (c) => {
  const acc = c.get("account")!;
  const keys = await listApiKeys(c.env, acc.workspaceId);
  return c.json({ keys });
});

connector.post("/keys", requireWorkspaceAdmin, async (c) => {
  const acc = c.get("account")!;
  const parsed = await parseJsonBody(c.req, connectorKeySchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const name = parsed.data.name?.trim() ? parsed.data.name.trim() : "Default";
  const existing = await listApiKeys(c.env, acc.workspaceId);
  if (existing.length >= 5) {
    return c.json({ error: "Maximum 5 API keys per account." }, 400);
  }
  const created = await createApiKey(c.env, acc.workspaceId, name);
  // token shown once
  return c.json(created, 201);
});

connector.delete("/keys/:id", requireWorkspaceAdmin, async (c) => {
  const acc = c.get("account")!;
  const ok = await revokeApiKey(c.env, acc.workspaceId, c.req.param("id"));
  if (!ok) return c.json({ error: "Key not found" }, 404);
  return c.json({ ok: true });
});

export default connector;
