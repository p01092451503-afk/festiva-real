
-- Delete test account
DELETE FROM auth.users WHERE email = 'test@test.co.kr';

-- Reset password and confirm email for 34bus@webheads.co.kr
UPDATE auth.users
SET encrypted_password = extensions.crypt('qpqp1010!!', extensions.gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email = '34bus@webheads.co.kr';

-- Grant super_admin role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::app_role FROM auth.users WHERE email = '34bus@webheads.co.kr'
ON CONFLICT (user_id, role) DO NOTHING;

-- Remove lower roles to keep clean (optional: keep admin too)
DELETE FROM public.user_roles
WHERE user_id = (SELECT id FROM auth.users WHERE email = '34bus@webheads.co.kr')
  AND role IN ('student'::app_role);
