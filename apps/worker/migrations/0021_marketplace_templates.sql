-- Community-submitted chase email templates, shown alongside the hand-authored 18 at
-- /free-templates/ once approved. Every row starts 'pending' — there is no auto-publish path,
-- an admin has to explicitly approve it (see routes/admin.ts). account_id is nullable so
-- anonymous, no-signup submission is possible, matching how low a bar the free-templates page
-- itself sets (no login required to copy a template).
CREATE TABLE marketplace_templates (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT '',
  tone TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  submitter_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  submitted_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT
);

CREATE INDEX idx_marketplace_templates_status ON marketplace_templates(status, submitted_at);
CREATE INDEX idx_marketplace_templates_account ON marketplace_templates(account_id, submitted_at);
