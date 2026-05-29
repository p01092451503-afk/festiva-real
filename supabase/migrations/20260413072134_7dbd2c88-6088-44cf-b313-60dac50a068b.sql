
-- 강좌별 이수 조건 설정
CREATE TABLE public.completion_criteria (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  min_progress_pct numeric NOT NULL DEFAULT 80,
  min_assessment_score numeric DEFAULT NULL,
  certificate_enabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(course_id)
);

ALTER TABLE public.completion_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/teachers can manage criteria"
  ON public.completion_criteria FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Authenticated can view criteria"
  ON public.completion_criteria FOR SELECT
  TO authenticated
  USING (true);

-- 발급된 이수증
CREATE TABLE public.certificates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  certificate_number text NOT NULL UNIQUE,
  issued_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own certificates"
  ON public.certificates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins/teachers can view all certificates"
  ON public.certificates FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "System can insert certificates"
  ON public.certificates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 이수증 디자인 템플릿
CREATE TABLE public.certificate_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  background_image_url text,
  title_text text NOT NULL DEFAULT '수료증',
  description_text text DEFAULT '위 사람은 본 교육과정을 성실히 이수하였기에 이 증서를 수여합니다.',
  issuer_name text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(course_id)
);

ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/teachers can manage templates"
  ON public.certificate_templates FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Authenticated can view templates"
  ON public.certificate_templates FOR SELECT
  TO authenticated
  USING (true);

-- 이수증 배경 이미지 저장용 스토리지 버킷
INSERT INTO storage.buckets (id, name, public) VALUES ('certificate-templates', 'certificate-templates', true);

CREATE POLICY "Admins can upload certificate templates"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'certificate-templates' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role)));

CREATE POLICY "Anyone can view certificate templates"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'certificate-templates');

CREATE POLICY "Admins can update certificate templates"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'certificate-templates' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role)));

CREATE POLICY "Admins can delete certificate templates"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'certificate-templates' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role)));
