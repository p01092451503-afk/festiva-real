
-- 1. courses 컬럼 확장
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS course_type text NOT NULL DEFAULT 'single' CHECK (course_type IN ('single','package')),
  ADD COLUMN IF NOT EXISTS base_category text,
  ADD COLUMN IF NOT EXISTS installment_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS installment_months integer DEFAULT 12,
  ADD COLUMN IF NOT EXISTS retake_discount_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retake_discount_percent integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS retake_allow_coupon_stack boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspension_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'shown' CHECK (visibility IN ('shown','hidden')),
  ADD COLUMN IF NOT EXISTS visibility_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS visibility_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS keywords text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS always_recruiting boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS period_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_start_grace_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS daily_learning_limit_min integer,
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS intro_video_url text,
  ADD COLUMN IF NOT EXISTS intro_video_provider text CHECK (intro_video_provider IN ('cdn','youtube','vimeo')),
  ADD COLUMN IF NOT EXISTS support_options text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS short_intro_html text,
  ADD COLUMN IF NOT EXISTS detail_intro_html text,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS seo_keywords text;

-- 2. 가격 옵션 테이블
CREATE TABLE IF NOT EXISTS public.course_pricing_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  duration_days integer NOT NULL,
  list_price integer NOT NULL DEFAULT 0,
  sale_price integer NOT NULL DEFAULT 0,
  points integer NOT NULL DEFAULT 0,
  display_name text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.course_pricing_tiers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_pricing_tiers TO authenticated;
GRANT ALL ON public.course_pricing_tiers TO service_role;

ALTER TABLE public.course_pricing_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pricing tiers of published courses"
  ON public.course_pricing_tiers FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.status = 'published'));

CREATE POLICY "Admins manage pricing tiers"
  ON public.course_pricing_tiers FOR ALL
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

CREATE INDEX IF NOT EXISTS idx_pricing_tiers_course ON public.course_pricing_tiers(course_id, sort_order);

-- 3. 패키지 구성 테이블
CREATE TABLE IF NOT EXISTS public.course_package_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  child_course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (package_course_id, child_course_id)
);

GRANT SELECT ON public.course_package_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_package_items TO authenticated;
GRANT ALL ON public.course_package_items TO service_role;

ALTER TABLE public.course_package_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view package items of published courses"
  ON public.course_package_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = package_course_id AND c.status = 'published'));

CREATE POLICY "Admins manage package items"
  ON public.course_package_items FOR ALL
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

-- 4. 가격 옵션 ↔ courses.price/sale_price 동기화 트리거 (최상단 가격 = 대표가)
CREATE OR REPLACE FUNCTION public.sync_course_main_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course uuid;
  v_list integer;
  v_sale integer;
BEGIN
  v_course := COALESCE(NEW.course_id, OLD.course_id);
  SELECT list_price, sale_price INTO v_list, v_sale
    FROM public.course_pricing_tiers
    WHERE course_id = v_course
    ORDER BY sort_order ASC, created_at ASC
    LIMIT 1;
  IF v_list IS NOT NULL THEN
    UPDATE public.courses
       SET price = v_list,
           sale_price = NULLIF(v_sale, 0),
           updated_at = now()
     WHERE id = v_course;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_course_main_price ON public.course_pricing_tiers;
CREATE TRIGGER trg_sync_course_main_price
AFTER INSERT OR UPDATE OR DELETE ON public.course_pricing_tiers
FOR EACH ROW EXECUTE FUNCTION public.sync_course_main_price();

CREATE TRIGGER trg_pricing_tiers_updated
BEFORE UPDATE ON public.course_pricing_tiers
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
