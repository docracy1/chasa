CREATE TABLE analytics_events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  properties TEXT,
  visitor_id TEXT,
  account_id TEXT,
  path TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_analytics_events_name_created ON analytics_events(name, created_at);
CREATE INDEX idx_analytics_events_created ON analytics_events(created_at);

CREATE TABLE admin_sessions (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT
);
CREATE INDEX idx_admin_sessions_expires ON admin_sessions(expires_at);
