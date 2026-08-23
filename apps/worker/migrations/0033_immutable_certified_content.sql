-- Once a document is certified/timestamped, its content must be genuinely unchangeable — not
-- just "we'd notice a change," but "the database itself refuses the write." This is enforced with
-- SQLite triggers rather than only application code, because application code can be bypassed by
-- a bug, a compromised admin token, or a direct DB write — a trigger can't be bypassed by any of
-- those without also disabling the trigger itself, which is a distinct, far more visible action.

-- generated_invoices: once certificate_public_id is set (invoice was sent + certified), block any
-- further change to its content or to the certificate link itself. status/updated_at/
-- aging_invoice_id remain writable — those are legitimate post-send bookkeeping, not content.
CREATE TRIGGER prevent_certified_invoice_edit
BEFORE UPDATE ON generated_invoices
WHEN OLD.certificate_public_id IS NOT NULL
  AND (
    NEW.invoice_number IS NOT OLD.invoice_number OR
    NEW.client_name IS NOT OLD.client_name OR
    NEW.client_email IS NOT OLD.client_email OR
    NEW.issue_date IS NOT OLD.issue_date OR
    NEW.due_date IS NOT OLD.due_date OR
    NEW.currency IS NOT OLD.currency OR
    NEW.line_items IS NOT OLD.line_items OR
    NEW.tax_rate IS NOT OLD.tax_rate OR
    NEW.notes IS NOT OLD.notes OR
    NEW.subtotal IS NOT OLD.subtotal OR
    NEW.tax_amount IS NOT OLD.tax_amount OR
    NEW.total IS NOT OLD.total OR
    NEW.certificate_public_id IS NOT OLD.certificate_public_id
  )
BEGIN
  SELECT RAISE(ABORT, 'Cannot modify a certified invoice''s content');
END;

-- A certified invoice can't be deleted either — that would orphan its certificate (a live,
-- Bitcoin-anchored proof pointing at a row that no longer exists).
CREATE TRIGGER prevent_certified_invoice_delete
BEFORE DELETE ON generated_invoices
WHEN OLD.certificate_public_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Cannot delete a certified invoice');
END;

-- document_certificates: the certified fields (the hash itself, above all) must never change
-- after creation — that's the entire trust model. status/revoked_at (revoke flow) and the ots_*
-- columns (Bitcoin timestamp submission/confirmation) are the only legitimate post-creation writes.
CREATE TRIGGER prevent_certificate_content_edit
BEFORE UPDATE ON document_certificates
WHEN NEW.sha256_hash IS NOT OLD.sha256_hash OR
     NEW.original_filename IS NOT OLD.original_filename OR
     NEW.file_size_bytes IS NOT OLD.file_size_bytes OR
     NEW.issuer_name IS NOT OLD.issuer_name OR
     NEW.account_id IS NOT OLD.account_id OR
     NEW.plan_at_creation IS NOT OLD.plan_at_creation OR
     NEW.creator_ip_hash IS NOT OLD.creator_ip_hash OR
     NEW.created_at IS NOT OLD.created_at
BEGIN
  SELECT RAISE(ABORT, 'Cannot modify a certificate''s certified content');
END;

-- Certificates are revoked, never deleted — a delete would erase the record that a hash was ever
-- certified at all, defeating the point of an independently-verifiable proof.
CREATE TRIGGER prevent_certificate_delete
BEFORE DELETE ON document_certificates
BEGIN
  SELECT RAISE(ABORT, 'Certificates cannot be deleted — revoke instead');
END;
