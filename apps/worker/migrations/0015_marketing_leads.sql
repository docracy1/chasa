-- Marketing leads for gated free-template PDF downloads (not workspace AR clients).

CREATE TABLE IF NOT EXISTS marketing_leads (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  source TEXT NOT NULL DEFAULT 'templates-pdf',
  unsub_token TEXT NOT NULL UNIQUE,
  welcome_sent_at TEXT,
  unsubscribed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_leads_email ON marketing_leads(email);
CREATE INDEX IF NOT EXISTS idx_marketing_leads_source ON marketing_leads(source);
