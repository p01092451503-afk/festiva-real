CREATE POLICY "Instructors/admins can delete contents"
ON public.course_contents
FOR DELETE
TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM courses
    WHERE courses.id = course_contents.course_id
      AND courses.instructor_id = auth.uid()
  ))
  OR has_role(auth.uid(), 'admin'::app_role)
);