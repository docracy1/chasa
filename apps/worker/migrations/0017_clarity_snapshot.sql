-- Cached Microsoft Clarity Data Export API result. Clarity does its own bot filtering and only
-- counts sessions that actually execute its JS tag, which is a different (and often more trusted)
-- read on "real visitors" than our own UA-regex classification on page_views. The Data Export API
-- is rate-limited per project per day, so we fetch once on the daily cron and let the admin
-- dashboard read whatever was last cached instead of calling Clarity on every page load.
--
-- Single row by design (id is always 1) — this is a cache, not a history table. fetch_count_day /
-- fetch_count track calls made today so a manual refresh from the admin UI can never push the
-- account over Clarity's daily cap.
CREATE TABLE clarity_snapshot (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  fetched_at TEXT NOT NULL,
  num_of_days INTEGER NOT NULL,
  raw_json TEXT NOT NULL,
  error TEXT,
  fetch_count_day TEXT NOT NULL,
  fetch_count INTEGER NOT NULL DEFAULT 0
);
