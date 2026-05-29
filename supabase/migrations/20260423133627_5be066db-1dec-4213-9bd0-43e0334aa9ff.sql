
CREATE OR REPLACE FUNCTION public.seed_global_demo_data()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  demo_users jsonb := '[
    {"id":"e0000001-0000-0000-0000-000000000011","email":"demo.kr1@classys-demo.local","name":"김민수","dept":"d0000001-0000-0000-0000-000000000011","pos":"시술자","prog":[100,100,100,100,100,100,90,85]},
    {"id":"e0000001-0000-0000-0000-000000000012","email":"demo.kr2@classys-demo.local","name":"이지은","dept":"d0000001-0000-0000-0000-000000000011","pos":"시술자","prog":[100,100,100,100,100,80,70,60]},
    {"id":"e0000001-0000-0000-0000-000000000013","email":"demo.kr3@classys-demo.local","name":"박철수","dept":"d0000001-0000-0000-0000-000000000012","pos":"시술자","prog":[100,100,100,100,90,75,50,40]},
    {"id":"e0000002-0000-0000-0000-000000000021","email":"demo.us1@classys-demo.local","name":"Sarah Johnson","dept":"d0000002-0000-0000-0000-000000000021","pos":"Practitioner","prog":[100,100,100,80,70,50,30,20]},
    {"id":"e0000002-0000-0000-0000-000000000022","email":"demo.us2@classys-demo.local","name":"Michael Chen","dept":"d0000002-0000-0000-0000-000000000022","pos":"Practitioner","prog":[100,100,80,70,60,40,20,10]},
    {"id":"e0000003-0000-0000-0000-000000000031","email":"demo.jp1@classys-demo.local","name":"田中 美咲","dept":"d0000003-0000-0000-0000-000000000031","pos":"施術者","prog":[100,100,90,80,60,40,20,10]},
    {"id":"e0000003-0000-0000-0000-000000000032","email":"demo.jp2@classys-demo.local","name":"佐藤 健","dept":"d0000003-0000-0000-0000-000000000031","pos":"施術者","prog":[100,80,60,50,40,20,10,0]},
    {"id":"e0000004-0000-0000-0000-000000000041","email":"demo.br1@classys-demo.local","name":"Camila Silva","dept":"d0000004-0000-0000-0000-000000000041","pos":"Praticante","prog":[80,60,40,30,20,10,0,0]},
    {"id":"e0000005-0000-0000-0000-000000000051","email":"demo.th1@classys-demo.local","name":"Somchai Prasert","dept":"d0000005-0000-0000-0000-000000000051","pos":"Practitioner","prog":[50,30,20,10,0,0,0,0]}
  ]'::jsonb;
  course_ids uuid[] := ARRAY[
    'a1111111-1111-1111-1111-111111111106',
    'a1111111-1111-1111-1111-111111111108',
    'a1111111-1111-1111-1111-111111111101',
    'a1111111-1111-1111-1111-111111111102',
    'a1111111-1111-1111-1111-111111111105',
    'a1111111-1111-1111-1111-111111111103',
    'a1111111-1111-1111-1111-111111111104',
    'a1111111-1111-1111-1111-111111111110'
  ]::uuid[];
  u jsonb;
  uid uuid;
  i int;
  prog_val int;
BEGIN
  FOR u IN SELECT * FROM jsonb_array_elements(demo_users) LOOP
    uid := (u->>'id')::uuid;

    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
    VALUES (uid, '00000000-0000-0000-0000-000000000000', u->>'email',
      extensions.crypt('demo1234!', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', u->>'name'),
      'authenticated','authenticated')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    VALUES (uid, uid, u->>'email', 'email', jsonb_build_object('sub', uid::text, 'email', u->>'email'), now(), now(), now())
    ON CONFLICT DO NOTHING;

    UPDATE public.profiles
    SET full_name = u->>'name',
        department_id = (u->>'dept')::uuid,
        position = u->>'pos'
    WHERE user_id = uid;

    FOR i IN 1..array_length(course_ids,1) LOOP
      prog_val := (u->'prog'->(i-1))::int;
      INSERT INTO public.enrollments (user_id, course_id, status, progress, enrolled_at, completed_at)
      VALUES (
        uid, course_ids[i], 'approved'::enrollment_status, prog_val,
        now() - interval '30 days',
        CASE WHEN prog_val >= 100 THEN now() - interval '5 days' ELSE NULL END
      )
      ON CONFLICT (user_id, course_id) DO UPDATE SET progress = EXCLUDED.progress, completed_at = EXCLUDED.completed_at;
    END LOOP;
  END LOOP;

  RETURN 'OK: 9 demo users seeded';
END $$;

SELECT public.seed_global_demo_data();
