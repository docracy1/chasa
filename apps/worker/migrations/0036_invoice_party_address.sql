-- Business / client address + VAT for invoices (FROM + TO).
ALTER TABLE accounts ADD COLUMN business_address TEXT;
ALTER TABLE accounts ADD COLUMN business_state TEXT;
ALTER TABLE accounts ADD COLUMN business_postal TEXT;
ALTER TABLE accounts ADD COLUMN business_country TEXT;
ALTER TABLE accounts ADD COLUMN business_vat TEXT;

ALTER TABLE clients ADD COLUMN address TEXT;
ALTER TABLE clients ADD COLUMN state TEXT;
ALTER TABLE clients ADD COLUMN postal TEXT;
ALTER TABLE clients ADD COLUMN country TEXT;
ALTER TABLE clients ADD COLUMN vat TEXT;

ALTER TABLE generated_invoices ADD COLUMN client_id TEXT;
ALTER TABLE generated_invoices ADD COLUMN client_address TEXT;
ALTER TABLE generated_invoices ADD COLUMN client_state TEXT;
ALTER TABLE generated_invoices ADD COLUMN client_postal TEXT;
ALTER TABLE generated_invoices ADD COLUMN client_country TEXT;
ALTER TABLE generated_invoices ADD COLUMN client_vat TEXT;
ALTER TABLE generated_invoices ADD COLUMN issuer_name TEXT;
ALTER TABLE generated_invoices ADD COLUMN issuer_address TEXT;
ALTER TABLE generated_invoices ADD COLUMN issuer_state TEXT;
ALTER TABLE generated_invoices ADD COLUMN issuer_postal TEXT;
ALTER TABLE generated_invoices ADD COLUMN issuer_country TEXT;
ALTER TABLE generated_invoices ADD COLUMN issuer_vat TEXT;
