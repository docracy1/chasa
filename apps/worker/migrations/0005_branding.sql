-- Workspace branding (paid): logo + short name for app chrome / drafts.
ALTER TABLE accounts ADD COLUMN workspace_name TEXT;
ALTER TABLE accounts ADD COLUMN logo_data TEXT;
