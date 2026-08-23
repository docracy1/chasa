-- "Verified since" trust profile: domain-agnostic proof of when an account first had a
-- docstoc-issued SSL certificate (i.e. proven DNS control of a real domain) go active. The claim
-- itself ("this account was verified as of this date") is anchored to Bitcoin via OpenTimestamps
-- and never changes; the domain and SSL status shown alongside it on the public page are always
-- looked up live from customer_certificates, the same "never freeze a live fact" rule document
-- certificates already follow. One row per account — created once, the first time it qualifies.
CREATE TABLE trust_profiles (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  first_verified_at TEXT NOT NULL,
  profile_hash TEXT NOT NULL,
  ots_status TEXT NOT NULL DEFAULT 'none',
  ots_proof_base64 TEXT,
  ots_calendar_url TEXT,
  ots_submitted_at TEXT,
  ots_confirmed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_trust_profiles_pending ON trust_profiles(ots_status) WHERE ots_status = 'pending';
