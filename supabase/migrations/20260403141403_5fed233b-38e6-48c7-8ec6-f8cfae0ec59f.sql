CREATE POLICY "Teachers can view profiles of their students"
ON public.profiles FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND EXISTS (
    SELECT 1 FROM enrollments e
    JOIN courses c ON c.id = e.course_id
    WHERE e.user_id = profiles.user_id
    AND c.instructor_id = auth.uid()
  )
);