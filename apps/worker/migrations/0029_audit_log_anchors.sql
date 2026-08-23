-- Decentralized public audit log for chase/invoice events. Each day, per account, we hash that
-- day's chase_events (send/open/click/reply) and chain it to the previous day's hash — a genuine
-- tamper-evident ledger, not just a database column. The chain hash is anchored to Bitcoin via
-- OpenTimestamps (same mechanism as document_certificates), so a business can prove exactly when
-- an invoice was sent/opened/acknowledged without anyone having to trust docstoc's own database.
CREATE TABLE audit_log_anchors (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  period_date TEXT NOT NULL,
  event_count INTEGER NOT NULL,
  events_hash TEXT NOT NULL,
  prev_chain_hash TEXT,
  chain_hash TEXT NOT NULL,
  ots_status TEXT NOT NULL DEFAULT 'none',
  ots_proof_base64 TEXT,
  ots_calendar_url TEXT,
  ots_submitted_at TEXT,
  ots_confirmed_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (account_id, period_date)
);

CREATE INDEX idx_audit_log_anchors_account ON audit_log_anchors(account_id, period_date DESC);
CREATE INDEX idx_audit_log_anchors_pending ON audit_log_anchors(ots_status) WHERE ots_status = 'pending';
