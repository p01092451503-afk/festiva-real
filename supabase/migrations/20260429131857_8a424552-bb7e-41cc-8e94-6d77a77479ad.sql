-- Extend demo_presets with richer client-meeting branding fields
ALTER TABLE public.demo_presets
  ADD COLUMN IF NOT EXISTS login_top_text TEXT,
  ADD COLUMN IF NOT EXISTS login_subtitle TEXT,
  ADD COLUMN IF NOT EXISTS login_form_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS login_form_brand_name TEXT,
  ADD COLUMN IF NOT EXISTS sidebar_brand_name TEXT,
  ADD COLUMN IF NOT EXISTS sidebar_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS accent_hsl TEXT;