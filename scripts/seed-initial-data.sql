-- ============================================
-- NONFICTION LMS 초기 세팅 스크립트
-- 리믹스 후 Supabase SQL Editor에서 실행하세요
-- ============================================

-- 1. 관리자 계정 생성 (이메일: admin@company.com / 비밀번호: admin1234!)
-- ⚠️ 운영 환경에서는 반드시 비밀번호를 변경하세요
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- 관리자 유저 생성
  v_user_id := extensions.uuid_generate_v4();

  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    aud, role
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'admin@company.com',
    crypt('admin1234!', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"시스템 관리자"}'::jsonb,
    'authenticated',
    'authenticated'
  );

  -- identities 레코드 (Supabase Auth 필수)
  INSERT INTO auth.identities (
    id, user_id, provider_id, provider,
    identity_data, last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_user_id, v_user_id, 'admin@company.com', 'email',
    jsonb_build_object('sub', v_user_id::text, 'email', 'admin@company.com'),
    now(), now(), now()
  );

  -- 프로필 (handle_new_user 트리거가 자동 생성하지만, 명시적 업데이트)
  UPDATE public.profiles
  SET full_name = '시스템 관리자', position = '관리자'
  WHERE user_id = v_user_id;

  -- 관리자 역할 부여 (트리거가 student로 생성하므로 업데이트)
  UPDATE public.user_roles SET role = 'admin' WHERE user_id = v_user_id;

  RAISE NOTICE '✅ 관리자 계정 생성 완료: admin@company.com (ID: %)', v_user_id;
END $$;


-- 2. 기본 부서(지점) 구조 생성
INSERT INTO public.departments (name, name_en, code, display_order) VALUES
  ('본사', 'Headquarters', 'HQ', 1),
  ('서울지점', 'Seoul Branch', 'SEL', 2),
  ('부산지점', 'Busan Branch', 'BUS', 3),
  ('대구지점', 'Daegu Branch', 'DAG', 4),
  ('광주지점', 'Gwangju Branch', 'GWJ', 5);

-- 본사 하위 팀 생성
INSERT INTO public.departments (name, name_en, parent_department_id, display_order)
SELECT '경영지원팀', 'Management Support', id, 1 FROM public.departments WHERE code = 'HQ'
UNION ALL
SELECT '교육운영팀', 'Education Operations', id, 2 FROM public.departments WHERE code = 'HQ'
UNION ALL
SELECT '기술개발팀', 'Tech Development', id, 3 FROM public.departments WHERE code = 'HQ';


-- 3. 기본 카테고리 생성
INSERT INTO public.categories (name, slug, display_order) VALUES
  ('필수교육', 'mandatory', 1),
  ('직무교육', 'job-training', 2),
  ('리더십', 'leadership', 3),
  ('안전교육', 'safety', 4),
  ('기타', 'etc', 5);


-- ============================================
-- 🎉 초기 세팅 완료!
-- 로그인: admin@company.com / admin1234!
-- ============================================
