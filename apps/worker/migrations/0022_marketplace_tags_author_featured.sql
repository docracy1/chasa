-- Tags for search-intent coverage, optional author credit + backlink (the actual growth loop —
-- submitters share their own template page because it links back to them, the same mechanic
-- Notion's template gallery uses), and an admin-set featured flag for the marketplace homepage.
-- Every new column is nullable/defaulted so existing pending/approved rows don't need backfill.
ALTER TABLE marketplace_templates ADD COLUMN tags TEXT;
ALTER TABLE marketplace_templates ADD COLUMN submitter_name TEXT;
ALTER TABLE marketplace_templates ADD COLUMN submitter_url TEXT;
ALTER TABLE marketplace_templates ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;
