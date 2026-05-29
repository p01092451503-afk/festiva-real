-- Add targeting columns to learning_tracks for region/branch/user assignment
ALTER TABLE public.learning_tracks
  ADD COLUMN IF NOT EXISTS target_scope text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS target_country_codes text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS target_branch_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS target_user_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

CREATE INDEX IF NOT EXISTS idx_learning_tracks_target_country_codes
  ON public.learning_tracks USING GIN (target_country_codes);
CREATE INDEX IF NOT EXISTS idx_learning_tracks_target_branch_ids
  ON public.learning_tracks USING GIN (target_branch_ids);
CREATE INDEX IF NOT EXISTS idx_learning_tracks_target_user_ids
  ON public.learning_tracks USING GIN (target_user_ids);