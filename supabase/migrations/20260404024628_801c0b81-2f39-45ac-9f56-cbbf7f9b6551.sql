
-- 콘텐츠별 언어 버전 테이블
CREATE TABLE IF NOT EXISTS public.course_content_i18n (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES public.course_contents(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL CHECK (language_code IN ('ko', 'en')),
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  video_provider TEXT CHECK (video_provider IN ('youtube', 'vimeo', 'custom', 'upload')),
  duration_minutes INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(content_id, language_code)
);

-- 강좌 제목/설명 언어 버전 테이블
CREATE TABLE IF NOT EXISTS public.course_i18n (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL CHECK (language_code IN ('ko', 'en')),
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, language_code)
);

-- RLS 활성화
ALTER TABLE public.course_content_i18n ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_i18n ENABLE ROW LEVEL SECURITY;

-- course_content_i18n 정책
CREATE POLICY "Enrolled users can view content i18n"
ON public.course_content_i18n FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.course_contents cc
    JOIN public.enrollments e ON e.course_id = cc.course_id AND e.user_id = auth.uid()
    WHERE cc.id = content_id
  )
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'teacher')
);

CREATE POLICY "Admins and teachers can manage content i18n"
ON public.course_content_i18n FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'teacher'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'teacher'));

-- course_i18n 정책
CREATE POLICY "Authenticated users can view course i18n"
ON public.course_i18n FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and teachers can manage course i18n"
ON public.course_i18n FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'teacher'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'teacher'));
