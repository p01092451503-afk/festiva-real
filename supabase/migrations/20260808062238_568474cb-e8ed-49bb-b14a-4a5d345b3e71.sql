-- 1) profiles 확장
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS member_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS admin_memo text,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_member_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_member_status_check
  CHECK (member_status IN ('active','dormant','suspended','withdrawn'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_gender_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_gender_check
  CHECK (gender IS NULL OR gender IN ('male','female','other'));

CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON public.profiles (phone_number);
CREATE INDEX IF NOT EXISTS idx_profiles_member_status ON public.profiles (member_status);

-- 2) courses 판매 상태
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS sale_status text NOT NULL DEFAULT 'on_sale',
  ADD COLUMN IF NOT EXISTS open_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS apply_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS apply_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS operation_start_at timestamptz;

ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_sale_status_check;
ALTER TABLE public.courses ADD CONSTRAINT courses_sale_status_check
  CHECK (sale_status IN ('open_alert','presale','on_sale','closed','sold_out'));

-- 3) 교보재 상품
CREATE TABLE IF NOT EXISTS public.store_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  image_url text,
  price integer NOT NULL DEFAULT 0,
  sale_price integer,
  stock_quantity integer,
  sale_status text NOT NULL DEFAULT 'on_sale',
  open_scheduled_at timestamptz,
  apply_start_at timestamptz,
  apply_end_at timestamptz,
  operation_start_at timestamptz,
  linked_course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_products_sale_status_check
    CHECK (sale_status IN ('open_alert','presale','on_sale','closed','sold_out'))
);

GRANT SELECT ON public.store_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_products TO authenticated;
GRANT ALL ON public.store_products TO service_role;
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store_products_public_read" ON public.store_products
  FOR SELECT USING (true);
CREATE POLICY "store_products_admin_manage" ON public.store_products
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER trg_store_products_updated_at
  BEFORE UPDATE ON public.store_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

-- 4) 오픈 알림 신청
CREATE TABLE IF NOT EXISTS public.product_open_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.store_products(id) ON DELETE CASCADE,
  contact_email text,
  contact_phone text,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_alert_course
  ON public.product_open_alerts (user_id, course_id) WHERE course_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_alert_product
  ON public.product_open_alerts (user_id, product_id) WHERE product_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_open_alerts TO authenticated;
GRANT ALL ON public.product_open_alerts TO service_role;
ALTER TABLE public.product_open_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open_alerts_own" ON public.product_open_alerts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "open_alerts_admin" ON public.product_open_alerts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 5) 일괄 발송 이력
CREATE TABLE IF NOT EXISTS public.bulk_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL,
  subject text,
  body text NOT NULL,
  template_code text,
  recipient_count integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  fail_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bulk_messages_channel_check CHECK (channel IN ('email','alimtalk')),
  CONSTRAINT bulk_messages_status_check CHECK (status IN ('pending','sending','done','failed'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bulk_messages TO authenticated;
GRANT ALL ON public.bulk_messages TO service_role;
ALTER TABLE public.bulk_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bulk_messages_admin" ON public.bulk_messages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER trg_bulk_messages_updated_at
  BEFORE UPDATE ON public.bulk_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

CREATE TABLE IF NOT EXISTS public.bulk_message_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.bulk_messages(id) ON DELETE CASCADE,
  user_id uuid,
  target_email text,
  target_phone text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bulk_message_recipients_status_check CHECK (status IN ('pending','sent','failed','skipped'))
);

CREATE INDEX IF NOT EXISTS idx_bulk_recipients_message ON public.bulk_message_recipients (message_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bulk_message_recipients TO authenticated;
GRANT ALL ON public.bulk_message_recipients TO service_role;
ALTER TABLE public.bulk_message_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bulk_recipients_admin" ON public.bulk_message_recipients
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));