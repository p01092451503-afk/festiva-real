
-- Allow admin and teacher to insert attendance
CREATE POLICY "Admin and teacher can insert attendance"
ON public.attendance
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role)
);

-- Allow admin and teacher to update attendance
CREATE POLICY "Admin and teacher can update attendance"
ON public.attendance
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role)
);

-- Allow admin and teacher to delete attendance
CREATE POLICY "Admin and teacher can delete attendance"
ON public.attendance
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role)
);
