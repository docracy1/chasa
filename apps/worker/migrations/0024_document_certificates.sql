-- Document Trust & Verification: SHA-256 "Certificate of Authenticity" records.
-- account_id is nullable — anonymous/no-signup use is the free lead-magnet path, same
-- pattern as marketplace_templates (0021_marketplace_templates.sql). Raw file bytes are
-- NEVER received by the worker; only the client-computed hash + optional metadata.
CREATE TABLE document_certificates (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  sha256_hash TEXT NOT NULL,
  original_filename TEXT,
  file_size_bytes INTEGER,
  issuer_name TEXT,
  plan_at_creation TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  revoked_at TEXT,
  creator_ip_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_document_certificates_public_id ON document_certificates(public_id);
CREATE INDEX idx_document_certificates_hash ON document_certificates(sha256_hash);
CREATE INDEX idx_document_certificates_account ON document_certificates(account_id, created_at);
