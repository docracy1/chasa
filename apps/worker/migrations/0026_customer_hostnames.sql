-- Customer custom-domain SSL via Cloudflare for SaaS (Custom Hostnames). Cloudflare issues and
-- renews the certificate and holds the private key — chasa never generates, sees, or stores one,
-- so there is no key-custody column here by design.
CREATE TABLE customer_hostnames (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL UNIQUE,
  cf_custom_hostname_id TEXT,          -- Cloudflare's id for this custom hostname, once created
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'active' | 'error' | 'deleted'
  ssl_status TEXT,                      -- last-known Cloudflare ssl.status (pending_validation, active, ...)
  verification_errors TEXT,             -- JSON array of human-readable error strings, if any
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_customer_hostnames_account ON customer_hostnames(account_id);
