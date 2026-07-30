import type { Env } from "../types";

export type MarketingLead = {
  id: string;
  email: string;
  source: string;
  first_name: string | null;
  role: string | null;
  invoice_tool: string | null;
  unsub_token: string;
  welcome_sent_at: string | null;
  unsubscribed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadProfile = {
  firstName?: string;
  role?: string;
  invoiceTool?: string;
};

function newId(): string {
  return crypto.randomUUID();
}

function newToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function cleanOptional(value: string | undefined, max: number): string | null {
  const v = (value || "").trim();
  if (!v) return null;
  return v.slice(0, max);
}

export async function upsertTemplatesPackLead(
  env: Env,
  email: string,
  profile: LeadProfile = {}
): Promise<{ lead: MarketingLead; isNew: boolean; resubscribed: boolean }> {
  const normalized = email.trim().toLowerCase();
  const now = new Date().toISOString();
  const firstName = cleanOptional(profile.firstName, 80);
  const role = cleanOptional(profile.role, 80);
  const invoiceTool = cleanOptional(profile.invoiceTool, 80);

  const existing = await env.CHASA_DB.prepare(
    `SELECT * FROM marketing_leads WHERE email = ?`
  )
    .bind(normalized)
    .first<MarketingLead>();

  if (existing) {
    const wasUnsubscribed = Boolean(existing.unsubscribed_at);
    await env.CHASA_DB.prepare(
      `UPDATE marketing_leads SET
         updated_at = ?,
         source = 'templates-pdf',
         unsubscribed_at = NULL,
         first_name = COALESCE(?, first_name),
         role = COALESCE(?, role),
         invoice_tool = COALESCE(?, invoice_tool)
       WHERE id = ?`
    )
      .bind(now, firstName, role, invoiceTool, existing.id)
      .run();
    const refreshed = (await env.CHASA_DB.prepare(`SELECT * FROM marketing_leads WHERE id = ?`)
      .bind(existing.id)
      .first<MarketingLead>())!;
    return { lead: refreshed, isNew: false, resubscribed: wasUnsubscribed };
  }

  const lead: MarketingLead = {
    id: newId(),
    email: normalized,
    source: "templates-pdf",
    first_name: firstName,
    role,
    invoice_tool: invoiceTool,
    unsub_token: newToken(),
    welcome_sent_at: null,
    unsubscribed_at: null,
    created_at: now,
    updated_at: now,
  };

  await env.CHASA_DB.prepare(
    `INSERT INTO marketing_leads
      (id, email, source, first_name, role, invoice_tool, unsub_token, welcome_sent_at, unsubscribed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`
  )
    .bind(
      lead.id,
      lead.email,
      lead.source,
      lead.first_name,
      lead.role,
      lead.invoice_tool,
      lead.unsub_token,
      lead.created_at,
      lead.updated_at
    )
    .run();

  return { lead, isNew: true, resubscribed: false };
}

export async function markWelcomeSent(env: Env, id: string): Promise<void> {
  const now = new Date().toISOString();
  await env.CHASA_DB.prepare(
    `UPDATE marketing_leads SET welcome_sent_at = ?, updated_at = ? WHERE id = ?`
  )
    .bind(now, now, id)
    .run();
}

export async function unsubscribeByToken(
  env: Env,
  token: string
): Promise<"ok" | "missing"> {
  const row = await env.CHASA_DB.prepare(
    `SELECT id FROM marketing_leads WHERE unsub_token = ?`
  )
    .bind(token)
    .first<{ id: string }>();
  if (!row) return "missing";
  const now = new Date().toISOString();
  await env.CHASA_DB.prepare(
    `UPDATE marketing_leads SET unsubscribed_at = ?, updated_at = ? WHERE id = ?`
  )
    .bind(now, now, row.id)
    .run();
  return "ok";
}
