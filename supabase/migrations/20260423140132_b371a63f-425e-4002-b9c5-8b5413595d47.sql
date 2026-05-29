-- Add b2c_enabled toggle to site_settings to allow admins to hide B2C features
-- (payment management menu, B2C revenue dashboard widget, B2C sale settings on courses)
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS b2c_enabled BOOLEAN NOT NULL DEFAULT true;