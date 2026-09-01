-- One-time onboarding nudge for free accounts with no product activation (~2 days after signup).
ALTER TABLE accounts ADD COLUMN onboarding_nudge_sent_at TEXT;
