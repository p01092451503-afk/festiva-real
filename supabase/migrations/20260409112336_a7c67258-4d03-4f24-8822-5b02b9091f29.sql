
-- Survey per course
CREATE TABLE public.surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Survey questions
CREATE TYPE public.survey_question_type AS ENUM ('multiple_choice', 'text', 'rating');

CREATE TABLE public.survey_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  question_type survey_question_type NOT NULL DEFAULT 'multiple_choice',
  question_text text NOT NULL,
  options jsonb, -- for multiple_choice: ["option1","option2",...]
  order_index integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Student survey response (one per user per survey)
CREATE TABLE public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(survey_id, user_id)
);

-- Individual answers
CREATE TABLE public.survey_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES public.survey_responses(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.survey_questions(id) ON DELETE CASCADE,
  answer_text text,
  answer_value integer, -- for rating type
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_answers ENABLE ROW LEVEL SECURITY;

-- Surveys policies
CREATE POLICY "Admins/teachers can manage surveys" ON public.surveys FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'teacher'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'teacher'));

CREATE POLICY "Enrolled completed users can view active surveys" ON public.surveys FOR SELECT TO authenticated
  USING (is_active = true AND EXISTS (
    SELECT 1 FROM enrollments e WHERE e.course_id = surveys.course_id AND e.user_id = auth.uid() AND e.completed_at IS NOT NULL
  ));

-- Survey questions policies
CREATE POLICY "Admins/teachers can manage survey questions" ON public.survey_questions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'teacher'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'teacher'));

CREATE POLICY "Users can view questions of active surveys" ON public.survey_questions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM surveys s
    JOIN enrollments e ON e.course_id = s.course_id AND e.user_id = auth.uid() AND e.completed_at IS NOT NULL
    WHERE s.id = survey_questions.survey_id AND s.is_active = true
  ));

-- Survey responses policies
CREATE POLICY "Users can insert own response" ON public.survey_responses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own responses" ON public.survey_responses FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins/teachers can view all responses" ON public.survey_responses FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'teacher'));

-- Survey answers policies
CREATE POLICY "Users can insert own answers" ON public.survey_answers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM survey_responses r WHERE r.id = survey_answers.response_id AND r.user_id = auth.uid()
  ));

CREATE POLICY "Users can view own answers" ON public.survey_answers FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM survey_responses r WHERE r.id = survey_answers.response_id AND r.user_id = auth.uid()
  ));

CREATE POLICY "Admins/teachers can view all answers" ON public.survey_answers FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'teacher'));

-- Indexes
CREATE INDEX idx_surveys_course_id ON public.surveys(course_id);
CREATE INDEX idx_survey_questions_survey_id ON public.survey_questions(survey_id);
CREATE INDEX idx_survey_responses_survey_id ON public.survey_responses(survey_id);
CREATE INDEX idx_survey_responses_user_id ON public.survey_responses(user_id);
