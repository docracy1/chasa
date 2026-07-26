import type { Env } from "../types";

export type WebhookEvent =
  | "chase.drafted"
  | "chase.sent"
  | "chase.thank_you"
  | "chase.reply_drafted"
  | "chase.sequence_planned"
  | "chase.downloaded";

export type WebhookRow = {
  id: string;
  account_id: string;
  url: string;
  created_at: string;
};

export async function listWebhooks(env: Env, accountId: string): Promise<WebhookRow[]> {
  const res = await env.CHASA_DB.prepare(
    `SELECT id, account_id, url, created_at FROM webhooks WHERE account_id = ? ORDER BY created_at DESC`
  )
    .bind(accountId)
    .all<WebhookRow>();
  return res.results ?? [];
}

export async function createWebhook(env: Env, accountId: string, url: string): Promise<WebhookRow> {
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  await env.CHASA_DB.prepare(
    `INSERT INTO webhooks (id, account_id, url, created_at) VALUES (?, ?, ?, ?)`
  )
    .bind(id, accountId, url, created_at)
    .run();
  return { id, account_id: accountId, url, created_at };
}

export async function deleteWebhook(env: Env, accountId: string, id: string): Promise<boolean> {
  const res = await env.CHASA_DB.prepare(`DELETE FROM webhooks WHERE id = ? AND account_id = ?`)
    .bind(id, accountId)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

export async function dispatchWebhooks(
  env: Env,
  accountId: string,
  event: WebhookEvent,
  data: Record<string, unknown> = {}
): Promise<void> {
  const hooks = await listWebhooks(env, accountId);
  if (hooks.length === 0) return;

  const payload = JSON.stringify({
    event,
    created_at: new Date().toISOString(),
    data,
  });

  await Promise.allSettled(
    hooks.map(async (hook) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        await fetch(hook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Chasa-Webhooks/1.0",
            "X-Chasa-Event": event,
          },
          body: payload,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    })
  );
}

export function isValidWebhookUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    // Block obvious local/metadata targets in production-ish fashion
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") return false;
    if (host.endsWith(".local") || host === "::1") return false;
    return true;
  } catch {
    return false;
  }
}
