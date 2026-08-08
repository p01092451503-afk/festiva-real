
-- 1) 포인트 내역 확장
ALTER TABLE public.point_history
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz,
  ADD COLUMN IF NOT EXISTS ref_type text,
  ADD COLUMN IF NOT EXISTS ref_id uuid;

CREATE INDEX IF NOT EXISTS idx_point_history_expiry ON public.point_history (expires_at) WHERE expired_at IS NULL;

-- 2) 자동쿠폰 규칙 확장
ALTER TABLE public.auto_coupon_rules
  ADD COLUMN IF NOT EXISTS condition_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS once_per_user boolean NOT NULL DEFAULT true;

-- 3) 회원별 발급 쿠폰
CREATE TABLE IF NOT EXISTS public.user_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.auto_coupon_rules(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  used_at timestamptz,
  order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_coupons TO authenticated;
GRANT ALL ON public.user_coupons TO service_role;

ALTER TABLE public.user_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own coupons" ON public.user_coupons
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all user coupons" ON public.user_coupons
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins manage user coupons" ON public.user_coupons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_user_coupons_user ON public.user_coupons (user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_coupons_expiry ON public.user_coupons (expires_at) WHERE status = 'active';

CREATE TRIGGER trg_user_coupons_updated_at
  BEFORE UPDATE ON public.user_coupons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

-- 4) 자동쿠폰 발급
CREATE OR REPLACE FUNCTION public.issue_auto_coupon(_user_id uuid, _rule_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r RECORD; v_id uuid;
BEGIN
  SELECT * INTO r FROM public.auto_coupon_rules WHERE id = _rule_id AND is_active = true;
  IF NOT FOUND OR r.coupon_id IS NULL THEN RETURN NULL; END IF;

  IF r.once_per_user AND EXISTS (
    SELECT 1 FROM public.user_coupons WHERE user_id = _user_id AND rule_id = _rule_id
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.user_coupons (user_id, coupon_id, rule_id, expires_at)
  VALUES (_user_id, r.coupon_id, _rule_id, now() + make_interval(days => GREATEST(r.valid_days, 1)))
  RETURNING id INTO v_id;

  UPDATE public.auto_coupon_rules SET issued_count = issued_count + 1, updated_at = now() WHERE id = _rule_id;
  RETURN v_id;
END;
$$;

-- 5) 조건 평가 후 자동쿠폰 일괄 검사
CREATE OR REPLACE FUNCTION public.evaluate_auto_coupons(_user_id uuid, _trigger text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r RECORD; v_metric numeric; v_count int := 0;
BEGIN
  FOR r IN SELECT * FROM public.auto_coupon_rules WHERE is_active = true AND trigger_type = _trigger LOOP
    v_metric := CASE _trigger
      WHEN 'purchase_amount' THEN (
        SELECT COALESCE(SUM(final_amount), 0) FROM public.orders WHERE user_id = _user_id AND status = 'paid')
      WHEN 'first_purchase' THEN (
        SELECT COUNT(*) FROM public.orders WHERE user_id = _user_id AND status = 'paid')
      WHEN 'completion' THEN (
        SELECT COUNT(*) FROM public.enrollments WHERE user_id = _user_id AND completed_at IS NOT NULL)
      WHEN 'points' THEN (
        SELECT COALESCE(total_points, 0) FROM public.user_gamification WHERE user_id = _user_id)
      ELSE 1
    END;

    IF COALESCE(v_metric, 0) >= COALESCE(r.condition_value, 0)
       AND (_trigger <> 'first_purchase' OR COALESCE(v_metric, 0) >= 1) THEN
      IF public.issue_auto_coupon(_user_id, r.id) IS NOT NULL THEN
        v_count := v_count + 1;
      END IF;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

-- 6) 정책 기반 포인트 적립
CREATE OR REPLACE FUNCTION public.grant_points_by_policy(_user_id uuid, _action_type text, _base_amount integer DEFAULT 0, _ref_type text DEFAULT NULL, _ref_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p RECORD; v_pts int; v_total int := 0;
BEGIN
  FOR p IN SELECT * FROM public.point_policies WHERE is_active = true AND action_type = _action_type LOOP
    v_pts := CASE WHEN p.earn_type = 'percent'
      THEN FLOOR(COALESCE(_base_amount, 0) * p.earn_value / 100.0)
      ELSE FLOOR(p.earn_value) END;
    IF p.max_per_action IS NOT NULL THEN v_pts := LEAST(v_pts, p.max_per_action); END IF;
    IF v_pts > 0 THEN
      PERFORM public.award_points(_user_id, v_pts, _action_type, p.name);
      UPDATE public.point_history
        SET expires_at = CASE WHEN p.expire_days IS NOT NULL THEN now() + make_interval(days => p.expire_days) END,
            ref_type = _ref_type, ref_id = _ref_id
        WHERE id = (SELECT id FROM public.point_history WHERE user_id = _user_id ORDER BY created_at DESC LIMIT 1);
      v_total := v_total + v_pts;
    END IF;
  END LOOP;

  PERFORM public.evaluate_auto_coupons(_user_id, 'points');
  RETURN v_total;
END;
$$;

-- 7) 포인트 차감(사용)
CREATE OR REPLACE FUNCTION public.spend_points(_user_id uuid, _points integer, _description text DEFAULT NULL, _ref_type text DEFAULT NULL, _ref_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_balance int;
BEGIN
  IF _points IS NULL OR _points <= 0 THEN RAISE EXCEPTION '차감 포인트는 1 이상이어야 합니다.'; END IF;
  SELECT COALESCE(total_points, 0) INTO v_balance FROM public.user_gamification WHERE user_id = _user_id FOR UPDATE;
  IF COALESCE(v_balance, 0) < _points THEN RAISE EXCEPTION '보유 포인트가 부족합니다.'; END IF;

  UPDATE public.user_gamification SET total_points = total_points - _points, updated_at = now() WHERE user_id = _user_id;
  INSERT INTO public.point_history (user_id, points, action_type, description, ref_type, ref_id)
  VALUES (_user_id, -_points, 'spend', COALESCE(_description, '포인트 사용'), _ref_type, _ref_id);

  RETURN v_balance - _points;
END;
$$;

-- 8) 쿠폰 사용 처리
CREATE OR REPLACE FUNCTION public.use_user_coupon(_user_coupon_id uuid, _order_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c RECORD;
BEGIN
  SELECT * INTO c FROM public.user_coupons WHERE id = _user_coupon_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '쿠폰을 찾을 수 없습니다.'; END IF;
  IF c.user_id <> auth.uid() AND NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;
  IF c.status <> 'active' THEN RAISE EXCEPTION '이미 사용되었거나 만료된 쿠폰입니다.'; END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    UPDATE public.user_coupons SET status = 'expired' WHERE id = _user_coupon_id;
    RAISE EXCEPTION '만료된 쿠폰입니다.';
  END IF;

  UPDATE public.user_coupons SET status = 'used', used_at = now(), order_id = _order_id WHERE id = _user_coupon_id;
  UPDATE public.coupons SET used_count = used_count + 1 WHERE id = c.coupon_id;
  RETURN true;
END;
$$;

-- 9) 포인트·쿠폰 만료 처리 (스케줄러용)
CREATE OR REPLACE FUNCTION public.expire_points_and_coupons()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r RECORD; v_points int := 0; v_coupons int := 0;
BEGIN
  FOR r IN
    SELECT id, user_id, points FROM public.point_history
    WHERE expired_at IS NULL AND expires_at IS NOT NULL AND expires_at < now() AND points > 0
  LOOP
    UPDATE public.user_gamification
      SET total_points = GREATEST(0, total_points - r.points), updated_at = now()
      WHERE user_id = r.user_id;
    UPDATE public.point_history SET expired_at = now() WHERE id = r.id;
    INSERT INTO public.point_history (user_id, points, action_type, description, ref_type, ref_id)
    VALUES (r.user_id, -r.points, 'expire', '포인트 유효기간 만료', 'point_history', r.id);
    v_points := v_points + 1;
  END LOOP;

  WITH x AS (
    UPDATE public.user_coupons SET status = 'expired'
    WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < now()
    RETURNING 1
  ) SELECT COUNT(*) INTO v_coupons FROM x;

  RETURN jsonb_build_object('expired_point_rows', v_points, 'expired_coupons', v_coupons);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.issue_auto_coupon(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.evaluate_auto_coupons(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.grant_points_by_policy(uuid, text, integer, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.spend_points(uuid, integer, text, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.use_user_coupon(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.expire_points_and_coupons() FROM anon, authenticated;
