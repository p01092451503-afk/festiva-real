ALTER TABLE public.site_popups
  ADD COLUMN IF NOT EXISTS image_fit text NOT NULL DEFAULT 'cover',
  ADD COLUMN IF NOT EXISTS image_position text NOT NULL DEFAULT 'center';