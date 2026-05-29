ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS pwa_app_name text,
  ADD COLUMN IF NOT EXISTS pwa_short_name text,
  ADD COLUMN IF NOT EXISTS pwa_icon_192_url text,
  ADD COLUMN IF NOT EXISTS pwa_icon_512_url text,
  ADD COLUMN IF NOT EXISTS pwa_apple_icon_url text,
  ADD COLUMN IF NOT EXISTS pwa_theme_color text,
  ADD COLUMN IF NOT EXISTS pwa_background_color text;