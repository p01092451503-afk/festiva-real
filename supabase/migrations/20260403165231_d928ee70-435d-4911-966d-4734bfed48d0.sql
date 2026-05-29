-- Allow teachers to insert assignments for their own courses
CREATE POLICY "Teachers can create assignments"
ON public.assignments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.courses
    WHERE courses.id = assignments.course_id
    AND courses.instructor_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Allow teachers to update their own assignments
CREATE POLICY "Teachers can update assignments"
ON public.assignments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.courses
    WHERE courses.id = assignments.course_id
    AND courses.instructor_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Allow teachers to delete their own assignments
CREATE POLICY "Teachers can delete assignments"
ON public.assignments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.courses
    WHERE courses.id = assignments.course_id
    AND courses.instructor_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);