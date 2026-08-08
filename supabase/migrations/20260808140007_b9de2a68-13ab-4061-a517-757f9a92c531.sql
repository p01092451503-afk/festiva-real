-- ============ 1) 정기구독 ============
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price integer NOT NULL DEFAULT 0,
  billing_period text NOT NULL DEFAULT 'monthly',
  billing_interval integer NOT NULL DEFAULT 1,
  trial_days integer NOT NULL DEFAULT 0,
  benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
  included_course_ids uuid[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscription_plans_public_read" ON public.subscription_plans FOR SELECT USING (is_active = true OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "subscription_plans_admin_all" ON public.subscription_plans FOR ALL TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_subscription_plans_updated BEFORE UPDATE ON public.subscription_plans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL DEFAULT (now() + interval '1 month'),
  next_billing_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  cancel_reason text,
  billing_key text,
  admin_memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_subscriptions_user ON public.user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON public.user_subscriptions(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_subscriptions TO authenticated;
GRANT ALL ON public.user_subscriptions TO service_role;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_subscriptions_own_select" ON public.user_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "user_subscriptions_own_insert" ON public.user_subscriptions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "user_subscriptions_update" ON public.user_subscriptions FOR UPDATE TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin')) WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "user_subscriptions_admin_delete" ON public.user_subscriptions FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_user_subscriptions_updated BEFORE UPDATE ON public.user_subscriptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.subscription_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.user_subscriptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  cycle_no integer NOT NULL DEFAULT 1,
  amount integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  billing_date timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  failure_reason text,
  retry_count integer NOT NULL DEFAULT 0,
  payment_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscription_invoices_sub ON public.subscription_invoices(subscription_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_invoices TO authenticated;
GRANT ALL ON public.subscription_invoices TO service_role;
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscription_invoices_select" ON public.subscription_invoices FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "subscription_invoices_admin_all" ON public.subscription_invoices FOR ALL TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_subscription_invoices_updated BEFORE UPDATE ON public.subscription_invoices FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ 2) 도서/마켓 ============
CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  parent_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_categories_public_read" ON public.product_categories FOR SELECT USING (true);
CREATE POLICY "product_categories_admin_all" ON public.product_categories FOR ALL TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_product_categories_updated BEFORE UPDATE ON public.product_categories FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.store_products
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'goods',
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS requires_shipping boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shipping_fee integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_alert_threshold integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS author text,
  ADD COLUMN IF NOT EXISTS publisher text,
  ADD COLUMN IF NOT EXISTS isbn text,
  ADD COLUMN IF NOT EXISTS ebook_file_url text,
  ADD COLUMN IF NOT EXISTS ebook_download_limit integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS ebook_access_days integer NOT NULL DEFAULT 365;

CREATE TABLE public.product_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  product_id uuid REFERENCES public.store_products(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  recipient_name text NOT NULL,
  recipient_phone text NOT NULL,
  postcode text,
  address1 text NOT NULL,
  address2 text,
  delivery_memo text,
  carrier text,
  tracking_no text,
  status text NOT NULL DEFAULT 'pending',
  shipped_at timestamptz,
  delivered_at timestamptz,
  admin_memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_shipments_status ON public.product_shipments(status);
CREATE INDEX idx_product_shipments_user ON public.product_shipments(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_shipments TO authenticated;
GRANT ALL ON public.product_shipments TO service_role;
ALTER TABLE public.product_shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_shipments_select" ON public.product_shipments FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "product_shipments_insert" ON public.product_shipments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "product_shipments_admin_all" ON public.product_shipments FOR ALL TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_product_shipments_updated BEFORE UPDATE ON public.product_shipments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.ebook_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.store_products(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  download_limit integer NOT NULL DEFAULT 5,
  download_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  is_revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_ebook_entitlement_unique ON public.ebook_entitlements(user_id, product_id, COALESCE(order_id, '00000000-0000-0000-0000-000000000000'::uuid));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ebook_entitlements TO authenticated;
GRANT ALL ON public.ebook_entitlements TO service_role;
ALTER TABLE public.ebook_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ebook_entitlements_select" ON public.ebook_entitlements FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "ebook_entitlements_admin_all" ON public.ebook_entitlements FOR ALL TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_ebook_entitlements_updated BEFORE UPDATE ON public.ebook_entitlements FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.ebook_download_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entitlement_id uuid NOT NULL REFERENCES public.ebook_entitlements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ebook_download_logs TO authenticated;
GRANT ALL ON public.ebook_download_logs TO service_role;
ALTER TABLE public.ebook_download_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ebook_download_logs_select" ON public.ebook_download_logs FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "ebook_download_logs_insert" ON public.ebook_download_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 전자책 다운로드 처리 함수 (횟수/기간 검증)
CREATE OR REPLACE FUNCTION public.consume_ebook_download(p_entitlement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ent public.ebook_entitlements%ROWTYPE;
  v_url text;
BEGIN
  SELECT * INTO v_ent FROM public.ebook_entitlements WHERE id = p_entitlement_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  IF v_ent.user_id <> auth.uid() THEN RETURN jsonb_build_object('success', false, 'error', 'forbidden'); END IF;
  IF v_ent.is_revoked THEN RETURN jsonb_build_object('success', false, 'error', 'revoked'); END IF;
  IF v_ent.expires_at IS NOT NULL AND v_ent.expires_at < now() THEN RETURN jsonb_build_object('success', false, 'error', 'expired'); END IF;
  IF v_ent.download_count >= v_ent.download_limit THEN RETURN jsonb_build_object('success', false, 'error', 'limit_exceeded'); END IF;

  SELECT ebook_file_url INTO v_url FROM public.store_products WHERE id = v_ent.product_id;
  IF v_url IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'no_file'); END IF;

  UPDATE public.ebook_entitlements SET download_count = download_count + 1 WHERE id = p_entitlement_id;
  INSERT INTO public.ebook_download_logs (entitlement_id, user_id) VALUES (p_entitlement_id, auth.uid());

  RETURN jsonb_build_object('success', true, 'url', v_url, 'remaining', v_ent.download_limit - v_ent.download_count - 1);
END;
$$;

-- ============ 3) 마이크로러닝 ============
CREATE TABLE public.micro_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  thumbnail_url text,
  video_url text,
  video_provider text NOT NULL DEFAULT 'youtube',
  duration_seconds integer NOT NULL DEFAULT 0,
  category text,
  tags text[] NOT NULL DEFAULT '{}',
  linked_course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  is_published boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.micro_contents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.micro_contents TO authenticated;
GRANT ALL ON public.micro_contents TO service_role;
ALTER TABLE public.micro_contents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "micro_contents_public_read" ON public.micro_contents FOR SELECT USING (is_published = true OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "micro_contents_admin_all" ON public.micro_contents FOR ALL TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_micro_contents_updated BEFORE UPDATE ON public.micro_contents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.micro_content_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.micro_contents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  watched_seconds integer NOT NULL DEFAULT 0,
  is_completed boolean NOT NULL DEFAULT false,
  liked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (content_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.micro_content_views TO authenticated;
GRANT ALL ON public.micro_content_views TO service_role;
ALTER TABLE public.micro_content_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "micro_content_views_own" ON public.micro_content_views FOR ALL TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin')) WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_micro_content_views_updated BEFORE UPDATE ON public.micro_content_views FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ 4) 집합강의/연수(학점) ============
CREATE TABLE public.offline_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  instructor_name text,
  venue text,
  address text,
  capacity integer NOT NULL DEFAULT 0,
  credit_hours numeric NOT NULL DEFAULT 0,
  price integer NOT NULL DEFAULT 0,
  start_at timestamptz,
  end_at timestamptz,
  apply_start_at timestamptz,
  apply_end_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  thumbnail_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.offline_classes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offline_classes TO authenticated;
GRANT ALL ON public.offline_classes TO service_role;
ALTER TABLE public.offline_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "offline_classes_public_read" ON public.offline_classes FOR SELECT USING (status <> 'draft' OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "offline_classes_admin_all" ON public.offline_classes FOR ALL TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_offline_classes_updated BEFORE UPDATE ON public.offline_classes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.offline_class_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.offline_classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'applied',
  attended boolean NOT NULL DEFAULT false,
  attended_hours numeric NOT NULL DEFAULT 0,
  credits_awarded numeric NOT NULL DEFAULT 0,
  certificate_issued boolean NOT NULL DEFAULT false,
  admin_memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offline_class_enrollments TO authenticated;
GRANT ALL ON public.offline_class_enrollments TO service_role;
ALTER TABLE public.offline_class_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "offline_enroll_select" ON public.offline_class_enrollments FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "offline_enroll_insert" ON public.offline_class_enrollments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "offline_enroll_admin_all" ON public.offline_class_enrollments FOR ALL TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_offline_enroll_updated BEFORE UPDATE ON public.offline_class_enrollments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();