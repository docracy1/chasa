-- Editorial queue for the Monday SEO blog cron (lib/blogWeekly.ts) — same pattern as Docracy's
-- weekly blog engine. Topics are seeded here; the cron picks the oldest `queued` row, drafts with
-- Workers AI, publishes to blog_posts, then marks the topic `published`.
CREATE TABLE blog_topic_queue (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
  title TEXT NOT NULL,
  -- Short brief for the model: audience, angle, must-cover sections.
  angle TEXT NOT NULL,
  cluster TEXT NOT NULL DEFAULT 'Chasing',
  -- queued | published | skipped
  status TEXT NOT NULL DEFAULT 'queued',
  published_post_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  published_at TEXT
);

CREATE INDEX idx_blog_topic_queue_status_order ON blog_topic_queue(status, sort_order, created_at);

-- ~3 months of Monday posts. Slugs must not collide with the 5 existing static/hand-authored posts.
INSERT INTO blog_topic_queue (id, slug, title, angle, cluster, status, sort_order, created_at) VALUES
('btq_01', 'how-to-ask-a-client-for-payment-without-sounding-desperate', 'How to ask a client for payment without sounding desperate',
 'Audience: freelancers and small agencies chasing a first-time overdue invoice. Cover why the wording matters (tone, not just timing), a warm-but-clear script, common mistakes (over-apologizing, burying the ask, no clear next step), and how Chasa drafts tone-matched follow-ups for free. FAQ (5-7 questions). Not legal or collections advice.',
 'Freelancer', 'queued', 10, '2026-08-18T00:00:00.000Z'),
('btq_02', 'net-30-vs-net-60-payment-terms-for-freelancers', 'Net 30 vs net 60 payment terms: what freelancers should actually offer',
 'Audience: freelancers/consultants setting invoice terms. Explain net-30/net-60/due-on-receipt plainly, cash-flow tradeoffs, how to negotiate shorter terms with new clients, how payment terms interact with late-follow-up timing. FAQ. Not legal advice on enforceability.',
 'Freelancer', 'queued', 20, '2026-08-18T00:00:00.000Z'),
('btq_03', 'how-to-write-a-late-payment-email-that-gets-a-response', 'How to write a late payment email that actually gets a response',
 'Audience: small business owners and freelancers. Cover subject-line tips, structure (context, ask, deadline, easy next step), tone escalation by days overdue, and a short example. Mention Chasa drafts this automatically, free without signup. FAQ + mistakes list.',
 'Chasing', 'queued', 30, '2026-08-18T00:00:00.000Z'),
('btq_04', 'accounts-receivable-basics-for-solo-founders', 'Accounts receivable basics every solo founder should know',
 'Audience: first-time solo founders/freelancers new to invoicing. Explain AR in plain English, aging buckets (current/30/60/90), why tracking matters for cash flow, simple habits (invoice immediately, follow up on a schedule). Light mention of Chasa for the follow-up piece. FAQ. Not accounting advice.',
 'Small Business', 'queued', 40, '2026-08-18T00:00:00.000Z'),
('btq_05', 'how-to-handle-a-client-who-disputes-an-invoice', 'How to handle a client who disputes an invoice',
 'Audience: freelancers/agencies facing pushback on a sent invoice. Cover common dispute reasons (scope, quality, miscommunication), how to respond without escalating, documentation habits, when to involve a contract clause. Mention Chasa has a disputed-invoice response template. FAQ. Not legal advice.',
 'Disputes', 'queued', 50, '2026-08-18T00:00:00.000Z'),
('btq_06', 'invoice-payment-reminder-timing-when-to-send-each-one', 'Invoice payment reminder timing: when to send each follow-up',
 'Audience: freelancers/small teams building a chase cadence. Cover a practical schedule (pre-due, due date, +7, +14, +30, +60, +90), why spacing matters, tone escalation at each stage, automating vs manual sending. Reference Chasa drafting each stage automatically. FAQ.',
 'Chasing', 'queued', 60, '2026-08-18T00:00:00.000Z'),
('btq_07', 'how-freelancers-can-avoid-scope-creep-and-late-payment-together', 'How freelancers can avoid scope creep and late payment at the same time',
 'Audience: freelancers/consultants. Explain how scope creep often correlates with payment friction, contract clauses that help (change orders, milestone billing), invoicing per-milestone instead of one lump sum, and following up promptly. Light Chasa mention for the follow-up half. FAQ. Not legal advice.',
 'Freelancer', 'queued', 70, '2026-08-18T00:00:00.000Z'),
('btq_08', 'should-you-charge-late-fees-on-overdue-invoices', 'Should you charge late fees on overdue invoices?',
 'Audience: freelancers/small businesses deciding on a late-fee policy. Cover pros/cons, typical rates seen in practice, how/when to disclose late fees upfront (contract or invoice terms), how it affects client relationships, alternatives (early-payment discounts). FAQ. Not legal advice on enforceability by jurisdiction.',
 'Small Business', 'queued', 80, '2026-08-18T00:00:00.000Z'),
('btq_09', 'how-to-follow-up-on-multiple-overdue-invoices-at-once', 'How to follow up when a client has multiple overdue invoices at once',
 'Audience: agencies/freelancers with repeat clients who let several invoices pile up. Cover consolidating into one summary email vs separate follow-ups, tone considerations (this is more serious than one late invoice), practical script. Mention Chasa''s multiple-invoices-summary template. FAQ.',
 'Chasing', 'queued', 90, '2026-08-18T00:00:00.000Z'),
('btq_10', 'freelancer-invoicing-mistakes-that-delay-payment', 'Freelancer invoicing mistakes that delay payment (and how to fix them)',
 'Audience: freelancers/consultants. Cover common mistakes: missing PO numbers, unclear payment instructions, no due date, invoicing too late after delivery, no follow-up plan. Practical fixes for each. Light Chasa mention for the follow-up piece. FAQ.',
 'Freelancer', 'queued', 100, '2026-08-18T00:00:00.000Z'),
('btq_11', 'how-to-set-up-a-payment-plan-with-a-client-who-cant-pay-in-full', 'How to set up a payment plan with a client who can''t pay in full',
 'Audience: freelancers/small agencies. Cover when a payment plan makes sense vs pursuing collections, how to structure one (amounts, dates, written confirmation), keeping the relationship intact. Mention Chasa''s payment-plan-offer template. FAQ. Not legal or financial advice.',
 'Chasing', 'queued', 110, '2026-08-18T00:00:00.000Z'),
('btq_12', 'quickbooks-vs-manual-invoice-follow-up-whats-actually-faster', 'QuickBooks vs manual invoice follow-up: what''s actually faster',
 'Audience: small business owners comparing their current process. Cover what QuickBooks/Xero automated reminders actually do (fixed templates, sent from the platform, not tone-matched), what manual follow-up costs in time, where a tool like Chasa fits (AI-drafted, sent from your own inbox). Honest, not oversold. FAQ.',
 'Comparison', 'queued', 120, '2026-08-18T00:00:00.000Z');
