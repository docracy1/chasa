-- Public roadmap: admin adds/removes proposed features, anyone can vote yes/no with no account
-- needed (deduped by an anonymous voter-id cookie, same convention as docstoc_notrack).
CREATE TABLE roadmap_features (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE roadmap_votes (
  feature_id TEXT NOT NULL,
  voter_id TEXT NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('yes', 'no')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (feature_id, voter_id)
);
CREATE INDEX idx_roadmap_votes_feature ON roadmap_votes(feature_id);

-- Seed with an initial candidate list for the invoice-chase product — real votes decide what
-- actually gets built.
INSERT INTO roadmap_features (id, title, description, created_at) VALUES
  ('mobile-apps', 'Native mobile apps (iOS/Android)', 'Draft and send chases, and check aging, from a real phone app, not just a mobile browser.', '2026-09-03T00:00:00.000Z'),
  ('accounting-sync', 'Two-way accounting sync', 'Push chase status back into QuickBooks/Xero automatically, not just pull invoices in.', '2026-09-03T00:00:00.000Z'),
  ('multi-currency', 'Multi-currency invoices', 'Chase invoices billed in currencies other than your account default, with correct formatting per client.', '2026-09-03T00:00:00.000Z'),
  ('team-roles', 'Team roles & permissions', 'Give teammates view-only or send-only access instead of full account access.', '2026-09-03T00:00:00.000Z'),
  ('custom-domain-email', 'Send chases from your own domain', 'Chase emails sent from you@yourcompany.com via SPF/DKIM, not a shared docstoc address.', '2026-09-03T00:00:00.000Z'),
  ('sms-reminders', 'SMS payment reminders', 'Optional text-message nudges alongside email chases for clients who do not respond to email.', '2026-09-03T00:00:00.000Z'),
  ('partial-payments', 'Partial payment tracking', 'Mark an invoice as partially paid and keep chasing only the remaining balance.', '2026-09-03T00:00:00.000Z'),
  ('client-portal', 'Client self-serve payment portal', 'A link clients can open to pay directly, instead of replying to arrange payment.', '2026-09-03T00:00:00.000Z'),
  ('more-languages', 'More languages beyond English/German', 'French, Spanish, and Italian UI and chase-email templates.', '2026-09-03T00:00:00.000Z'),
  ('zapier-triggers', 'More Zapier triggers', 'Trigger external workflows on chase_sent, chase_opened, and chase_completed, not just new-invoice.', '2026-09-03T00:00:00.000Z'),
  ('reminder-schedule', 'Configurable reminder schedule', 'Choose how often and how aggressively the tone escalates, instead of the fixed default cadence.', '2026-09-03T00:00:00.000Z');
