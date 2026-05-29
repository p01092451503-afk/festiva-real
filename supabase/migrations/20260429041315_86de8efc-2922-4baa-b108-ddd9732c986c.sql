UPDATE auth.users
SET 
  encrypted_password = crypt('test1111', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now()
WHERE email IN (
  'branchadmin@test.co.kr',
  'staff1@test.co.kr',
  'staff2@test.co.kr',
  'staff3@test.co.kr',
  'staff4@test.co.kr',
  'staff5@test.co.kr'
);