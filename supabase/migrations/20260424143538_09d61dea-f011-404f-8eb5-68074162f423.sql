-- ============================================================
-- 1) Assessment question i18n: hide correct_answer/explanation
--    until the student has completed at least one attempt.
-- ============================================================
DROP POLICY IF EXISTS "Enrolled users can view question i18n" ON public.assessment_question_i18n;

CREATE POLICY "View question i18n with answer protection"
ON public.assessment_question_i18n
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'teacher'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.assessment_questions q
    JOIN public.assessments a ON a.id = q.assessment_id
    JOIN public.assessment_attempts att
      ON att.assessment_id = a.id
     AND att.user_id = auth.uid()
     AND att.completed_at IS NOT NULL
    WHERE q.id = assessment_question_i18n.question_id
  )
);

-- Provide a SECURITY DEFINER function so enrolled students can still
-- read the localized question_text/options/hint (without the answer)
-- before they complete an attempt.
CREATE OR REPLACE FUNCTION public.get_assessment_question_i18n_for_student(
  p_assessment_id uuid,
  p_language_code text
)
RETURNS TABLE (
  question_id uuid,
  language_code text,
  question_text text,
  options jsonb,
  hint text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.question_id,
    i.language_code,
    i.question_text,
    i.options,
    i.hint
  FROM public.assessment_question_i18n i
  JOIN public.assessment_questions q ON q.id = i.question_id
  JOIN public.assessments a ON a.id = q.assessment_id
  JOIN public.enrollments e
    ON e.course_id = a.course_id
   AND e.user_id = auth.uid()
  WHERE q.assessment_id = p_assessment_id
    AND i.language_code = p_language_code
    AND a.is_published = true
  ORDER BY q.order_index;
$$;

GRANT EXECUTE ON FUNCTION public.get_assessment_question_i18n_for_student(uuid, text) TO authenticated;

-- ============================================================
-- 2) user_roles: prevent admin -> super_admin escalation
-- ============================================================
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;

CREATE POLICY "Admins can insert roles"
ON public.user_roles
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  -- Super admins may grant any role (including super_admin)
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    -- Regular admins may grant any role EXCEPT super_admin
    public.has_role(auth.uid(), 'admin'::app_role)
    AND role <> 'super_admin'::app_role
  )
);

-- Tighten DELETE/UPDATE: only super_admins may modify another super_admin row
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles"
ON public.user_roles
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND role <> 'super_admin'::app_role
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND role <> 'super_admin'::app_role
  )
);

DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles"
ON public.user_roles
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND role <> 'super_admin'::app_role
  )
);

-- ============================================================
-- 3) Storage: course-thumbnails — restrict uploads to teacher/admin
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can upload thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own thumbnails" ON storage.objects;

CREATE POLICY "Teachers/admins upload course thumbnails"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-thumbnails'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'teacher'::app_role))
);

CREATE POLICY "Teachers/admins update course thumbnails"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'course-thumbnails'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'teacher'::app_role))
)
WITH CHECK (
  bucket_id = 'course-thumbnails'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'teacher'::app_role))
);

CREATE POLICY "Teachers/admins delete course thumbnails"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-thumbnails'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'teacher'::app_role))
);

-- ============================================================
-- 4) Storage: banners — restrict to admin only
-- ============================================================
DROP POLICY IF EXISTS "Admins can upload banner images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete banner images" ON storage.objects;

CREATE POLICY "Admins upload banner images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'banners'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
);

CREATE POLICY "Admins update banner images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'banners'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
)
WITH CHECK (
  bucket_id = 'banners'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
);

CREATE POLICY "Admins delete banner images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'banners'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
);

-- ============================================================
-- 5) Storage: course-blocks — restrict to teacher/admin
-- ============================================================
DROP POLICY IF EXISTS "Admins and teachers can upload course block images" ON storage.objects;
DROP POLICY IF EXISTS "Admins and teachers can delete course block images" ON storage.objects;

CREATE POLICY "Teachers/admins upload course block images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-blocks'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'teacher'::app_role))
);

CREATE POLICY "Teachers/admins update course block images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'course-blocks'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'teacher'::app_role))
)
WITH CHECK (
  bucket_id = 'course-blocks'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'teacher'::app_role))
);

CREATE POLICY "Teachers/admins delete course block images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-blocks'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'teacher'::app_role))
);