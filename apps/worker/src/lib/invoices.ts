import type { Env } from "../types";
import type { Plan } from "./billing";
import { createCertificate, getCertificateByPublicId, sha256Hex } from "./certificates";

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
  certificatePublicId: string | null;
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
  certificate_public_id: string | null;
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
    certificatePublicId: row.certificate_public_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Deterministic — built from an explicit, fixed field order, not a spread, so the same invoice
 *  content always hashes to the same value regardless of column order in the DB row. */
function canonicalInvoicePayload(invoice: Invoice): string {
  return JSON.stringify({
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    lineItems: invoice.lineItems,
    taxRate: invoice.taxRate,
    notes: invoice.notes,
    subtotal: invoice.subtotal,
    taxAmount: invoice.taxAmount,
    total: invoice.total,
  });
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
        certificatePublicId: null,
        createdAt: now,
        updatedAt: now,
      };
    } catch (err) {
      if (attempt === 4) throw err;
    }
  }
  throw new Error("Could not allocate an invoice id");
}

export type InvoiceCertificateStatus =
  | { certified: false }
  | { certified: true; matches: true; otsStatus: "none" | "pending" | "confirmed" | "failed" }
  | { certified: true; matches: false };

/** Recomputes the invoice's hash from its CURRENT row content and compares it against the hash
 *  that was actually anchored in the certificate. A "Certified" badge is worthless if nothing
 *  ever re-checks it against present-day content — this is what makes a later, out-of-band edit
 *  to the row (a bug, a compromised admin token, a direct DB write) actually detectable instead
 *  of silently invisible. */
export async function checkInvoiceCertificate(env: Env, invoice: Invoice): Promise<InvoiceCertificateStatus> {
  if (!invoice.certificatePublicId) return { certified: false };
  const cert = await getCertificateByPublicId(env, invoice.certificatePublicId);
  if (!cert) return { certified: false };
  const currentHash = await sha256Hex(canonicalInvoicePayload(invoice));
  if (currentHash !== cert.sha256Hash) return { certified: true, matches: false };
  return { certified: true, matches: true, otsStatus: cert.otsStatus };
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

export type SetInvoiceStatusResult = {
  invoice: Invoice;
  /** Set only the moment a certificate is newly created — the route uses this to kick off the
   *  Bitcoin timestamp submission. Certification never re-fires on later status changes since
   *  the invoice's content (and therefore its hash) can't change after creation. */
  newCertificate: { id: string; sha256Hash: string } | null;
};

/** Marking an invoice "sent" creates the matching aging_invoices row (if not already linked), so
 *  it flows into the existing chase/dashboard pipeline the moment it's actually sent — not before,
 *  since a draft you haven't sent yet shouldn't show up as something to chase. It also certifies
 *  the invoice's exact content (SHA-256 hash, Bitcoin-anchored via the existing document
 *  certificate feature) so the recipient can independently verify it hasn't been altered — this
 *  is "sent" and not "created" because a draft that's still being edited shouldn't be certified
 *  before its content is final. */
export async function setInvoiceStatus(
  env: Env,
  accountId: string,
  id: string,
  status: "draft" | "sent" | "paid",
  plan: Plan
): Promise<SetInvoiceStatusResult | null> {
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

  let certificatePublicId = invoice.certificatePublicId;
  let newCertificate: SetInvoiceStatusResult["newCertificate"] = null;
  if (status === "sent" && !certificatePublicId) {
    const sha256Hash = await sha256Hex(canonicalInvoicePayload(invoice));
    const cert = await createCertificate(env, {
      accountId,
      sha256Hash,
      originalFilename: `invoice-${invoice.invoiceNumber}`,
      fileSizeBytes: null,
      issuerName: null,
      plan,
      ipHash: null,
    });
    certificatePublicId = cert.publicId;
    newCertificate = { id: cert.id, sha256Hash: cert.sha256Hash };
    await env.CHASA_DB.prepare(`UPDATE generated_invoices SET certificate_public_id = ? WHERE id = ?`)
      .bind(certificatePublicId, id)
      .run();
  }

  await env.CHASA_DB.prepare(`UPDATE generated_invoices SET status = ?, updated_at = ? WHERE id = ?`)
    .bind(status, now, id)
    .run();

  return {
    invoice: { ...invoice, status, agingInvoiceId, certificatePublicId, updatedAt: now },
    newCertificate,
  };
}
