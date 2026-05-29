
CREATE TABLE public.ops_surveys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  target_type TEXT NOT NULL CHECK (target_type IN ('program','project','general')),
  target_id UUID,
  phase TEXT NOT NULL DEFAULT 'post' CHECK (phase IN ('pre','post','general')),
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  opens_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ops_surveys TO authenticated;
GRANT ALL ON public.ops_surveys TO service_role;

ALTER TABLE public.ops_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ops surveys" ON public.ops_surveys
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Authenticated read active ops surveys" ON public.ops_surveys
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE OR REPLACE FUNCTION public.touch_ops_surveys_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_ops_surveys_updated
  BEFORE UPDATE ON public.ops_surveys
  FOR EACH ROW EXECUTE FUNCTION public.touch_ops_surveys_updated_at();

CREATE TABLE public.ops_survey_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id UUID NOT NULL REFERENCES public.ops_surveys(id) ON DELETE CASCADE,
  respondent_id UUID,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  nps_score INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ops_survey_responses_survey ON public.ops_survey_responses(survey_id);
CREATE INDEX idx_ops_survey_responses_respondent ON public.ops_survey_responses(respondent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ops_survey_responses TO authenticated;
GRANT ALL ON public.ops_survey_responses TO service_role;

ALTER TABLE public.ops_survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all ops survey responses" ON public.ops_survey_responses
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Users insert own ops survey response" ON public.ops_survey_responses
  FOR INSERT TO authenticated
  WITH CHECK (respondent_id = auth.uid() OR respondent_id IS NULL);

CREATE POLICY "Users read own ops survey responses" ON public.ops_survey_responses
  FOR SELECT TO authenticated
  USING (respondent_id = auth.uid());

CREATE POLICY "Admins delete ops survey responses" ON public.ops_survey_responses
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
