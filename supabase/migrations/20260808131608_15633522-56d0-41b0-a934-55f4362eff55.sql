-- 1. 회원 등급
CREATE TABLE public.member_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  rank integer NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_grades TO authenticated;
GRANT ALL ON public.member_grades TO service_role;
ALTER TABLE public.member_grades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage member_grades" ON public.member_grades FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Authenticated read member_grades" ON public.member_grades FOR SELECT TO authenticated USING (is_active);

-- 2. 회원 그룹
CREATE TABLE public.member_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  description text,
  discount_percent numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_groups TO authenticated;
GRANT ALL ON public.member_groups TO service_role;
ALTER TABLE public.member_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage member_groups" ON public.member_groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Authenticated read member_groups" ON public.member_groups FOR SELECT TO authenticated USING (is_active);

CREATE TABLE public.member_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.member_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_group_members TO authenticated;
GRANT ALL ON public.member_group_members TO service_role;
ALTER TABLE public.member_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage member_group_members" ON public.member_group_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Users view own group memberships" ON public.member_group_members FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 3. 프로필 확장
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS grade_id uuid REFERENCES public.member_grades(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS marketing_email boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_sms boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_kakao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_agreed_at timestamptz;

-- 4. 강의별 할인
CREATE TABLE public.course_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  group_id uuid REFERENCES public.member_groups(id) ON DELETE CASCADE,
  grade_id uuid REFERENCES public.member_grades(id) ON DELETE CASCADE,
  discount_type text NOT NULL DEFAULT 'percent',
  discount_value numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_discounts TO authenticated;
GRANT ALL ON public.course_discounts TO service_role;
ALTER TABLE public.course_discounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage course_discounts" ON public.course_discounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Authenticated read course_discounts" ON public.course_discounts FOR SELECT TO authenticated USING (is_active);
CREATE INDEX idx_course_discounts_course ON public.course_discounts(course_id);

-- 5. 강의 확장 (신청 제한 / 할인 사용)
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS group_discount_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS grade_discount_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS restrict_group_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS auto_approve_enrollment boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_duplicate_enrollment boolean NOT NULL DEFAULT false;

-- 6. 환불 규정
CREATE TABLE public.refund_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  basis text NOT NULL DEFAULT 'days',
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.refund_policies TO authenticated;
GRANT ALL ON public.refund_policies TO service_role;
ALTER TABLE public.refund_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage refund_policies" ON public.refund_policies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Authenticated read refund_policies" ON public.refund_policies FOR SELECT TO authenticated USING (is_active);

CREATE TABLE public.refund_policy_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES public.refund_policies(id) ON DELETE CASCADE,
  from_value numeric NOT NULL DEFAULT 0,
  to_value numeric,
  refund_percent numeric NOT NULL DEFAULT 0,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.refund_policy_rules TO authenticated;
GRANT ALL ON public.refund_policy_rules TO service_role;
ALTER TABLE public.refund_policy_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage refund_policy_rules" ON public.refund_policy_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Authenticated read refund_policy_rules" ON public.refund_policy_rules FOR SELECT TO authenticated USING (true);

ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS refund_policy_id uuid REFERENCES public.refund_policies(id) ON DELETE SET NULL;

-- 7. 환불 요청
CREATE TABLE public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  enrollment_id uuid REFERENCES public.enrollments(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  paid_amount integer NOT NULL DEFAULT 0,
  calculated_amount integer NOT NULL DEFAULT 0,
  final_amount integer NOT NULL DEFAULT 0,
  refund_percent numeric NOT NULL DEFAULT 0,
  elapsed_days integer NOT NULL DEFAULT 0,
  progress_percent numeric NOT NULL DEFAULT 0,
  is_partial boolean NOT NULL DEFAULT false,
  reason text,
  admin_note text,
  status text NOT NULL DEFAULT 'requested',
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.refund_requests TO authenticated;
GRANT ALL ON public.refund_requests TO service_role;
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage refund_requests" ON public.refund_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Users view own refund_requests" ON public.refund_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users create own refund_requests" ON public.refund_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 8. 개인정보 조회 기록
CREATE TABLE public.privacy_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  action text NOT NULL DEFAULT 'view',
  context text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.privacy_access_logs TO authenticated;
GRANT ALL ON public.privacy_access_logs TO service_role;
ALTER TABLE public.privacy_access_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read privacy_access_logs" ON public.privacy_access_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Actors insert privacy_access_logs" ON public.privacy_access_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());
CREATE INDEX idx_privacy_logs_target ON public.privacy_access_logs(target_user_id);

-- 9. 환불액 계산 함수
CREATE OR REPLACE FUNCTION public.calculate_refund_amount(
  p_course_id uuid, p_paid_amount integer, p_elapsed_days integer, p_progress_percent numeric
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_policy_id uuid;
  v_basis text;
  v_metric numeric;
  v_percent numeric := 0;
BEGIN
  SELECT refund_policy_id INTO v_policy_id FROM public.courses WHERE id = p_course_id;
  IF v_policy_id IS NULL THEN
    SELECT id INTO v_policy_id FROM public.refund_policies WHERE is_default AND is_active LIMIT 1;
  END IF;
  IF v_policy_id IS NULL THEN
    RETURN jsonb_build_object('refund_percent', 100, 'refund_amount', p_paid_amount, 'policy_id', NULL);
  END IF;

  SELECT basis INTO v_basis FROM public.refund_policies WHERE id = v_policy_id;
  v_metric := CASE WHEN v_basis = 'progress' THEN COALESCE(p_progress_percent,0) ELSE COALESCE(p_elapsed_days,0) END;

  SELECT refund_percent INTO v_percent
  FROM public.refund_policy_rules
  WHERE policy_id = v_policy_id
    AND v_metric >= from_value
    AND (to_value IS NULL OR v_metric < to_value)
  ORDER BY order_index, from_value
  LIMIT 1;

  v_percent := COALESCE(v_percent, 0);
  RETURN jsonb_build_object(
    'refund_percent', v_percent,
    'refund_amount', FLOOR(p_paid_amount * v_percent / 100.0),
    'policy_id', v_policy_id
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.calculate_refund_amount(uuid, integer, integer, numeric) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.calculate_refund_amount(uuid, integer, integer, numeric) TO authenticated, service_role;

-- 10. updated_at 트리거
CREATE TRIGGER trg_member_grades_updated BEFORE UPDATE ON public.member_grades FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_member_groups_updated BEFORE UPDATE ON public.member_groups FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_course_discounts_updated BEFORE UPDATE ON public.course_discounts FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_refund_policies_updated BEFORE UPDATE ON public.refund_policies FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_refund_requests_updated BEFORE UPDATE ON public.refund_requests FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();