-- The Stripe webhook previously only reacted to checkout.session.completed and
-- customer.subscription.deleted, so a declined card (invoice.payment_failed) or a plan change made
-- through Stripe's own customer portal (customer.subscription.updated) never touched this column —
-- the account just silently kept its old plan until Stripe gave up retrying and deleted the
-- subscription outright. billing_status tracks the subscription's last-known Stripe status
-- (active / trialing / past_due / unpaid / canceled) so support and the admin dashboard can see a
-- payment problem before it reaches that point. Nullable: free accounts and everything created
-- before this migration have no subscription status to report.
ALTER TABLE accounts ADD COLUMN billing_status TEXT;
