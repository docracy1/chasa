-- Cloudflare for SaaS (0026_customer_hostnames.sql) required a paid Cloudflare plan — ruled out
-- in favor of a free, hand-rolled ACME (Let's Encrypt) client instead. The table was created but
-- never had a working integration in front of it, so dropping it is safe.
DROP TABLE IF EXISTS customer_hostnames;

-- Single ACME account for the whole chasa deployment (not per-customer) — Let's Encrypt accounts
-- are free but rate-limited per account, so one shared account issuing certs for many customer
-- domains is the normal pattern (same as any ACME-based SaaS).
CREATE TABLE acme_account (
  id TEXT PRIMARY KEY,             -- always 'default' — single row
  account_key_jwk_enc TEXT NOT NULL, -- encrypted JSON: the account's EC P-256 private key (JWK)
  account_url TEXT NOT NULL,
  directory_url TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Per-customer, per-domain certificate lifecycle. cert_key_enc is the only sensitive column —
-- encrypted at rest the same way secretCrypto.ts already encrypts OAuth tokens. cert_pem/
-- chain_pem are public (a certificate is not a secret) and stored in plaintext.
CREATE TABLE customer_certificates (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_dns', -- pending_dns | verifying | issued | expiring | expired | failed
  order_url TEXT,
  dns01_token TEXT,
  dns01_txt_value TEXT,
  cert_key_enc TEXT,
  cert_pem TEXT,
  chain_pem TEXT,
  last_error TEXT,
  issued_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_customer_certificates_account ON customer_certificates(account_id);
CREATE INDEX idx_customer_certificates_expiry ON customer_certificates(expires_at);
