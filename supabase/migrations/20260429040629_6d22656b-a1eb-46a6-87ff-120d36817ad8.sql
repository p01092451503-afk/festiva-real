
DO $$ BEGIN CREATE TYPE public.question_difficulty AS ENUM ('easy', 'medium', 'hard');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE public.learner_level AS ENUM ('beginner', 'intermediate', 'advanced');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE public.assessment_selection_mode AS ENUM ('fixed', 'random_pool');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS selection_mode public.assessment_selection_mode NOT NULL DEFAULT 'fixed';

CREATE TABLE IF NOT EXISTS public.question_bank_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_en text,
  slug text NOT NULL UNIQUE,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.question_bank_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qbank_cat_view" ON public.question_bank_categories;
CREATE POLICY "qbank_cat_view" ON public.question_bank_categories
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "qbank_cat_manage" ON public.question_bank_categories;
CREATE POLICY "qbank_cat_manage" ON public.question_bank_categories
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'teacher'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'teacher'));

CREATE TABLE IF NOT EXISTS public.question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.question_bank_categories(id) ON DELETE SET NULL,
  tags text[] NOT NULL DEFAULT '{}',
  difficulty public.question_difficulty NOT NULL DEFAULT 'medium',
  learner_level public.learner_level NOT NULL DEFAULT 'intermediate',
  question_type question_type NOT NULL DEFAULT 'multiple_choice_4',
  question_text text NOT NULL,
  options jsonb,
  correct_answer text NOT NULL,
  points integer NOT NULL DEFAULT 10,
  explanation text,
  hint text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qbank_course ON public.question_bank(course_id);
CREATE INDEX IF NOT EXISTS idx_qbank_difficulty ON public.question_bank(difficulty);
CREATE INDEX IF NOT EXISTS idx_qbank_level ON public.question_bank(learner_level);
CREATE INDEX IF NOT EXISTS idx_qbank_category ON public.question_bank(category_id);
CREATE INDEX IF NOT EXISTS idx_qbank_active ON public.question_bank(is_active);

ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qbank_view_teachers_admins" ON public.question_bank;
CREATE POLICY "qbank_view_teachers_admins" ON public.question_bank
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'teacher'));

DROP POLICY IF EXISTS "qbank_manage" ON public.question_bank;
CREATE POLICY "qbank_manage" ON public.question_bank
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'teacher'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'teacher'));

CREATE TABLE IF NOT EXISTS public.assessment_pool_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  difficulty public.question_difficulty,
  learner_level public.learner_level,
  category_id uuid REFERENCES public.question_bank_categories(id) ON DELETE SET NULL,
  tag text,
  include_global boolean NOT NULL DEFAULT true,
  include_course boolean NOT NULL DEFAULT true,
  question_count integer NOT NULL DEFAULT 5 CHECK (question_count > 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pool_rules_assessment ON public.assessment_pool_rules(assessment_id);

ALTER TABLE public.assessment_pool_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pool_rules_view" ON public.assessment_pool_rules;
CREATE POLICY "pool_rules_view" ON public.assessment_pool_rules
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "pool_rules_manage" ON public.assessment_pool_rules;
CREATE POLICY "pool_rules_manage" ON public.assessment_pool_rules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'teacher'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'teacher'));

DROP TRIGGER IF EXISTS trg_qbank_updated ON public.question_bank;
CREATE TRIGGER trg_qbank_updated BEFORE UPDATE ON public.question_bank
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_qbank_cat_updated ON public.question_bank_categories;
CREATE TRIGGER trg_qbank_cat_updated BEFORE UPDATE ON public.question_bank_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_pool_rules_updated ON public.assessment_pool_rules;
CREATE TRIGGER trg_pool_rules_updated BEFORE UPDATE ON public.assessment_pool_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.get_assessment_pool_questions_for_student(p_assessment_id uuid)
RETURNS TABLE (
  id uuid,
  question_type question_type,
  question_text text,
  options jsonb,
  points integer,
  hint text,
  order_index integer,
  difficulty public.question_difficulty,
  learner_level public.learner_level
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id uuid;
  v_rule record;
BEGIN
  SELECT a.course_id INTO v_course_id FROM public.assessments a WHERE a.id = p_assessment_id;
  IF v_course_id IS NULL THEN RETURN; END IF;

  IF NOT (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'teacher')
    OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.user_id = auth.uid() AND e.course_id = v_course_id)
  ) THEN RETURN; END IF;

  CREATE TEMP TABLE IF NOT EXISTS _picked (qid uuid) ON COMMIT DROP;
  DELETE FROM _picked;

  FOR v_rule IN
    SELECT * FROM public.assessment_pool_rules
    WHERE assessment_id = p_assessment_id
    ORDER BY sort_order, created_at
  LOOP
    INSERT INTO _picked (qid)
    SELECT qb.id FROM public.question_bank qb
    WHERE qb.is_active = true
      AND qb.id NOT IN (SELECT qid FROM _picked)
      AND (v_rule.difficulty IS NULL OR qb.difficulty = v_rule.difficulty)
      AND (v_rule.learner_level IS NULL OR qb.learner_level = v_rule.learner_level)
      AND (v_rule.category_id IS NULL OR qb.category_id = v_rule.category_id)
      AND (v_rule.tag IS NULL OR v_rule.tag = ANY(qb.tags))
      AND (
        (v_rule.include_course AND qb.course_id = v_course_id)
        OR (v_rule.include_global AND qb.course_id IS NULL)
      )
    ORDER BY random()
    LIMIT v_rule.question_count;
  END LOOP;

  RETURN QUERY
  SELECT qb.id, qb.question_type, qb.question_text, qb.options, qb.points, qb.hint,
         (row_number() OVER (ORDER BY random()))::int - 1 AS order_index,
         qb.difficulty, qb.learner_level
  FROM public.question_bank qb
  JOIN _picked p ON p.qid = qb.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_assessment_pool_questions_with_answers(p_assessment_id uuid, p_question_ids uuid[])
RETURNS TABLE (
  id uuid,
  question_type question_type,
  question_text text,
  options jsonb,
  correct_answer text,
  points integer,
  hint text,
  explanation text,
  difficulty public.question_difficulty,
  learner_level public.learner_level
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'teacher')
    OR EXISTS (
      SELECT 1 FROM public.assessment_attempts att
      WHERE att.assessment_id = p_assessment_id
        AND att.user_id = auth.uid()
        AND att.completed_at IS NOT NULL
    )
  ) THEN RETURN; END IF;

  RETURN QUERY
  SELECT qb.id, qb.question_type, qb.question_text, qb.options,
         qb.correct_answer, qb.points, qb.hint, qb.explanation,
         qb.difficulty, qb.learner_level
  FROM public.question_bank qb
  WHERE qb.id = ANY(p_question_ids);
END;
$$;
