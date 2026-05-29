
-- 1. Create a security-definer function to safely fetch questions without exposing answers
-- Students get questions WITHOUT correct_answer/explanation until they complete the attempt
CREATE OR REPLACE FUNCTION public.get_assessment_questions_for_student(p_assessment_id uuid)
RETURNS TABLE (
  id uuid,
  assessment_id uuid,
  question_type question_type,
  question_text text,
  options jsonb,
  points integer,
  order_index integer,
  hint text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    q.id,
    q.assessment_id,
    q.question_type,
    q.question_text,
    q.options,
    q.points,
    q.order_index,
    q.hint
  FROM public.assessment_questions q
  JOIN public.assessments a ON a.id = q.assessment_id
  JOIN public.enrollments e ON e.course_id = a.course_id AND e.user_id = auth.uid()
  WHERE q.assessment_id = p_assessment_id
    AND a.is_published = true
  ORDER BY q.order_index;
$$;

-- 2. Create a function to get questions WITH answers (only after completing attempt)
CREATE OR REPLACE FUNCTION public.get_assessment_questions_with_answers(p_assessment_id uuid)
RETURNS TABLE (
  id uuid,
  assessment_id uuid,
  question_type question_type,
  question_text text,
  options jsonb,
  correct_answer text,
  points integer,
  order_index integer,
  explanation text,
  hint text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    q.id,
    q.assessment_id,
    q.question_type,
    q.question_text,
    q.options,
    q.correct_answer,
    q.points,
    q.order_index,
    q.explanation,
    q.hint
  FROM public.assessment_questions q
  WHERE q.assessment_id = p_assessment_id
    AND (
      -- Teachers/admins always see answers
      has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'teacher')
      -- Students only after completing at least one attempt
      OR EXISTS (
        SELECT 1 FROM public.assessment_attempts att
        WHERE att.assessment_id = p_assessment_id
          AND att.user_id = auth.uid()
          AND att.completed_at IS NOT NULL
      )
    )
  ORDER BY q.order_index;
$$;

-- 3. Drop existing permissive student SELECT policy on assessment_questions
DROP POLICY IF EXISTS "Enrolled users can view questions" ON public.assessment_questions;

-- 4. Recreate: only teachers/admins can directly SELECT from assessment_questions base table
CREATE POLICY "Only teachers/admins can view questions directly"
  ON public.assessment_questions
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role)
  );

-- 5. Fix user_roles: drop old permissive ALL policy for admins and replace with specific ones
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Admins can view all roles
CREATE POLICY "Admins can view all roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert roles (but not super_admin)
CREATE POLICY "Admins can insert roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    AND role != 'super_admin'::app_role
  );

-- Admins can update roles (but not to super_admin, and cannot change super_admin)
CREATE POLICY "Admins can update roles"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND role != 'super_admin'::app_role
  )
  WITH CHECK (
    role != 'super_admin'::app_role
  );

-- Admins can delete roles (but not super_admin roles)
CREATE POLICY "Admins can delete roles"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND role != 'super_admin'::app_role
  );
