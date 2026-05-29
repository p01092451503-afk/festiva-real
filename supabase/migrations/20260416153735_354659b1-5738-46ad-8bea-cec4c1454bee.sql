
-- 데모 프리셋 테이블
CREATE TABLE public.demo_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  login_bg_image_url TEXT,
  brand_name TEXT,
  brand_tagline TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 프리셋별 강의 오버라이드 테이블
CREATE TABLE public.demo_preset_courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  preset_id UUID NOT NULL REFERENCES public.demo_presets(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  override_title TEXT,
  override_thumbnail_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(preset_id, course_id)
);

-- RLS 활성화
ALTER TABLE public.demo_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_preset_courses ENABLE ROW LEVEL SECURITY;

-- 누구나 활성 프리셋 조회 가능
CREATE POLICY "anyone can view active presets" ON public.demo_presets
  FOR SELECT TO public USING (is_active = true);

-- 관리자 전체 관리
CREATE POLICY "admins manage presets" ON public.demo_presets
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- 프리셋 강의: 누구나 조회
CREATE POLICY "anyone can view preset courses" ON public.demo_preset_courses
  FOR SELECT TO public USING (true);

-- 프리셋 강의: 관리자 관리
CREATE POLICY "admins manage preset courses" ON public.demo_preset_courses
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- 활성 프리셋은 하나만 가능하도록 트리거
CREATE OR REPLACE FUNCTION public.ensure_single_active_preset()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE public.demo_presets SET is_active = false WHERE id != NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_single_active_preset
  BEFORE INSERT OR UPDATE ON public.demo_presets
  FOR EACH ROW EXECUTE FUNCTION public.ensure_single_active_preset();
