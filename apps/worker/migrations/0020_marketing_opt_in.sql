-- Opt-in for product news/update emails, separate from transactional email (magic links, digests,
-- payment-failed alerts, etc. — those aren't gated by this and never were). Default 0: GDPR-cleaner
-- to require an explicit opt-in for non-transactional marketing email rather than opt-out after the
-- fact. unsub_token is generated lazily (on opt-in, or defensively at broadcast-send time) rather
-- than backfilled for every existing row, since accounts that never opt in never need one.
ALTER TABLE accounts ADD COLUMN marketing_opt_in INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN marketing_unsub_token TEXT;
