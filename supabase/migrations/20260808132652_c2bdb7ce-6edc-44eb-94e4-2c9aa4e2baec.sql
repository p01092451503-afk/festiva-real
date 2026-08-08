
-- 1. message_templates
CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  channel text NOT NULL DEFAULT 'email', -- email | sms | alimtalk | system
  subject text,
  body text NOT NULL,
  variables text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage message_templates" ON public.message_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 2. message_logs
CREATE TABLE public.message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'email',
  recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_address text,
  subject text,
  body text,
  status text NOT NULL DEFAULT 'sent', -- sent | failed | queued
  error_message text,
  source text, -- manual | nudge | auto_coupon | system
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_message_logs_sent_at ON public.message_logs(sent_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_logs TO authenticated;
GRANT ALL ON public.message_logs TO service_role;
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage message_logs" ON public.message_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "users read own message_logs" ON public.message_logs FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid());

-- 3. learning_nudge_rules
CREATE TABLE public.learning_nudge_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  condition_type text NOT NULL DEFAULT 'progress_below', -- progress_below | inactive_days | deadline_near
  threshold numeric NOT NULL DEFAULT 50,
  channel text NOT NULL DEFAULT 'system',
  template_id uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
  schedule_cron text,
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_nudge_rules TO authenticated;
GRANT ALL ON public.learning_nudge_rules TO service_role;
ALTER TABLE public.learning_nudge_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage nudge rules" ON public.learning_nudge_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 4. point_policies
CREATE TABLE public.point_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  action_type text NOT NULL, -- signup | purchase | review | completion | attendance
  earn_type text NOT NULL DEFAULT 'fixed', -- fixed | percent
  earn_value numeric NOT NULL DEFAULT 0,
  max_per_action integer,
  expire_days integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.point_policies TO authenticated;
GRANT ALL ON public.point_policies TO service_role;
ALTER TABLE public.point_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage point policies" ON public.point_policies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "everyone reads active point policies" ON public.point_policies FOR SELECT TO authenticated
  USING (is_active = true);

-- 5. auto_coupon_rules
CREATE TABLE public.auto_coupon_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'signup', -- signup | birthday | completion | first_purchase
  coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
  valid_days integer NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true,
  issued_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_coupon_rules TO authenticated;
GRANT ALL ON public.auto_coupon_rules TO service_role;
ALTER TABLE public.auto_coupon_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage auto coupon rules" ON public.auto_coupon_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 6. instructor_settlements
CREATE TABLE public.instructor_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  gross_amount integer NOT NULL DEFAULT 0,
  share_type text NOT NULL DEFAULT 'percent', -- percent | fixed
  share_value numeric NOT NULL DEFAULT 0,
  settle_amount integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | paid
  memo text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructor_settlements TO authenticated;
GRANT ALL ON public.instructor_settlements TO service_role;
ALTER TABLE public.instructor_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage settlements" ON public.instructor_settlements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "instructors read own settlements" ON public.instructor_settlements FOR SELECT TO authenticated
  USING (instructor_id = auth.uid());

CREATE TRIGGER trg_message_templates_updated BEFORE UPDATE ON public.message_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
CREATE TRIGGER trg_nudge_rules_updated BEFORE UPDATE ON public.learning_nudge_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
CREATE TRIGGER trg_point_policies_updated BEFORE UPDATE ON public.point_policies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
CREATE TRIGGER trg_auto_coupon_rules_updated BEFORE UPDATE ON public.auto_coupon_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
CREATE TRIGGER trg_instructor_settlements_updated BEFORE UPDATE ON public.instructor_settlements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
