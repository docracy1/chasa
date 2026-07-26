-- Named plans beyond the boolean is_paid flag (Solo / Pro / Enterprise).
-- is_paid stays in sync: any non-free plan => is_paid = 1.
ALTER TABLE accounts ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';

UPDATE accounts SET plan = 'solo' WHERE is_paid = 1 AND plan = 'free';
