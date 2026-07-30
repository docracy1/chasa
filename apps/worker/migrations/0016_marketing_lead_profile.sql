-- Optional profile fields for the templates PDF lead form.

ALTER TABLE marketing_leads ADD COLUMN first_name TEXT;
ALTER TABLE marketing_leads ADD COLUMN role TEXT;
ALTER TABLE marketing_leads ADD COLUMN invoice_tool TEXT;
