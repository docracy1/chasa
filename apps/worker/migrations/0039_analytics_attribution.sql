-- Persistent first-touch marketing attribution (Docracy parity). Unlike the `referrer` value
-- already captured on referral_source_detected (current navigation only), `attribution` survives
-- across sessions via a long-lived cookie so a signup/checkout weeks later can still be credited
-- to the post/campaign that first brought the visitor in.
--
-- Nullable with no default: historical rows have no first-touch data and should not be treated
-- as "direct" — NULL means "unknown", not "no campaign".
ALTER TABLE analytics_events ADD COLUMN attribution TEXT;
