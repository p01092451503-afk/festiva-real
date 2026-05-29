
-- [1] 기존 courses 테이블에 B2C 가격/공개 컬럼 추가
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS price integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sale_price integer,
  ADD COLUMN IF NOT EXISTS sale_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_b2c boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS preview_video_url text,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS enrolled_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_avg numeric(3,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0;

-- [2] 기존 enrollments 테이블에 주문 연결 컬럼 추가
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS order_id uuid,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- enrollments에 user_id+course_id 유니크 제약 추가 (ON CONFLICT 용)
ALTER TABLE public.enrollments
  ADD CONSTRAINT enrollments_user_course_unique UNIQUE (user_id, course_id);

-- [3] 주문 테이블
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','cancelled','refunded')),
  total_amount integer NOT NULL DEFAULT 0,
  coupon_id uuid,
  discount_amount integer NOT NULL DEFAULT 0,
  final_amount integer NOT NULL DEFAULT 0,
  toss_payment_key text,
  toss_order_id text UNIQUE,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- [4] 주문 상세 (과정별)
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE SET NULL,
  price_at_purchase integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- [5] 장바구니
CREATE TABLE IF NOT EXISTS public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id)
);

-- [6] 찜목록
CREATE TABLE IF NOT EXISTS public.wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id)
);

-- [7] 리뷰
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content text,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id)
);

-- [8] 쿠폰
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  discount_type text NOT NULL CHECK (discount_type IN ('fixed','percent')),
  discount_value integer NOT NULL,
  min_order_amount integer NOT NULL DEFAULT 0,
  max_discount_amount integer,
  usage_limit integer,
  used_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- [9] 히어로 배너
CREATE TABLE IF NOT EXISTS public.hero_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  cta_text text,
  cta_url text,
  image_url text NOT NULL,
  bg_color text DEFAULT '#1a1a2e',
  is_active boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- [10] 과정 상세 소개 블록
CREATE TABLE IF NOT EXISTS public.course_detail_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  block_type text NOT NULL
    CHECK (block_type IN ('text','image','checklist')),
  title text,
  content text,
  image_url text,
  checklist_items text[] DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- FK: orders.coupon_id -> coupons.id
ALTER TABLE public.orders
  ADD CONSTRAINT orders_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id) ON DELETE SET NULL;

-- FK: enrollments.order_id -> orders.id
ALTER TABLE public.enrollments
  ADD CONSTRAINT enrollments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;

-- [11] RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hero_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_detail_blocks ENABLE ROW LEVEL SECURITY;

-- orders
CREATE POLICY "users see own orders" ON public.orders
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users create own orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins manage orders" ON public.orders
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- order_items
CREATE POLICY "users see own order items" ON public.order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders WHERE id = order_items.order_id AND user_id = auth.uid())
  );
CREATE POLICY "users insert order items" ON public.order_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders WHERE id = order_items.order_id AND user_id = auth.uid())
  );
CREATE POLICY "admins manage order items" ON public.order_items
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- cart_items
CREATE POLICY "users manage own cart" ON public.cart_items
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- wishlists
CREATE POLICY "users manage own wishlist" ON public.wishlists
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- reviews
CREATE POLICY "anyone can view published reviews" ON public.reviews
  FOR SELECT USING (is_published = true);
CREATE POLICY "users manage own reviews" ON public.reviews
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins manage reviews" ON public.reviews
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- coupons
CREATE POLICY "authenticated can read active coupons" ON public.coupons
  FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "admins manage coupons" ON public.coupons
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- hero_banners
CREATE POLICY "anyone can view active banners" ON public.hero_banners
  FOR SELECT USING (is_active = true);
CREATE POLICY "admins manage banners" ON public.hero_banners
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- course_detail_blocks
CREATE POLICY "anyone can view blocks" ON public.course_detail_blocks
  FOR SELECT USING (true);
CREATE POLICY "admins teachers manage blocks" ON public.course_detail_blocks
  FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'teacher'));

-- B2C 과정은 비로그인도 조회 가능하도록 기존 courses 정책 수정
DROP POLICY IF EXISTS "Anyone can view published courses" ON public.courses;
DROP POLICY IF EXISTS "b2c published courses viewable by all" ON public.courses;
CREATE POLICY "b2c published courses viewable by all" ON public.courses
  FOR SELECT USING (
    (status = 'published' AND is_b2c = true)
    OR (status = 'published' AND auth.uid() IS NOT NULL)
    OR instructor_id = auth.uid()
    OR has_role(auth.uid(), 'admin')
  );

-- [12] 주문번호 자동 생성 함수
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 99999)::text, 5, '0');
END;
$$;

-- [13] 결제 완료 후 수강 자동 등록 함수
CREATE OR REPLACE FUNCTION public.confirm_payment_and_enroll(
  p_order_id uuid,
  p_toss_payment_key text,
  p_toss_order_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF v_order IS NULL OR v_order.status != 'pending' THEN
    RAISE EXCEPTION 'Invalid order';
  END IF;

  UPDATE public.orders
  SET status = 'paid',
      toss_payment_key = p_toss_payment_key,
      toss_order_id = p_toss_order_id,
      paid_at = now()
  WHERE id = p_order_id;

  FOR v_item IN SELECT * FROM public.order_items WHERE order_id = p_order_id LOOP
    INSERT INTO public.enrollments (user_id, course_id, order_id, status)
    VALUES (v_order.user_id, v_item.course_id, p_order_id, 'approved')
    ON CONFLICT (user_id, course_id) DO NOTHING;

    UPDATE public.courses SET enrolled_count = enrolled_count + 1 WHERE id = v_item.course_id;
  END LOOP;

  DELETE FROM public.cart_items
  WHERE user_id = v_order.user_id
    AND course_id IN (SELECT course_id FROM public.order_items WHERE order_id = p_order_id);

  IF v_order.coupon_id IS NOT NULL THEN
    UPDATE public.coupons SET used_count = used_count + 1 WHERE id = v_order.coupon_id;
  END IF;
END;
$$;
