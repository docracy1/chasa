-- OAuth-connected cloud storage (Dropbox / OneDrive / Box). Tokens encrypted at rest (AES-GCM).
CREATE TABLE cloud_connectors (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('dropbox', 'onedrive', 'box')),
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT,
  expires_at TEXT,
  external_user_id TEXT,
  external_email TEXT,
  connected_at TEXT NOT NULL,
  UNIQUE (account_id, provider)
);
CREATE INDEX idx_cloud_connectors_account ON cloud_connectors(account_id);
