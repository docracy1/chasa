-- Invoice payment status + chase activity timeline + client risk + digest prefs

ALTER TABLE aging_invoices ADD COLUMN status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE aging_invoices ADD COLUMN paid_at TEXT;

CREATE TABLE IF NOT EXISTS chase_events (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  aging_invoice_id TEXT,
  client_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  subject TEXT,
  body_preview TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chase_events_account ON chase_events(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chase_events_invoice ON chase_events(aging_invoice_id);

ALTER TABLE clients ADD COLUMN avg_days_late REAL;
ALTER TABLE clients ADD COLUMN risk_score INTEGER;
ALTER TABLE clients ADD COLUMN paid_invoice_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clients ADD COLUMN late_invoice_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE accounts ADD COLUMN digest_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE accounts ADD COLUMN digest_last_sent TEXT;
