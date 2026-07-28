-- Bot classification on funnel events. page_views has carried is_bot since 0004, but
-- analytics_events never did, so the admin funnels had no way to tell crawler or scripted
-- traffic from real visitors on either half of a load → click ratio.
--
-- Nullable with no default on purpose: rows written before this migration, and events written
-- with no user agent at all (Resend sends, cron), read as human via COALESCE(is_bot, 0) = 0,
-- so turning the filter on does not silently zero out historical counts.
ALTER TABLE analytics_events ADD COLUMN is_bot INTEGER;
