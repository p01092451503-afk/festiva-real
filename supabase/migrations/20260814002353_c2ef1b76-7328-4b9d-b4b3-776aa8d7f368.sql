CREATE TABLE public.study_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  goal_date date NOT NULL,
  daily_minutes integer NOT NULL DEFAULT 30,
  study_days integer[] NOT NULL DEFAULT '{1,2,3,4,5}',
  status text NOT NULL DEFAULT 'active',
  ai_advice text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_plans TO authenticated;
GRANT ALL ON public.study_plans TO service_role;
ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own study plans" ON public.study_plans FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins view study plans" ON public.study_plans FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.study_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.study_plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content_id uuid REFERENCES public.course_contents(id) ON DELETE CASCADE,
  title text NOT NULL,
  scheduled_date date NOT NULL,
  estimated_minutes integer NOT NULL DEFAULT 10,
  order_index integer NOT NULL DEFAULT 0,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_plan_items TO authenticated;
GRANT ALL ON public.study_plan_items TO service_role;
ALTER TABLE public.study_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own plan items" ON public.study_plan_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins view plan items" ON public.study_plan_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.ai_coach_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  summary text NOT NULL,
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  weaknesses jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_coach_reports TO authenticated;
GRANT ALL ON public.ai_coach_reports TO service_role;
ALTER TABLE public.ai_coach_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own coach reports" ON public.ai_coach_reports FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins view coach reports" ON public.ai_coach_reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.review_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content_id uuid REFERENCES public.course_contents(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  score integer,
  total integer,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_quizzes TO authenticated;
GRANT ALL ON public.review_quizzes TO service_role;
ALTER TABLE public.review_quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own review quizzes" ON public.review_quizzes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins view review quizzes" ON public.review_quizzes FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.review_wrong_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  quiz_id uuid REFERENCES public.review_quizzes(id) ON DELETE CASCADE,
  content_id uuid REFERENCES public.course_contents(id) ON DELETE SET NULL,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer text NOT NULL,
  user_answer text,
  explanation text,
  review_stage integer NOT NULL DEFAULT 0,
  next_review_at date NOT NULL DEFAULT (now()::date + 1),
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_wrong_notes TO authenticated;
GRANT ALL ON public.review_wrong_notes TO service_role;
ALTER TABLE public.review_wrong_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wrong notes" ON public.review_wrong_notes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins view wrong notes" ON public.review_wrong_notes FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE INDEX idx_study_plan_items_plan ON public.study_plan_items(plan_id, scheduled_date);
CREATE INDEX idx_wrong_notes_user_next ON public.review_wrong_notes(user_id, next_review_at) WHERE resolved = false;

CREATE TRIGGER trg_study_plans_updated BEFORE UPDATE ON public.study_plans FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_wrong_notes_updated BEFORE UPDATE ON public.review_wrong_notes FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();