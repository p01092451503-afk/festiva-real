-- 1) test@test.co.kr 계정에 branch_admin 역할 부여
INSERT INTO public.user_roles (user_id, role)
VALUES ('bcf74489-785d-4c1b-b4a5-39b846fc38a7', 'branch_admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- 2) 서울 강남점 지점 담당자로 배정
INSERT INTO public.branch_admin_assignments (user_id, branch_id)
VALUES ('bcf74489-785d-4c1b-b4a5-39b846fc38a7', 'd0000001-0000-0000-0000-000000000011')
ON CONFLICT (user_id, branch_id) DO NOTHING;

-- 3) 해당 지점의 모든 권한(트랙/회원/배정/통계) 활성화
INSERT INTO public.branch_admin_permissions (user_id, branch_id, capability_code, enabled)
SELECT 'bcf74489-785d-4c1b-b4a5-39b846fc38a7',
       'd0000001-0000-0000-0000-000000000011',
       cap,
       true
FROM unnest(ARRAY['track_manage','staff_manage','track_assign','stats_view']) AS cap
ON CONFLICT (user_id, branch_id, capability_code) DO UPDATE SET enabled = true;