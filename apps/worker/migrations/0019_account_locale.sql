-- Every transactional email was English-only, and there was no field to know which language an
-- account even prefers. locale is captured once (Accept-Language on first magic-link request, or
-- an explicit site-language hint from the marketing pages) and then left alone — see
-- lib/locale.ts's setAccountLocale, same set-once pattern as stripe_customer_id.
ALTER TABLE accounts ADD COLUMN locale TEXT;
