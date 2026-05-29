
-- 샘플 수강생 20명 + 통계용 관련 데이터 생성
DO $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_name text;
  v_course_id uuid;
  v_course_price int;
  v_content_id uuid;
  v_enroll_count int;
  v_status text;
  v_progress numeric;
  v_enrolled_at timestamptz;
  v_completed_at timestamptz;
  v_order_id uuid;
  v_content_idx int;
  v_completed_contents int;
  v_att_date date;
  i int;
  c int;
  names text[] := ARRAY[
    '김민준','이서연','박지호','최수아','정도윤','강하은','윤시우','임예린',
    '한지훈','조은서','오민재','서윤아','신준호','배다은','권태양','홍지원',
    '문서진','양채원','노현우','구하린'
  ];
  course_ids uuid[];
  course_prices int[];
BEGIN
  -- 강의 ID/가격 목록 로드
  SELECT array_agg(id ORDER BY title), array_agg(price ORDER BY title)
  INTO course_ids, course_prices
  FROM public.courses WHERE status = 'published';

  FOR i IN 1..20 LOOP
    v_user_id := gen_random_uuid();
    v_email := 'sample-student-' || lpad(i::text, 2, '0') || '@nfacademy.test';
    v_name := names[i];

    -- auth.users 직접 삽입 (handle_new_user 트리거가 profile/role/gamification 자동 생성)
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, email_change, email_change_token_new, recovery_token,
      is_super_admin, is_sso_user
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_user_id,
      'authenticated', 'authenticated', v_email,
      crypt('Sample123!', gen_salt('bf')),
      now() - (random()*interval '60 days'),
      now() - (random()*interval '60 days'),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_name),
      '', '', '', '',
      false, false
    );

    -- 프로필 이름/전화 보정
    UPDATE public.profiles
    SET full_name = v_name,
        phone_number = '010-' || lpad((1000 + i*37)::text, 4, '0') || '-' || lpad((1000 + i*73)::text, 4, '0')
    WHERE user_id = v_user_id;

    -- 강의 2~4개 무작위 수강
    v_enroll_count := 2 + (random()*3)::int;
    FOR c IN 1..v_enroll_count LOOP
      v_course_id := course_ids[1 + (random()*(array_length(course_ids,1)-1))::int];
      v_course_price := course_prices[array_position(course_ids, v_course_id)];
      v_enrolled_at := now() - (random()*interval '45 days') - interval '5 days';

      -- 상태 분포: 60% in_progress, 30% completed, 10% pending
      v_progress := round((random()*100)::numeric, 1);
      IF random() < 0.30 THEN
        v_status := 'approved'; v_progress := 100; v_completed_at := v_enrolled_at + (random()*interval '20 days');
        v_completed_contents := 5;
      ELSIF random() < 0.85 THEN
        v_status := 'approved'; v_completed_at := NULL;
        v_completed_contents := (random()*4)::int + 1;
      ELSE
        v_status := 'pending'; v_progress := 0; v_completed_at := NULL;
        v_completed_contents := 0;
      END IF;

      -- 주문 생성 (승인된 건만)
      v_order_id := NULL;
      IF v_status = 'approved' THEN
        v_order_id := gen_random_uuid();
        INSERT INTO public.orders (
          id, order_number, user_id, status, total_amount, final_amount,
          paid_at, created_at, payment_method, toss_payment_key, toss_order_id
        ) VALUES (
          v_order_id,
          'ORD-' || to_char(v_enrolled_at,'YYMMDD') || '-' || substr(md5(v_user_id::text||c::text), 1, 6),
          v_user_id, 'paid', v_course_price, v_course_price,
          v_enrolled_at, v_enrolled_at, '카드',
          'sample_pk_' || substr(md5(random()::text),1,16),
          'sample_to_' || substr(md5(random()::text),1,16)
        ) ON CONFLICT DO NOTHING;
      END IF;

      INSERT INTO public.enrollments (
        user_id, course_id, status, progress, enrolled_at, completed_at, order_id
      ) VALUES (
        v_user_id, v_course_id, v_status::enrollment_status, v_progress, v_enrolled_at, v_completed_at, v_order_id
      ) ON CONFLICT (user_id, course_id) DO NOTHING;

      -- 차시 진도 (완료한 차시 수만큼)
      v_content_idx := 0;
      FOR v_content_id IN
        SELECT id FROM public.course_contents
        WHERE course_id = v_course_id
        ORDER BY order_index
      LOOP
        v_content_idx := v_content_idx + 1;
        IF v_content_idx <= v_completed_contents THEN
          INSERT INTO public.content_progress (
            user_id, content_id, progress_percentage, completed, completed_at, last_accessed_at
          ) VALUES (
            v_user_id, v_content_id, 100, true,
            v_enrolled_at + (v_content_idx * interval '2 days'),
            v_enrolled_at + (v_content_idx * interval '2 days')
          ) ON CONFLICT (user_id, content_id) DO NOTHING;
        ELSIF v_content_idx = v_completed_contents + 1 AND v_status = 'approved' THEN
          -- 진행 중인 차시
          INSERT INTO public.content_progress (
            user_id, content_id, progress_percentage, completed, last_accessed_at
          ) VALUES (
            v_user_id, v_content_id, round((random()*70 + 10)::numeric, 1), false,
            now() - (random()*interval '7 days')
          ) ON CONFLICT (user_id, content_id) DO NOTHING;
        END IF;
      END LOOP;

      -- 출석 데이터 (최근 30일 중 8~20일)
      IF v_status = 'approved' THEN
        FOR c IN 1..(8 + (random()*12)::int) LOOP
          v_att_date := (now() - ((random()*30)::int * interval '1 day'))::date;
          INSERT INTO public.attendance (
            user_id, course_id, attendance_date, status, check_in_time
          ) VALUES (
            v_user_id, v_course_id, v_att_date,
            CASE WHEN random() < 0.85 THEN 'present'::attendance_status
                 WHEN random() < 0.5 THEN 'late'::attendance_status
                 ELSE 'absent'::attendance_status END,
            v_att_date::timestamptz + interval '9 hours' + (random()*interval '60 minutes')
          ) ON CONFLICT DO NOTHING;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
END $$;
