-- =========================================================
-- Seed fake learners for AI Progress Prediction testing
-- 6 courses x 10 learners = 60 fake users
-- Idempotent: cleans previous "seed-learner-...@demo.local"
-- =========================================================

DO $$
DECLARE
  v_course_ids uuid[] := ARRAY[
    '57e37c43-67c6-47b5-a180-b95694150ec1'::uuid,
    '75aca6d7-14ac-4289-b7b1-e97b606a7575'::uuid,
    '75e9de5f-bf4f-49f7-a390-2757b1bd17ff'::uuid,
    '43fe0f54-635e-4e0a-b758-07b76ee598d5'::uuid,
    'b36f378d-16e2-4c57-b469-ec98230d84a6'::uuid,
    '2c8ae9ef-e14d-4a74-8094-4602667c5d2c'::uuid
  ];
  v_course_id uuid;
  v_course_idx int;
  v_user_id uuid;
  v_email text;
  v_name text;
  v_korean_names text[] := ARRAY[
    '김민준','이서연','박지호','최수아','정도윤','강하은','윤시우','임유진','한지원','오준서'
  ];
  i int;
  v_pattern text;            -- 'high' | 'medium' | 'low' (risk)
  v_progress numeric;
  v_enrolled_at timestamptz;
  v_last_access timestamptz;
  v_completed_at timestamptz;
  v_days_since_access int;
  v_content_id uuid;
  v_content_prog numeric;
  v_content_completed boolean;
  v_attendance_count int;
  d int;
BEGIN
  -- 1) Delete previous seed data (cascades via FK on profiles)
  DELETE FROM auth.users WHERE email LIKE 'seed-learner-%@demo.local';

  -- 2) Insert 60 fake users (10 per course)
  FOR v_course_idx IN 1..array_length(v_course_ids, 1) LOOP
    v_course_id := v_course_ids[v_course_idx];

    FOR i IN 1..10 LOOP
      -- Risk pattern distribution: 3 high, 4 medium, 3 low (on-track)
      IF i <= 3 THEN
        v_pattern := 'high';
      ELSIF i <= 7 THEN
        v_pattern := 'medium';
      ELSE
        v_pattern := 'low';
      END IF;

      v_user_id := gen_random_uuid();
      v_email := format('seed-learner-%s-%s@demo.local', v_course_idx, i);
      v_name := format('%s (테스트 %s-%s)', v_korean_names[i], v_course_idx, i);

      -- Pattern-specific values
      CASE v_pattern
        WHEN 'high' THEN
          v_progress := 5 + (random() * 20)::int;        -- 5-25%
          v_days_since_access := 15 + (random() * 20)::int; -- 15-35 days ago
          v_attendance_count := 1 + (random() * 2)::int;
        WHEN 'medium' THEN
          v_progress := 35 + (random() * 30)::int;       -- 35-65%
          v_days_since_access := 4 + (random() * 8)::int;  -- 4-12 days ago
          v_attendance_count := 5 + (random() * 5)::int;
        ELSE -- low risk / on track
          v_progress := 75 + (random() * 25)::int;       -- 75-100%
          v_days_since_access := (random() * 3)::int;     -- 0-3 days ago
          v_attendance_count := 10 + (random() * 10)::int;
      END CASE;

      v_enrolled_at := now() - ((30 + (random() * 30)::int) || ' days')::interval;
      v_last_access := now() - (v_days_since_access || ' days')::interval;
      v_completed_at := CASE WHEN v_progress >= 100 THEN v_last_access ELSE NULL END;

      -- auth.users (minimal columns; email_confirmed_at so they're "active")
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, recovery_token,
        email_change_token_new, email_change
      ) VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        v_email,
        crypt('SeedLearner!2024', gen_salt('bf')),
        now(),
        jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
        jsonb_build_object('full_name', v_name),
        v_enrolled_at,
        v_enrolled_at,
        '', '', '', ''
      );

      -- profiles
      INSERT INTO public.profiles (user_id, full_name, email, created_at, updated_at)
      VALUES (v_user_id, v_name, v_email, v_enrolled_at, v_enrolled_at);

      -- user_roles (student)
      INSERT INTO public.user_roles (user_id, role)
      VALUES (v_user_id, 'student'::app_role)
      ON CONFLICT DO NOTHING;

      -- enrollments (approved)
      INSERT INTO public.enrollments (
        user_id, course_id, status, progress, enrolled_at, completed_at, reviewed_at
      ) VALUES (
        v_user_id, v_course_id, 'approved'::enrollment_status,
        v_progress, v_enrolled_at, v_completed_at, v_enrolled_at
      );

      -- content_progress for every content in this course
      FOR v_content_id IN
        SELECT id FROM public.course_contents WHERE course_id = v_course_id
      LOOP
        -- Vary content progress around overall progress
        v_content_prog := LEAST(100, GREATEST(0, v_progress + ((random() * 30) - 15)));
        v_content_completed := v_content_prog >= 80;

        INSERT INTO public.content_progress (
          user_id, content_id, progress_percentage, completed,
          last_accessed_at, completed_at
        ) VALUES (
          v_user_id, v_content_id, v_content_prog, v_content_completed,
          v_last_access,
          CASE WHEN v_content_completed THEN v_last_access ELSE NULL END
        );
      END LOOP;

      -- attendance (last 30 days, count varies by pattern)
      FOR d IN 1..v_attendance_count LOOP
        INSERT INTO public.attendance (
          user_id, course_id, attendance_date, status,
          check_in_time, created_at, updated_at
        ) VALUES (
          v_user_id,
          v_course_id,
          (now() - ((random() * 29)::int || ' days')::interval)::date,
          'present',
          now() - ((random() * 29)::int || ' days')::interval,
          now() - ((random() * 29)::int || ' days')::interval,
          now()
        );
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Seeded 60 fake learners across 6 courses.';
END $$;