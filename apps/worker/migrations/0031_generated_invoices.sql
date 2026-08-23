-- Real invoice generation: line items, tax, a shareable/printable public link. Distinct from
-- aging_invoices (which is just an amount + due date for the chasing pipeline) — marking a
-- generated invoice "sent" creates the matching aging_invoices row, so it flows into the existing
-- chase engine once overdue rather than living as a second, disconnected system.
CREATE TABLE generated_invoices (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  aging_invoice_id TEXT REFERENCES aging_invoices(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  issue_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  line_items TEXT NOT NULL,
  tax_rate REAL NOT NULL DEFAULT 0,
  notes TEXT,
  subtotal REAL NOT NULL,
  tax_amount REAL NOT NULL,
  total REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_generated_invoices_public_id ON generated_invoices(public_id);
CREATE INDEX idx_generated_invoices_account ON generated_invoices(account_id, created_at DESC);
