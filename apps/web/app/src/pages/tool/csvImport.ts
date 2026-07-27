import {
  AMOUNT_HEADERS,
  CLIENT_HEADERS,
  DAYS_HEADERS,
  DUE_DATE_HEADERS,
} from "./constants";

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function findCol(headers: string[], candidates: string[]): number {
  const norm = headers.map(normalizeHeader);
  for (const c of candidates) {
    const i = norm.indexOf(c);
    if (i >= 0) return i;
  }
  return -1;
}

export function looksLikeHeaderRow(row: string[]): boolean {
  const joined = row.map(normalizeHeader);
  return (
    CLIENT_HEADERS.some((h) => joined.includes(h)) ||
    AMOUNT_HEADERS.some((h) => joined.includes(h)) ||
    DUE_DATE_HEADERS.some((h) => joined.includes(h)) ||
    DAYS_HEADERS.some((h) => joined.includes(h))
  );
}

function parseAmount(raw: string): number {
  const cleaned = String(raw).replace(/[^0-9.-]/g, "");
  return Number(cleaned);
}

/** Convert days-overdue / aging into a due date (today minus N days). */
function dueDateFromDaysOverdue(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - Math.max(0, Math.round(days)));
  return d.toISOString().slice(0, 10);
}

function parseCsvRow(
  row: string[],
  cols: { client: number; amount: number; due: number; days: number } | null
): { clientName: string; amount: number; dueDate: string } | null {
  let name: string;
  let amtRaw: string;
  let dueRaw: string | undefined;
  let daysRaw: string | undefined;

  if (cols) {
    name = row[cols.client] ?? "";
    amtRaw = row[cols.amount] ?? "";
    dueRaw = cols.due >= 0 ? row[cols.due] : undefined;
    daysRaw = cols.days >= 0 ? row[cols.days] : undefined;
  } else {
    // Legacy Chasa positional: client, amount, due date
    [name, amtRaw, dueRaw] = row;
  }

  if (!name?.trim() || !amtRaw) return null;
  const parsedAmt = parseAmount(amtRaw);
  if (!Number.isFinite(parsedAmt)) return null;

  if (dueRaw?.trim()) {
    const parsedDate = new Date(dueRaw);
    if (!Number.isNaN(parsedDate.getTime())) {
      return {
        clientName: name.trim(),
        amount: parsedAmt,
        dueDate: parsedDate.toISOString().slice(0, 10),
      };
    }
  }

  if (daysRaw?.trim()) {
    const days = Number(String(daysRaw).replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(days)) {
      return {
        clientName: name.trim(),
        amount: parsedAmt,
        dueDate: dueDateFromDaysOverdue(days),
      };
    }
  }

  return null;
}

export function parseCsvRows(
  rows: string[][]
): { clientName: string; amount: number; dueDate: string }[] {
  const filtered = rows.filter((r) => r.some((c) => String(c ?? "").trim()));
  if (filtered.length === 0) return [];

  let dataRows = filtered;
  let cols: { client: number; amount: number; due: number; days: number } | null = null;

  if (looksLikeHeaderRow(filtered[0])) {
    const headers = filtered[0].map((h) => String(h ?? ""));
    const client = findCol(headers, CLIENT_HEADERS);
    const amount = findCol(headers, AMOUNT_HEADERS);
    const due = findCol(headers, DUE_DATE_HEADERS);
    const days = findCol(headers, DAYS_HEADERS);
    dataRows = filtered.slice(1);
    if (client >= 0 && amount >= 0 && (due >= 0 || days >= 0)) {
      cols = { client, amount, due, days };
    }
  }

  const parsed: { clientName: string; amount: number; dueDate: string }[] = [];
  for (const row of dataRows) {
    const result = parseCsvRow(row.map((c) => String(c ?? "")), cols);
    if (result) parsed.push(result);
  }
  return parsed;
}
