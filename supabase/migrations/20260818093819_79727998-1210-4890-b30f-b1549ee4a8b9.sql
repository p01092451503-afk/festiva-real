DO $$
DECLARE v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'test@test.co.kr';

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, aud, role
    ) VALUES (
      v_user_id, '00000000-0000-0000-0000-000000000000',
      'test@test.co.kr', crypt('test1234', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"테스트 계정"}'::jsonb,
      'authenticated', 'authenticated'
    );

    INSERT INTO auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_user_id, 'test@test.co.kr', 'email',
      jsonb_build_object('sub', v_user_id::text, 'email', 'test@test.co.kr'),
      now(), now(), now()
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = crypt('test1234', gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = v_user_id;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, position)
  VALUES (v_user_id, '테스트 계정', '테스트')
  ON CONFLICT (user_id) DO UPDATE SET full_name = '테스트 계정';

  INSERT INTO public.user_roles (user_id, role)
  SELECT v_user_id, r
  FROM unnest(ARRAY['super_admin','admin','branch_admin','teacher','student']::app_role[]) AS r
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;