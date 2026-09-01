import type { Env } from "../types";
import { getCloudAccessToken } from "./cloudConnectors";

export async function isGoogleConnected(env: Env, accountId: string): Promise<boolean> {
  const row = await env.CHASA_DB.prepare(
    `SELECT 1 as hit FROM cloud_connectors WHERE account_id = ? AND provider = 'google'`
  )
    .bind(accountId)
    .first<{ hit: number }>();
  return !!row;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildRawMime(to: string, subject: string, body: string): string {
  return [
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\r\n");
}

async function googleFetch(
  env: Env,
  accountId: string,
  url: string,
  init?: RequestInit
): Promise<Response> {
  const token = await getCloudAccessToken(env, accountId, "google");
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      "Google token expired or missing permission. Disconnect Google on Connectors, then reconnect."
    );
  }
  return res;
}

function normalizeSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const fromUrl = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (fromUrl) return fromUrl[1];
  return trimmed;
}

function quoteSheetTab(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

async function googleApiFetch(
  env: Env,
  accountId: string,
  url: string,
  init?: RequestInit
): Promise<Response> {
  const token = await getCloudAccessToken(env, accountId, "google");
  return fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  });
}

async function throwGoogleApiError(res: Response, action: string): Promise<never> {
  const text = await res.text();
  let detail = text.slice(0, 300);
  try {
    const j = JSON.parse(text) as { error?: { message?: string } };
    if (j.error?.message) detail = j.error.message;
  } catch {
    /* not JSON */
  }
  if (res.status === 401) {
    throw new Error("Google token expired. Disconnect and reconnect Google on Connectors.");
  }
  throw new Error(`${action} failed (${res.status}): ${detail}`);
}

async function assertSpreadsheetFile(
  env: Env,
  accountId: string,
  spreadsheetId: string
): Promise<void> {
  const res = await googleApiFetch(
    env,
    accountId,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheetId)}?fields=mimeType,name`
  );
  if (!res.ok) {
    await throwGoogleApiError(res, "Drive lookup");
  }
  const file = (await res.json()) as { mimeType?: string; name?: string };
  if (file.mimeType === "application/vnd.google-apps.spreadsheet") return;
  if (file.mimeType === "application/pdf") {
    throw new Error(
      "That ID is a PDF in Drive, not a Google Sheet. Paste the Sheet ID from docs.google.com/spreadsheets/d/… or use Open from Drive for PDFs."
    );
  }
  throw new Error(
    `That Drive file is not a Google Sheet (${file.mimeType ?? "unknown type"}). Use a Sheets URL or spreadsheet ID.`
  );
}

async function defaultSheetImportRange(
  env: Env,
  accountId: string,
  spreadsheetId: string
): Promise<string> {
  const res = await googleApiFetch(
    env,
    accountId,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`
  );
  if (!res.ok) {
    await throwGoogleApiError(res, "Sheets metadata");
  }
  const data = (await res.json()) as { sheets?: Array<{ properties?: { title?: string } }> };
  const title = data.sheets?.[0]?.properties?.title;
  if (!title) throw new Error("Spreadsheet has no tabs.");
  return `${quoteSheetTab(title)}!A1:C500`;
}

export async function createGmailDraft(
  env: Env,
  accountId: string,
  input: { to: string; subject: string; body: string }
): Promise<{ ok: true; draftId: string }> {
  const to = input.to.trim();
  if (!to.includes("@")) throw new Error("Recipient email is required.");
  const raw = buildRawMime(to, input.subject.slice(0, 500), input.body.slice(0, 8000));
  const encoded = base64UrlEncode(new TextEncoder().encode(raw));
  const res = await googleFetch(env, accountId, "https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: { raw: encoded } }),
  });
  if (!res.ok) throw new Error(`Gmail draft failed (${res.status})`);
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error("Gmail draft created but no id returned.");
  return { ok: true, draftId: json.id };
}

export type SheetImportRow = { clientName: string; amount: number; dueDate: string };

function parseSheetAmount(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  let t = s.replace(/[^\d.,-]/g, "");
  if (!t) return null;
  // European thousands + decimal: 1.234,56 → 1234.56
  if (/,\d{1,2}$/.test(t) && t.includes(".")) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (/,\d{1,2}$/.test(t)) {
    t = t.replace(",", ".");
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseSheetDueDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, "0");
    const month = dmy[2].padStart(2, "0");
    const year = dmy[3];
    return `${year}-${month}-${day}`;
  }
  // Google Sheets serial date (unformatted number cell)
  if (/^\d+(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (serial > 20_000 && serial < 100_000) {
      const epoch = Date.UTC(1899, 11, 30);
      const dt = new Date(epoch + serial * 86_400_000);
      if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
    }
  }
  return null;
}

function isHeaderRow(clientName: string): boolean {
  return /client|kunde|name|amount|betrag|due|datum|date|vencimiento/i.test(clientName);
}

export async function importInvoicesFromSheet(
  env: Env,
  accountId: string,
  spreadsheetId: string,
  range?: string
): Promise<{ rows: SheetImportRow[]; skipped: number }> {
  const id = normalizeSpreadsheetId(spreadsheetId);
  if (id.length < 10) throw new Error("Enter a Google Sheet ID or full Sheets URL.");

  await assertSpreadsheetFile(env, accountId, id);

  const rangeToUse =
    range && range.trim() && range !== "Sheet1!A1:C500"
      ? range.trim()
      : await defaultSheetImportRange(env, accountId, id);

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values/${encodeURIComponent(rangeToUse)}`;
  const res = await googleApiFetch(env, accountId, url);
  if (!res.ok) {
    await throwGoogleApiError(res, "Sheets read");
  }
  const data = (await res.json()) as { values?: string[][] };
  const rows: SheetImportRow[] = [];
  let skipped = 0;
  for (let i = 0; i < (data.values ?? []).length; i++) {
    const row = data.values![i];
    if (!row || row.length < 3) {
      skipped++;
      continue;
    }
    const clientName = row[0]?.trim() ?? "";
    const amount = parseSheetAmount(row[1] ?? "");
    const dueDate = parseSheetDueDate(row[2] ?? "") ?? "";
    if (!clientName || amount === null || !dueDate) {
      if (i === 0 && isHeaderRow(clientName)) continue;
      skipped++;
      continue;
    }
    rows.push({ clientName, amount, dueDate });
  }
  if (rows.length === 0 && (data.values?.length ?? 0) > 0) {
    throw new Error(
      "No invoice rows found. Use columns A=Client, B=Amount, C=Due date (e.g. 2026-08-15 or 15.08.2026)."
    );
  }
  return { rows, skipped };
}

export async function exportAgingToSheet(
  env: Env,
  accountId: string,
  title: string,
  rows: Array<{ clientName: string; amount: number; dueDate: string; status?: string }>
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const createRes = await googleFetch(env, accountId, "https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: { title: (title.trim() || "docstoc aging export").slice(0, 80) },
      sheets: [{ properties: { title: "Aging" } }],
    }),
  });
  if (!createRes.ok) throw new Error(`Sheets create failed (${createRes.status})`);
  const created = (await createRes.json()) as { spreadsheetId?: string; spreadsheetUrl?: string };
  if (!created.spreadsheetId) throw new Error("Spreadsheet created but id missing.");
  const values = [
    ["Client", "Amount", "Due date", "Status"],
    ...rows.map((r) => [r.clientName, String(r.amount), r.dueDate, r.status ?? "open"]),
  ];
  const updateRes = await googleFetch(
    env,
    accountId,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(created.spreadsheetId)}/values/Aging!A1?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    }
  );
  if (!updateRes.ok) throw new Error(`Sheets write failed (${updateRes.status})`);
  return {
    spreadsheetId: created.spreadsheetId,
    spreadsheetUrl:
      created.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}`,
  };
}

export async function syncReminderToCalendar(
  env: Env,
  accountId: string,
  input: { summary: string; date: string; description?: string; clientName?: string }
): Promise<{ eventId: string; htmlLink: string | null }> {
  const summary =
    input.summary.slice(0, 200) || `docstoc reminder${input.clientName ? `: ${input.clientName}` : ""}`;
  const res = await googleFetch(
    env,
    accountId,
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary,
        description: (input.description ?? "Planned chase reminder from docstoc.").slice(0, 4000),
        start: { date: input.date },
        end: { date: input.date },
      }),
    }
  );
  if (!res.ok) throw new Error(`Calendar event failed (${res.status})`);
  const json = (await res.json()) as { id?: string; htmlLink?: string };
  if (!json.id) throw new Error("Calendar event created but id missing.");
  return { eventId: json.id, htmlLink: json.htmlLink ?? null };
}

export async function findLatestClientReply(
  env: Env,
  accountId: string,
  input: { clientEmail?: string | null; clientName: string }
): Promise<{ found: boolean; snippet: string | null; subject: string | null; date: string | null }> {
  const parts = ["in:inbox"];
  const email = input.clientEmail?.trim();
  if (email?.includes("@")) parts.push(`from:${email}`);
  else parts.push(`"${input.clientName.replace(/"/g, "")}"`);
  const listRes = await googleFetch(
    env,
    accountId,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(parts.join(" "))}&maxResults=5`
  );
  if (!listRes.ok) throw new Error(`Gmail search failed (${listRes.status})`);
  const list = (await listRes.json()) as { messages?: Array<{ id: string }> };
  const first = list.messages?.[0];
  if (!first?.id) return { found: false, snippet: null, subject: null, date: null };
  const msgRes = await googleFetch(
    env,
    accountId,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(first.id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=Date`
  );
  if (!msgRes.ok) return { found: false, snippet: null, subject: null, date: null };
  const msg = (await msgRes.json()) as {
    snippet?: string;
    payload?: { headers?: Array<{ name?: string; value?: string }> };
  };
  let subject: string | null = null;
  let date: string | null = null;
  for (const h of msg.payload?.headers ?? []) {
    if (h.name === "Subject") subject = h.value ?? null;
    if (h.name === "Date") date = h.value ?? null;
  }
  return { found: true, snippet: msg.snippet ?? null, subject, date };
}

export async function importGoogleContacts(
  env: Env,
  accountId: string
): Promise<{ imported: number; skipped: number }> {
  const url = new URL("https://people.googleapis.com/v1/people/me/connections");
  url.searchParams.set("personFields", "names,emailAddresses");
  url.searchParams.set("pageSize", "1000");
  url.searchParams.set("sortOrder", "LAST_MODIFIED_DESCENDING");
  const res = await googleFetch(env, accountId, url.toString());
  if (!res.ok) throw new Error(`Google People API error (${res.status})`);
  const data = (await res.json()) as {
    connections?: Array<{
      names?: Array<{ displayName?: string }>;
      emailAddresses?: Array<{ value?: string }>;
    }>;
  };
  let imported = 0;
  let skipped = 0;
  for (const person of data.connections ?? []) {
    const name = person.names?.[0]?.displayName?.trim();
    const email = person.emailAddresses?.[0]?.value?.trim().toLowerCase();
    if (!name || !email?.includes("@")) {
      skipped++;
      continue;
    }
    const existing = await env.CHASA_DB.prepare(
      `SELECT id FROM clients WHERE account_id = ? AND email = ?`
    )
      .bind(accountId, email)
      .first<{ id: string }>();
    if (existing) {
      skipped++;
      continue;
    }
    const now = new Date().toISOString();
    await env.CHASA_DB.prepare(
      `INSERT INTO clients (id, account_id, name, email, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(crypto.randomUUID(), accountId, name.slice(0, 200), email.slice(0, 200), null, now, now)
      .run();
    imported++;
  }
  return { imported, skipped };
}
