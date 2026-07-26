-- Outbound webhooks for paid accounts (chase lifecycle notifications).
CREATE TABLE webhooks (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_webhooks_account ON webhooks(account_id);
