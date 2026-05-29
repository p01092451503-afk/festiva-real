ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS teacher_role_enabled boolean NOT NULL DEFAULT true;