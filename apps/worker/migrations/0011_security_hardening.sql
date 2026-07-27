-- Security hardening: rate limits, AI usage quotas, Stripe idempotency, tracked link allowlist.

CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,
  processed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);

CREATE TABLE IF NOT EXISTS ai_usage (
  scope_key TEXT NOT NULL,
  month_key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scope_key, month_key)
);

CREATE TABLE IF NOT EXISTS chase_tracking_links (
  id TEXT PRIMARY KEY,
  chase_id TEXT NOT NULL REFERENCES chase_tracking(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chase_tracking_links_chase ON chase_tracking_links(chase_id);
