-- Renames the plan tiers: "solo" -> "pro" ($14.99/mo), "pro" -> "business" ($39/mo),
-- "enterprise" -> "business" (folded in; its Stripe price is being converted from a one-time
-- custom price into the new $39/mo recurring Business price). Order matters: old "pro" and
-- "enterprise" are rewritten to "business" FIRST, while "pro" still unambiguously means the old
-- tier — only after that is "solo" rewritten to "pro", so the newly-freed "pro" value can't
-- collide with rows still waiting to become "business".
UPDATE accounts SET plan = 'business' WHERE plan IN ('pro', 'enterprise');
UPDATE accounts SET plan = 'pro' WHERE plan = 'solo';
