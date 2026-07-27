import { Hono } from "hono";
import { requireAccount, requirePaidAccount, requireWorkspaceAdmin, type AuthEnv } from "../lib/auth";
import {
  createWebhook,
  deleteWebhook,
  dispatchWebhooks,
  isValidWebhookUrl,
  listWebhooks,
  type WebhookEvent,
} from "../lib/webhooks";

const webhooks = new Hono<AuthEnv>();

webhooks.get("/", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const rows = await listWebhooks(c.env, acc.workspaceId);
  return c.json({
    webhooks: rows.map((w) => ({ id: w.id, url: w.url, createdAt: w.created_at })),
  });
});

webhooks.post("/", requireWorkspaceAdmin, async (c) => {
  const acc = c.get("account")!;
  const body = (await c.req.json().catch(() => ({}))) as { url?: unknown };
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url || !isValidWebhookUrl(url)) {
    return c.json({ error: "Enter a valid http(s) URL you control." }, 400);
  }
  const existing = await listWebhooks(c.env, acc.workspaceId);
  if (existing.length >= 10) {
    return c.json({ error: "Maximum 10 webhooks per account." }, 400);
  }
  const row = await createWebhook(c.env, acc.workspaceId, url);
  return c.json({ id: row.id, url: row.url, createdAt: row.created_at }, 201);
});

webhooks.delete("/:id", requireWorkspaceAdmin, async (c) => {
  const acc = c.get("account")!;
  const ok = await deleteWebhook(c.env, acc.workspaceId, c.req.param("id"));
  if (!ok) return c.json({ error: "Webhook not found" }, 404);
  return c.json({ ok: true });
});

/** Client notifies server when a chase is copied/sent so webhooks fire. */
webhooks.post("/notify", requireAccount, async (c) => {
  const acc = c.get("account")!;
  if (!acc.isPaid) return c.json({ ok: true, skipped: true });

  const body = (await c.req.json().catch(() => ({}))) as {
    event?: unknown;
    data?: Record<string, unknown>;
  };
  const allowed: WebhookEvent[] = [
    "chase.sent",
    "chase.downloaded",
    "chase.drafted",
    "chase.thank_you",
    "chase.reply_drafted",
    "chase.sequence_planned",
  ];
  const event = typeof body.event === "string" ? (body.event as WebhookEvent) : null;
  if (!event || !allowed.includes(event)) {
    return c.json({ error: "Invalid event" }, 400);
  }

  c.executionCtx.waitUntil(
    dispatchWebhooks(c.env, acc.workspaceId, event, body.data ?? {}).catch(() => {})
  );
  return c.json({ ok: true });
});

export default webhooks;
