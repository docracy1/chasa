import type { Env } from "../types";

export type LineItem = { description: string; quantity: number; unitPrice: number };

export type Invoice = {
  id: string;
  publicId: string;
  accountId: string;
  agingInvoiceId: string | null;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string | null;
  issueDate: string;
  dueDate: string;
  currency: string;
  lineItems: LineItem[];
  taxRate: number;
  notes: string | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  status: "draft" | "sent" | "paid";
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: string;
  public_id: string;
  account_id: string;
  aging_invoice_id: string | null;
  invoice_number: string;
  client_name: string;
  client_email: string | null;
  issue_date: string;
  due_date: string;
  currency: string;
  line_items: string;
  tax_rate: number;
  notes: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  status: string;
  created_at: string;
  updated_at: string;
};

function rowToInvoice(row: Row): Invoice {
  return {
    id: row.id,
    publicId: row.public_id,
    accountId: row.account_id,
    agingInvoiceId: row.aging_invoice_id,
    invoiceNumber: row.invoice_number,
    clientName: row.client_name,
    clientEmail: row.client_email,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    currency: row.currency,
    lineItems: JSON.parse(row.line_items) as LineItem[],
    taxRate: row.tax_rate,
    notes: row.notes,
    subtotal: row.subtotal,
    taxAmount: row.tax_amount,
    total: row.total,
    status: row.status as Invoice["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const PUBLIC_ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function generatePublicId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let code = "";
  for (const b of bytes) code += PUBLIC_ID_ALPHABET[b % PUBLIC_ID_ALPHABET.length];
  return `INV-${code}`;
}

/** Never trust a client-computed total — always recompute server-side from the line items. */
export function computeTotals(lineItems: LineItem[], taxRate: number): { subtotal: number; taxAmount: number; total: number } {
  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const round = (n: number) => Math.round(n * 100) / 100;
  return { subtotal: round(subtotal), taxAmount: round(taxAmount), total: round(subtotal + taxAmount) };
}

/** Next invoice number for this account — "INV-0001" style, sequential per account, not global. */
async function nextInvoiceNumber(env: Env, accountId: string): Promise<string> {
  const row = await env.CHASA_DB.prepare(
    `SELECT COUNT(*) as count FROM generated_invoices WHERE account_id = ?`
  )
    .bind(accountId)
    .first<{ count: number }>();
  const n = (row?.count ?? 0) + 1;
  return `INV-${String(n).padStart(4, "0")}`;
}

export async function createInvoice(
  env: Env,
  accountId: string,
  input: {
    clientName: string;
    clientEmail: string | null;
    issueDate: string;
    dueDate: string;
    currency: string;
    lineItems: LineItem[];
    taxRate: number;
    notes: string | null;
  }
): Promise<Invoice> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const { subtotal, taxAmount, total } = computeTotals(input.lineItems, input.taxRate);
  const invoiceNumber = await nextInvoiceNumber(env, accountId);

  for (let attempt = 0; attempt < 5; attempt++) {
    const publicId = generatePublicId();
    try {
      await env.CHASA_DB.prepare(
        `INSERT INTO generated_invoices
           (id, public_id, account_id, invoice_number, client_name, client_email, issue_date, due_date, currency, line_items, tax_rate, notes, subtotal, tax_amount, total, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`
      )
        .bind(
          id,
          publicId,
          accountId,
          invoiceNumber,
          input.clientName,
          input.clientEmail,
          input.issueDate,
          input.dueDate,
          input.currency.toUpperCase(),
          JSON.stringify(input.lineItems),
          input.taxRate,
          input.notes,
          subtotal,
          taxAmount,
          total,
          now,
          now
        )
        .run();
      return {
        id,
        publicId,
        accountId,
        agingInvoiceId: null,
        invoiceNumber,
        clientName: input.clientName,
        clientEmail: input.clientEmail,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        currency: input.currency.toUpperCase(),
        lineItems: input.lineItems,
        taxRate: input.taxRate,
        notes: input.notes,
        subtotal,
        taxAmount,
        total,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      };
    } catch (err) {
      if (attempt === 4) throw err;
    }
  }
  throw new Error("Could not allocate an invoice id");
}

export async function listInvoicesForAccount(env: Env, accountId: string): Promise<Invoice[]> {
  const { results } = await env.CHASA_DB.prepare(
    `SELECT * FROM generated_invoices WHERE account_id = ? ORDER BY created_at DESC LIMIT 200`
  )
    .bind(accountId)
    .all<Row>();
  return (results ?? []).map(rowToInvoice);
}

export async function getInvoice(env: Env, accountId: string, id: string): Promise<Invoice | null> {
  const row = await env.CHASA_DB.prepare(`SELECT * FROM generated_invoices WHERE id = ? AND account_id = ?`)
    .bind(id, accountId)
    .first<Row>();
  return row ? rowToInvoice(row) : null;
}

export async function getInvoiceByPublicId(env: Env, publicId: string): Promise<Invoice | null> {
  const row = await env.CHASA_DB.prepare(`SELECT * FROM generated_invoices WHERE public_id = ?`)
    .bind(publicId)
    .first<Row>();
  return row ? rowToInvoice(row) : null;
}

export async function deleteInvoice(env: Env, accountId: string, id: string): Promise<boolean> {
  const result = await env.CHASA_DB.prepare(`DELETE FROM generated_invoices WHERE id = ? AND account_id = ?`)
    .bind(id, accountId)
    .run();
  return !!result.meta.changes;
}

/** Marking an invoice "sent" creates the matching aging_invoices row (if not already linked), so
 *  it flows into the existing chase/dashboard pipeline the moment it's actually sent — not before,
 *  since a draft you haven't sent yet shouldn't show up as something to chase. */
export async function setInvoiceStatus(
  env: Env,
  accountId: string,
  id: string,
  status: "draft" | "sent" | "paid"
): Promise<Invoice | null> {
  const invoice = await getInvoice(env, accountId, id);
  if (!invoice) return null;
  const now = new Date().toISOString();

  let agingInvoiceId = invoice.agingInvoiceId;
  if (status === "sent" && !agingInvoiceId) {
    agingInvoiceId = crypto.randomUUID();
    await env.CHASA_DB.prepare(
      `INSERT INTO aging_invoices (id, account_id, client_id, client_name, amount, due_date, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`
    )
      .bind(agingInvoiceId, accountId, invoice.clientName, invoice.total, invoice.dueDate, now, now)
      .run();
    await env.CHASA_DB.prepare(`UPDATE generated_invoices SET aging_invoice_id = ? WHERE id = ?`)
      .bind(agingInvoiceId, id)
      .run();
  }

  if (status === "paid" && agingInvoiceId) {
    await env.CHASA_DB.prepare(
      `UPDATE aging_invoices SET status = 'paid', paid_at = ?, updated_at = ? WHERE id = ?`
    )
      .bind(now, now, agingInvoiceId)
      .run();
  }

  await env.CHASA_DB.prepare(`UPDATE generated_invoices SET status = ?, updated_at = ? WHERE id = ?`)
    .bind(status, now, id)
    .run();

  return { ...invoice, status, agingInvoiceId, updatedAt: now };
}
