import type { Env } from "../types";

type ReminderRow = {
  id: string;
  client_name: string;
  planned_date: string;
  label: string;
  subject: string;
  aging_invoice_id: string | null;
  body: string | null;
};

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function alreadySentToday(lastSent: string | null): boolean {
  if (!lastSent) return false;
  return lastSent.slice(0, 10) === todayUtc();
}

function mailtoLink(to: string | null, subject: string, body: string): string {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body.slice(0, 1800));
  const qs = params.toString();
  const addr = to?.trim() || "";
  return `mailto:${addr}${qs ? `?${qs}` : ""}`;
}

async function clientEmailForReminder(
  env: Env,
  accountId: string,
  reminder: ReminderRow
): Promise<string | null> {
  if (reminder.aging_invoice_id) {
    const row = await env.CHASA_DB.prepare(
      `SELECT c.email FROM clients c
       JOIN aging_invoices a ON a.client_id = c.id
       WHERE a.id = ? AND a.account_id = ? AND c.email IS NOT NULL`
    )
      .bind(reminder.aging_invoice_id, accountId)
      .first<{ email: string }>();
    if (row?.email) return row.email;
  }
  const byName = await env.CHASA_DB.prepare(
    `SELECT email FROM clients WHERE account_id = ? AND name = ? AND email IS NOT NULL LIMIT 1`
  )
    .bind(accountId, reminder.client_name)
    .first<{ email: string }>();
  return byName?.email ?? null;
}

async function sendDigestEmail(
  env: Env,
  accountId: string,
  email: string,
  reminders: ReminderRow[]
): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.log(`[digest] ${email}: ${reminders.length} chase(s) due today (no RESEND_API_KEY)`);
    return true;
  }

  const appUrl = env.PUBLIC_APP_URL.replace(/\/$/, "");
  const blocks: string[] = [];

  for (const r of reminders) {
    const clientEmail = await clientEmailForReminder(env, accountId, r);
    const subject = r.subject || `Follow up: ${r.client_name}`;
    const body = r.body || "";
    const mailto = mailtoLink(clientEmail, subject, body);
    const preview = body.slice(0, 280).replace(/</g, "&lt;").replace(/\n/g, "<br>");
    const deepLink = r.aging_invoice_id
      ? `${appUrl}/app/?focus=${encodeURIComponent(r.aging_invoice_id)}`
      : `${appUrl}/app/`;

    blocks.push(`<div style="margin-bottom:20px;padding:14px;border:1px solid #ddd;border-radius:8px">
      <p style="margin:0 0 6px"><strong>${r.client_name.replace(/</g, "&lt;")}</strong> — ${r.label.replace(/</g, "&lt;")}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#555">Subject: ${subject.replace(/</g, "&lt;")}</p>
      ${preview ? `<p style="margin:0 0 10px;font-size:13px;line-height:1.45">${preview}${body.length > 280 ? "…" : ""}</p>` : ""}
      <p style="margin:0;font-size:14px">
        <a href="${mailto}">Open in email app (review &amp; send)</a>
        · <a href="${deepLink}">Open in Chasa</a>
      </p>
    </div>`);
  }

  const html = `<p>Good morning — <strong>${reminders.length}</strong> planned chase step(s) are due today. Chasa never auto-sends; tap a link to review and send from your inbox:</p>
${blocks.join("\n")}
<p style="color:#666;font-size:13px;margin-top:20px">Turn off daily digests in Account settings.</p>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Chasa <login@chasa.io>",
      to: [email],
      subject: `${reminders.length} invoice follow-up${reminders.length === 1 ? "" : "s"} ready to send — Chasa`,
      html,
    }),
  });

  if (!res.ok) {
    console.error(`[digest] Resend failed for ${email}: ${res.status}`);
    return false;
  }
  return true;
}

/** Daily cron: email Solo+ users who have planned reminders due today (approve-to-send). */
export async function sendDailyChaseDigests(env: Env): Promise<{ sent: number; skipped: number }> {
  const today = todayUtc();
  let sent = 0;
  let skipped = 0;

  const { results: accounts } = await env.CHASA_DB.prepare(
    `SELECT a.id, a.email, a.digest_enabled, a.digest_last_sent
     FROM accounts a
     WHERE a.is_paid = 1 AND a.digest_enabled = 1`
  ).all<{
    id: string;
    email: string;
    digest_enabled: number;
    digest_last_sent: string | null;
  }>();

  for (const acc of accounts ?? []) {
    if (alreadySentToday(acc.digest_last_sent)) {
      skipped++;
      continue;
    }

    const { results: reminders } = await env.CHASA_DB.prepare(
      `SELECT id, client_name, planned_date, label, subject, aging_invoice_id, body
       FROM chase_reminders
       WHERE account_id = ? AND status = 'planned' AND planned_date = ?
       ORDER BY client_name ASC`
    )
      .bind(acc.id, today)
      .all<ReminderRow>();

    if (!reminders?.length) {
      skipped++;
      continue;
    }

    const ok = await sendDigestEmail(env, acc.id, acc.email, reminders);
    if (!ok) continue;

    await env.CHASA_DB.prepare(`UPDATE accounts SET digest_last_sent = ? WHERE id = ?`)
      .bind(new Date().toISOString(), acc.id)
      .run();
    sent++;
  }

  return { sent, skipped };
}
