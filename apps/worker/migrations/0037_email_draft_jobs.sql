-- Short-lived async email draft jobs (browser polls GET /api/email-draft/:id).
CREATE TABLE IF NOT EXISTS email_draft_jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  result_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_draft_jobs_expires ON email_draft_jobs(expires_at);
