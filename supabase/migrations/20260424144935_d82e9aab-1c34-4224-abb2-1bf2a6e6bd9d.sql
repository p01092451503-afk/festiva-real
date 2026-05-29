ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS platform_name text DEFAULT 'WEBHEADS SaaS LMS',
  ADD COLUMN IF NOT EXISTS default_language text DEFAULT 'ko',
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Asia/Seoul',
  ADD COLUMN IF NOT EXISTS notify_new_signup boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_assignment_submit boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_completion boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS min_password_length integer DEFAULT 8,
  ADD COLUMN IF NOT EXISTS session_expiry_hours integer DEFAULT 24,
  ADD COLUMN IF NOT EXISTS two_factor_auth boolean DEFAULT false;