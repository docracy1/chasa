import type { Env } from "../types";

export type ReminderStatus = "planned" | "done" | "skipped";

export type ChaseReminder = {
  id: string;
  agingInvoiceId: string | null;
  clientName: string;
  stepNumber: number;
  plannedDate: string;
  label: string | null;
  subject: string | null;
  body: string | null;
  status: ReminderStatus;
  createdAt: string;
  updatedAt: string;
};

type ReminderRow = {
  id: string;
  aging_invoice_id: string | null;
  client_name: string;
  step_number: number;
  planned_date: string;
  label: string | null;
  subject: string | null;
  body: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

function mapRow(row: ReminderRow): ChaseReminder {
  const status: ReminderStatus =
    row.status === "done" || row.status === "skipped" ? row.status : "planned";
  return {
    id: row.id,
    agingInvoiceId: row.aging_invoice_id,
    clientName: row.client_name,
    stepNumber: row.step_number,
    plannedDate: row.planned_date,
    label: row.label,
    subject: row.subject,
    body: row.body,
    status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function addDaysIso(daysFromNow: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + Math.max(0, daysFromNow));
  return d.toISOString().slice(0, 10);
}

export async function listReminders(
  env: Env,
  accountId: string,
  opts?: { from?: string; to?: string; status?: string }
): Promise<ChaseReminder[]> {
  let sql = `SELECT id, aging_invoice_id, client_name, step_number, planned_date, label, subject, body, status, created_at, updated_at
             FROM chase_reminders WHERE account_id = ?`;
  const binds: (string | number)[] = [accountId];
  if (opts?.from) {
    sql += ` AND planned_date >= ?`;
    binds.push(opts.from);
  }
  if (opts?.to) {
    sql += ` AND planned_date <= ?`;
    binds.push(opts.to);
  }
  if (opts?.status === "planned" || opts?.status === "done" || opts?.status === "skipped") {
    sql += ` AND status = ?`;
    binds.push(opts.status);
  }
  sql += ` ORDER BY planned_date ASC, step_number ASC`;

  const { results } = await env.CHASA_DB.prepare(sql).bind(...binds).all<ReminderRow>();
  return (results ?? []).map(mapRow);
}

export async function replaceSequenceReminders(
  env: Env,
  accountId: string,
  input: {
    agingInvoiceId?: string | null;
    clientName: string;
    steps: Array<{
      step: number;
      daysFromNow: number;
      label: string;
      subject: string;
      body: string;
    }>;
  }
): Promise<ChaseReminder[]> {
  const now = new Date().toISOString();
  if (input.agingInvoiceId) {
    await env.CHASA_DB.prepare(
      `DELETE FROM chase_reminders WHERE account_id = ? AND aging_invoice_id = ? AND status = 'planned'`
    )
      .bind(accountId, input.agingInvoiceId)
      .run();
  }

  const saved: ChaseReminder[] = [];
  for (const step of input.steps.slice(0, 5)) {
    const id = crypto.randomUUID();
    const plannedDate = addDaysIso(step.daysFromNow);
    await env.CHASA_DB.prepare(
      `INSERT INTO chase_reminders
         (id, account_id, aging_invoice_id, client_name, step_number, planned_date, label, subject, body, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned', ?, ?)`
    )
      .bind(
        id,
        accountId,
        input.agingInvoiceId ?? null,
        input.clientName,
        step.step,
        plannedDate,
        step.label,
        step.subject,
        step.body,
        now,
        now
      )
      .run();
    saved.push({
      id,
      agingInvoiceId: input.agingInvoiceId ?? null,
      clientName: input.clientName,
      stepNumber: step.step,
      plannedDate,
      label: step.label,
      subject: step.subject,
      body: step.body,
      status: "planned",
      createdAt: now,
      updatedAt: now,
    });
  }
  return saved;
}

export async function updateReminderStatus(
  env: Env,
  accountId: string,
  id: string,
  status: ReminderStatus
): Promise<ChaseReminder | null> {
  const now = new Date().toISOString();
  const result = await env.CHASA_DB.prepare(
    `UPDATE chase_reminders SET status = ?, updated_at = ? WHERE id = ? AND account_id = ?`
  )
    .bind(status, now, id, accountId)
    .run();
  if (!result.meta.changes) return null;
  const row = await env.CHASA_DB.prepare(
    `SELECT id, aging_invoice_id, client_name, step_number, planned_date, label, subject, body, status, created_at, updated_at
     FROM chase_reminders WHERE id = ? AND account_id = ?`
  )
    .bind(id, accountId)
    .first<ReminderRow>();
  return row ? mapRow(row) : null;
}

export async function nextPlannedReminder(
  env: Env,
  accountId: string,
  agingInvoiceId?: string | null
): Promise<ChaseReminder | null> {
  let sql = `SELECT id, aging_invoice_id, client_name, step_number, planned_date, label, subject, body, status, created_at, updated_at
             FROM chase_reminders
             WHERE account_id = ? AND status = 'planned'`;
  const binds: string[] = [accountId];
  if (agingInvoiceId) {
    sql += ` AND aging_invoice_id = ?`;
    binds.push(agingInvoiceId);
  }
  sql += ` ORDER BY planned_date ASC, step_number ASC LIMIT 1`;
  const row = await env.CHASA_DB.prepare(sql).bind(...binds).first<ReminderRow>();
  return row ? mapRow(row) : null;
}

export async function snoozeReminder(
  env: Env,
  accountId: string,
  id: string,
  days: number
): Promise<ChaseReminder | null> {
  const row = await env.CHASA_DB.prepare(
    `SELECT id, aging_invoice_id, client_name, step_number, planned_date, label, subject, body, status, created_at, updated_at
     FROM chase_reminders WHERE id = ? AND account_id = ? AND status = 'planned'`
  )
    .bind(id, accountId)
    .first<ReminderRow>();

  if (!row) return null;

  const d = new Date(row.planned_date + "T12:00:00");
  d.setDate(d.getDate() + Math.max(1, days));
  const newDate = d.toISOString().slice(0, 10);
  const now = new Date().toISOString();

  await env.CHASA_DB.prepare(
    `UPDATE chase_reminders SET planned_date = ?, updated_at = ? WHERE id = ? AND account_id = ?`
  )
    .bind(newDate, now, id, accountId)
    .run();

  return mapRow({ ...row, planned_date: newDate, updated_at: now });
}

export async function scheduleFollowUpReminder(
  env: Env,
  accountId: string,
  input: {
    agingInvoiceId?: string | null;
    clientName: string;
    daysFromNow: number;
    label: string;
    subject: string;
    body: string;
  }
): Promise<ChaseReminder> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const plannedDate = addDaysIso(input.daysFromNow);
  const stepNumber = 99;

  await env.CHASA_DB.prepare(
    `INSERT INTO chase_reminders
       (id, account_id, aging_invoice_id, client_name, step_number, planned_date, label, subject, body, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned', ?, ?)`
  )
    .bind(
      id,
      accountId,
      input.agingInvoiceId ?? null,
      input.clientName,
      stepNumber,
      plannedDate,
      input.label,
      input.subject,
      input.body,
      now,
      now
    )
    .run();

  return {
    id,
    agingInvoiceId: input.agingInvoiceId ?? null,
    clientName: input.clientName,
    stepNumber,
    plannedDate,
    label: input.label,
    subject: input.subject,
    body: input.body,
    status: "planned",
    createdAt: now,
    updatedAt: now,
  };
}
