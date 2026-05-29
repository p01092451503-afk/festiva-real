-- 1) feature_modules 테이블
CREATE TABLE IF NOT EXISTS public.feature_modules (
  module_key TEXT PRIMARY KEY,
  label_ko TEXT NOT NULL,
  label_en TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) GRANT (로그인 사용자는 모듈 표시 여부 확인 필요)
GRANT SELECT ON public.feature_modules TO authenticated;
GRANT ALL ON public.feature_modules TO service_role;

-- 3) RLS
ALTER TABLE public.feature_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can read feature modules"
ON public.feature_modules FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert feature modules"
ON public.feature_modules FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can update feature modules"
ON public.feature_modules FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can delete feature modules"
ON public.feature_modules FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- 4) updated_at trigger
CREATE TRIGGER trg_feature_modules_updated_at
BEFORE UPDATE ON public.feature_modules
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5) Seed defaults (산학프로젝트는 기본 OFF)
INSERT INTO public.feature_modules (module_key, label_ko, label_en, description, enabled, sort_order) VALUES
  ('beneficiaries', '수혜학생 DB', 'Beneficiary Students', '지원사업 대상 학생 정보를 통합 관리', true, 10),
  ('programs',      '프로그램 신청/참여', 'Programs', '특강·캠프·워크숍 신청 및 출석 관리', true, 20),
  ('projects',      '산학프로젝트', 'Industry Projects', '기업 연계 프로젝트 팀·산출물 관리', false, 30),
  ('evidence',      '증빙자료 제출', 'Evidence Submission', '영수증·확인서·서명부 등 증빙 관리', true, 40),
  ('surveys_ops',   '만족도 조사', 'Satisfaction Surveys', '프로그램·프로젝트 만족도 조사', true, 50),
  ('certificates_ops', '수료증/참가확인서', 'Certificates', '수료증·참가확인서 발급 및 검증', true, 60),
  ('stats_ops',     '관리자 통계', 'Operations Statistics', '사업단 운영 통합 통계 대시보드', true, 70)
ON CONFLICT (module_key) DO NOTHING;