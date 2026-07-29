-- Allow provider='google' in cloud_connectors CHECK constraint.
-- SQLite can't ALTER CHECK constraints in-place.

CREATE TABLE cloud_connectors_new (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('dropbox', 'onedrive', 'box', 'google')),
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT,
  expires_at TEXT,
  external_user_id TEXT,
  external_email TEXT,
  connected_at TEXT NOT NULL,
  UNIQUE (account_id, provider)
);

INSERT INTO cloud_connectors_new
  (id, account_id, provider, access_token_enc, refresh_token_enc, expires_at,
   external_user_id, external_email, connected_at)
SELECT id, account_id, provider, access_token_enc, refresh_token_enc, expires_at,
       external_user_id, external_email, connected_at
FROM cloud_connectors;

DROP TABLE cloud_connectors;

ALTER TABLE cloud_connectors_new RENAME TO cloud_connectors;

CREATE INDEX idx_cloud_connectors_account ON cloud_connectors(account_id);
