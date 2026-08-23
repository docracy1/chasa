-- Widens marketplace_templates beyond chase emails to documents (contracts, agreements, etc.).
-- template_type discriminates rendering/validation; email rows keep using subject/body exactly
-- as before (default 'email' means zero backfill needed on existing rows).
ALTER TABLE marketplace_templates ADD COLUMN template_type TEXT NOT NULL DEFAULT 'email';

-- Markdown body for document templates. subject/body stay NOT NULL for schema-compat with old
-- rows; document submissions store '' in subject/body and put content here instead of relaxing
-- those NOT NULL constraints (avoids touching every existing INSERT/SELECT path).
ALTER TABLE marketplace_templates ADD COLUMN body_markdown TEXT;

-- Distinct from `featured` (admin curation/promotion) — this is an attested-expert credential,
-- set only by an admin at approval time, never submitter-supplied.
ALTER TABLE marketplace_templates ADD COLUMN verified_expert INTEGER NOT NULL DEFAULT 0;
ALTER TABLE marketplace_templates ADD COLUMN expert_credential TEXT;

CREATE INDEX idx_marketplace_templates_type ON marketplace_templates(template_type, status, submitted_at);

-- Kit membership lives entirely in template_kit_items (no kit_id column on marketplace_templates)
-- so a template can belong to more than one kit without a second source of truth.
CREATE TABLE template_kits (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  featured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE template_kit_items (
  kit_id TEXT NOT NULL REFERENCES template_kits(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL REFERENCES marketplace_templates(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (kit_id, template_id)
);
