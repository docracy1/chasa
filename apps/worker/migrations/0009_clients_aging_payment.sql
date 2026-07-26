-- Payment link default for drafts (Solo+ branding-style setting).
ALTER TABLE accounts ADD COLUMN payment_link TEXT;

-- Client management (Solo+): contacts + chase notes.
CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  notes TEXT,
  last_contact_note TEXT,
  last_contact_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_clients_account ON clients(account_id);
CREATE INDEX idx_clients_account_name ON clients(account_id, name);

-- Aging rows persisted for paid workspaces (synced from Tool CSV / manual).
CREATE TABLE aging_invoices (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  amount REAL NOT NULL,
  due_date TEXT NOT NULL,
  last_chase_status TEXT,
  last_chase_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_aging_account ON aging_invoices(account_id);
CREATE INDEX idx_aging_client ON aging_invoices(client_id);
