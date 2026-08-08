
ALTER TABLE public.learning_nudge_rules
  ADD COLUMN IF NOT EXISTS cooldown_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS last_sent_count integer NOT NULL DEFAULT 0;
