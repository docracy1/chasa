-- Competitor-parity features (Solo+): reminders, open tracking, team seats, late fees, QBO/Xero.

ALTER TABLE accounts ADD COLUMN late_fee_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN late_fee_hint TEXT;
-- When set, this account operates inside another workspace (team member).
ALTER TABLE accounts ADD COLUMN workspace_owner_id TEXT REFERENCES accounts(id) ON DELETE SET NULL;

-- Planned chase steps (reminder calendar). User marks done / copy next — never auto-sent.
CREATE TABLE chase_reminders (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  aging_invoice_id TEXT,
  client_name TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  planned_date TEXT NOT NULL,
  label TEXT,
  subject TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_chase_reminders_account ON chase_reminders(account_id);
CREATE INDEX idx_chase_reminders_date ON chase_reminders(account_id, planned_date);
CREATE INDEX idx_chase_reminders_invoice ON chase_reminders(aging_invoice_id);

-- Email open / click tracking (pixel + wrapped links). Only when user uses tracked HTML.
CREATE TABLE chase_tracking (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  aging_invoice_id TEXT,
  client_name TEXT,
  subject TEXT,
  created_at TEXT NOT NULL,
  open_count INTEGER NOT NULL DEFAULT 0,
  click_count INTEGER NOT NULL DEFAULT 0,
  last_open_at TEXT,
  last_click_at TEXT
);
CREATE INDEX idx_chase_tracking_account ON chase_tracking(account_id);
CREATE INDEX idx_chase_tracking_invoice ON chase_tracking(aging_invoice_id);

CREATE TABLE chase_tracking_events (
  id TEXT PRIMARY KEY,
  chase_id TEXT NOT NULL REFERENCES chase_tracking(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  meta TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_chase_tracking_events_chase ON chase_tracking_events(chase_id);

-- Team seats / roles (workspace = owner account).
CREATE TABLE workspace_members (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email TEXT NOT NULL COLLATE NOCASE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'active')),
  invite_token_hash TEXT,
  invited_at TEXT NOT NULL,
  joined_at TEXT,
  UNIQUE (account_id, email)
);
CREATE INDEX idx_workspace_members_account ON workspace_members(account_id);
CREATE INDEX idx_workspace_members_email ON workspace_members(email);

-- Native QuickBooks Online + Xero OAuth (tokens encrypted at rest).
CREATE TABLE accounting_connectors (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('quickbooks', 'xero')),
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT,
  expires_at TEXT,
  realm_id TEXT,
  external_email TEXT,
  connected_at TEXT NOT NULL,
  UNIQUE (account_id, provider)
);
CREATE INDEX idx_accounting_connectors_account ON accounting_connectors(account_id);
