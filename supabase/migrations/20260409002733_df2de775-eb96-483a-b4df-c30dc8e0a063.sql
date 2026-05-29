-- Assessment i18n table
CREATE TABLE public.assessment_i18n (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, language_code)
);

ALTER TABLE public.assessment_i18n ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers/admins can manage assessment i18n"
ON public.assessment_i18n FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Enrolled users can view assessment i18n"
ON public.assessment_i18n FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM assessments a
    JOIN enrollments e ON e.course_id = a.course_id AND e.user_id = auth.uid()
    WHERE a.id = assessment_i18n.assessment_id
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'teacher'::app_role)
);

-- Assessment question i18n table
CREATE TABLE public.assessment_question_i18n (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB,
  correct_answer TEXT,
  explanation TEXT,
  hint TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (question_id, language_code)
);

ALTER TABLE public.assessment_question_i18n ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers/admins can manage question i18n"
ON public.assessment_question_i18n FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Enrolled users can view question i18n"
ON public.assessment_question_i18n FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM assessment_questions q
    JOIN assessments a ON a.id = q.assessment_id
    JOIN enrollments e ON e.course_id = a.course_id AND e.user_id = auth.uid()
    WHERE q.id = assessment_question_i18n.question_id
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'teacher'::app_role)
);