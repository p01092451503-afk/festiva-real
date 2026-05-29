
-- 0) auth.users 더미 10명 (이메일 확인 처리)
INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT
  v.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  v.email, now(), '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', v.full_name), now(), now()
FROM (VALUES
  ('11111111-1111-4111-a111-000000000001'::uuid, 'minjun.kim@sample.co.kr', '김민준'),
  ('11111111-1111-4111-a111-000000000002'::uuid, 'seoyeon.lee@sample.co.kr', '이서연'),
  ('11111111-1111-4111-a111-000000000003'::uuid, 'jihu.park@sample.co.kr', '박지후'),
  ('11111111-1111-4111-a111-000000000004'::uuid, 'yerin.choi@sample.co.kr', '최예린'),
  ('11111111-1111-4111-a111-000000000005'::uuid, 'doyun.jung@sample.co.kr', '정도윤'),
  ('11111111-1111-4111-a111-000000000006'::uuid, 'haeun.kang@sample.co.kr', '강하은'),
  ('11111111-1111-4111-a111-000000000007'::uuid, 'seojun.yoon@sample.co.kr', '윤서준'),
  ('11111111-1111-4111-a111-000000000008'::uuid, 'chaewon.lim@sample.co.kr', '임채원'),
  ('11111111-1111-4111-a111-000000000009'::uuid, 'yujin.han@sample.co.kr', '한유진'),
  ('11111111-1111-4111-a111-000000000010'::uuid, 'siwoo.oh@sample.co.kr', '오시우')
) AS v(id, email, full_name)
ON CONFLICT (id) DO NOTHING;

-- student 역할 부여
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'student'::app_role FROM auth.users
WHERE id IN (
  '11111111-1111-4111-a111-000000000001','11111111-1111-4111-a111-000000000002',
  '11111111-1111-4111-a111-000000000003','11111111-1111-4111-a111-000000000004',
  '11111111-1111-4111-a111-000000000005','11111111-1111-4111-a111-000000000006',
  '11111111-1111-4111-a111-000000000007','11111111-1111-4111-a111-000000000008',
  '11111111-1111-4111-a111-000000000009','11111111-1111-4111-a111-000000000010'
)
ON CONFLICT (user_id, role) DO NOTHING;

-- 1) 강남점 하위 팀
INSERT INTO public.departments (id, name, name_en, parent_department_id, entity_type, display_order, is_active)
VALUES
  ('d0000001-0000-0000-0000-000000001101', '영업1팀', 'Sales Team 1', 'd0000001-0000-0000-0000-000000000011', 'team', 1, true),
  ('d0000001-0000-0000-0000-000000001102', '영업2팀', 'Sales Team 2', 'd0000001-0000-0000-0000-000000000011', 'team', 2, true)
ON CONFLICT (id) DO NOTHING;

-- 2) 추가 필수 강의
INSERT INTO public.courses (id, title, description, status, is_mandatory, difficulty_level)
VALUES
  ('c0000000-0000-0000-0000-0000000000a1', '성희롱 예방 교육 (2026)', '연간 법정의무 성희롱 예방 교육', 'published', true, 'beginner'),
  ('c0000000-0000-0000-0000-0000000000a2', '개인정보보호 교육 (2026)', '개인정보보호법 기반 법정의무 교육', 'published', true, 'beginner')
ON CONFLICT (id) DO NOTHING;

-- 수료 기준
INSERT INTO public.completion_criteria (course_id, min_progress_pct, min_assessment_score, certificate_enabled)
VALUES
  ('4ae43134-1250-4f5e-a9f8-d3bb66a6e74f', 80, 0, true),
  ('c0000000-0000-0000-0000-0000000000a1', 80, 0, true),
  ('c0000000-0000-0000-0000-0000000000a2', 80, 0, true)
ON CONFLICT (course_id) DO UPDATE SET min_progress_pct = EXCLUDED.min_progress_pct, certificate_enabled = true;

-- 3) 프로필
INSERT INTO public.profiles (user_id, full_name, email, employee_id, department_id, team_name, position)
VALUES
  ('11111111-1111-4111-a111-000000000001', '김민준', 'minjun.kim@sample.co.kr', 'GN-001', 'd0000001-0000-0000-0000-000000000011', NULL, '센터장'),
  ('11111111-1111-4111-a111-000000000002', '이서연', 'seoyeon.lee@sample.co.kr', 'GN-002', 'd0000001-0000-0000-0000-000000000011', NULL, '매니저'),
  ('11111111-1111-4111-a111-000000000003', '박지후', 'jihu.park@sample.co.kr', 'GN-003', 'd0000001-0000-0000-0000-000000000011', NULL, '대리'),
  ('11111111-1111-4111-a111-000000000004', '최예린', 'yerin.choi@sample.co.kr', 'GN-004', 'd0000001-0000-0000-0000-000000000011', NULL, '주임'),
  ('11111111-1111-4111-a111-000000000005', '정도윤', 'doyun.jung@sample.co.kr', 'GN-005', 'd0000001-0000-0000-0000-000000000011', NULL, '사원'),
  ('11111111-1111-4111-a111-000000000006', '강하은', 'haeun.kang@sample.co.kr', 'GN-S1-01', 'd0000001-0000-0000-0000-000000001101', '영업1팀', '팀장'),
  ('11111111-1111-4111-a111-000000000007', '윤서준', 'seojun.yoon@sample.co.kr', 'GN-S1-02', 'd0000001-0000-0000-0000-000000001101', '영업1팀', '대리'),
  ('11111111-1111-4111-a111-000000000008', '임채원', 'chaewon.lim@sample.co.kr', 'GN-S1-03', 'd0000001-0000-0000-0000-000000001101', '영업1팀', '사원'),
  ('11111111-1111-4111-a111-000000000009', '한유진', 'yujin.han@sample.co.kr', 'GN-S2-01', 'd0000001-0000-0000-0000-000000001102', '영업2팀', '팀장'),
  ('11111111-1111-4111-a111-000000000010', '오시우', 'siwoo.oh@sample.co.kr', 'GN-S2-02', 'd0000001-0000-0000-0000-000000001102', '영업2팀', '사원')
ON CONFLICT (user_id) DO UPDATE SET
  full_name = EXCLUDED.full_name, email = EXCLUDED.email, employee_id = EXCLUDED.employee_id,
  department_id = EXCLUDED.department_id, team_name = EXCLUDED.team_name, position = EXCLUDED.position;

-- 4) enrollments (10명 × 3 강의)
INSERT INTO public.enrollments (user_id, course_id, progress, status, enrolled_at, completed_at)
SELECT u.user_id, c.course_id, u.progress, 'approved',
       now() - interval '30 days', now() - interval '1 day'
FROM (VALUES
  ('11111111-1111-4111-a111-000000000001'::uuid, 100),
  ('11111111-1111-4111-a111-000000000002'::uuid, 95),
  ('11111111-1111-4111-a111-000000000003'::uuid, 88),
  ('11111111-1111-4111-a111-000000000004'::uuid, 92),
  ('11111111-1111-4111-a111-000000000005'::uuid, 100),
  ('11111111-1111-4111-a111-000000000006'::uuid, 90),
  ('11111111-1111-4111-a111-000000000007'::uuid, 85),
  ('11111111-1111-4111-a111-000000000008'::uuid, 100),
  ('11111111-1111-4111-a111-000000000009'::uuid, 96),
  ('11111111-1111-4111-a111-000000000010'::uuid, 82)
) AS u(user_id, progress)
CROSS JOIN (VALUES
  ('4ae43134-1250-4f5e-a9f8-d3bb66a6e74f'::uuid),
  ('c0000000-0000-0000-0000-0000000000a1'::uuid),
  ('c0000000-0000-0000-0000-0000000000a2'::uuid)
) AS c(course_id)
ON CONFLICT DO NOTHING;
