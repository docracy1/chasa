import type { Env } from "../types";

export type ChaseEventType =
  | "drafted"
  | "sent"
  | "copied"
  | "mailto"
  | "marked_paid"
  | "reply_detected"
  | "note";

export type ChaseChannel = "email" | "sms" | "whatsapp" | "system";

export type ChaseEvent = {
  id: string;
  agingInvoiceId: string | null;
  clientName: string;
  eventType: ChaseEventType;
  channel: ChaseChannel;
  subject: string | null;
  bodyPreview: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type Row = {
  id: string;
  aging_invoice_id: string | null;
  client_name: string;
  event_type: string;
  channel: string;
  subject: string | null;
  body_preview: string | null;
  metadata: string | null;
  created_at: string;
};

function mapRow(row: Row): ChaseEvent {
  let metadata: Record<string, unknown> | null = null;
  if (row.metadata) {
    try {
      metadata = JSON.parse(row.metadata) as Record<string, unknown>;
    } catch {
      metadata = null;
    }
  }
  return {
    id: row.id,
    agingInvoiceId: row.aging_invoice_id,
    clientName: row.client_name,
    eventType: row.event_type as ChaseEventType,
    channel: row.channel as ChaseChannel,
    subject: row.subject,
    bodyPreview: row.body_preview,
    metadata,
    createdAt: row.created_at,
  };
}

export async function recordChaseEvent(
  env: Env,
  accountId: string,
  input: {
    agingInvoiceId?: string | null;
    clientName: string;
    eventType: ChaseEventType;
    channel?: ChaseChannel;
    subject?: string | null;
    body?: string | null;
    metadata?: Record<string, unknown> | null;
  }
): Promise<ChaseEvent> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const bodyPreview = input.body ? input.body.slice(0, 280) : null;
  const metadata = input.metadata ? JSON.stringify(input.metadata) : null;

  await env.CHASA_DB.prepare(
    `INSERT INTO chase_events
       (id, account_id, aging_invoice_id, client_name, event_type, channel, subject, body_preview, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      accountId,
      input.agingInvoiceId ?? null,
      input.clientName.slice(0, 120),
      input.eventType,
      input.channel ?? "email",
      input.subject?.slice(0, 200) ?? null,
      bodyPreview,
      metadata,
      now
    )
    .run();

  return {
    id,
    agingInvoiceId: input.agingInvoiceId ?? null,
    clientName: input.clientName,
    eventType: input.eventType,
    channel: input.channel ?? "email",
    subject: input.subject?.slice(0, 200) ?? null,
    bodyPreview,
    metadata: input.metadata ?? null,
    createdAt: now,
  };
}

export async function listChaseEvents(
  env: Env,
  accountId: string,
  opts: { agingInvoiceId?: string; clientName?: string; limit?: number } = {}
): Promise<ChaseEvent[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  let sql = `SELECT id, aging_invoice_id, client_name, event_type, channel, subject, body_preview, metadata, created_at
             FROM chase_events WHERE account_id = ?`;
  const binds: unknown[] = [accountId];

  if (opts.agingInvoiceId) {
    sql += ` AND aging_invoice_id = ?`;
    binds.push(opts.agingInvoiceId);
  }
  if (opts.clientName) {
    sql += ` AND client_name = ?`;
    binds.push(opts.clientName);
  }
  sql += ` ORDER BY created_at DESC LIMIT ?`;
  binds.push(limit);

  const stmt = env.CHASA_DB.prepare(sql);
  const { results } = await stmt.bind(...binds).all<Row>();
  return (results ?? []).map(mapRow);
}
