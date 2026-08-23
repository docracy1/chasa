-- Bitcoin-anchored timestamping for document certificates, via OpenTimestamps
-- (https://opentimestamps.org). The .ots proof is an opaque binary blob we store and re-serve —
-- we never parse or verify it ourselves; that's left to the OpenTimestamps ecosystem's own
-- tools, same trust model as any independently-verifiable proof.
ALTER TABLE document_certificates ADD COLUMN ots_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE document_certificates ADD COLUMN ots_proof_base64 TEXT;
ALTER TABLE document_certificates ADD COLUMN ots_calendar_url TEXT;
ALTER TABLE document_certificates ADD COLUMN ots_submitted_at TEXT;
ALTER TABLE document_certificates ADD COLUMN ots_confirmed_at TEXT;

CREATE INDEX idx_document_certificates_ots_pending ON document_certificates(ots_status) WHERE ots_status = 'pending';
