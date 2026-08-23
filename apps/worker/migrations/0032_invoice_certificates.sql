-- Links a sent invoice to a document certificate (hash of the invoice's exact content), so a
-- recipient can verify an invoice they received hasn't been altered, using the same /verify/
-- checker as any other document certificate.
ALTER TABLE generated_invoices ADD COLUMN certificate_public_id TEXT;
