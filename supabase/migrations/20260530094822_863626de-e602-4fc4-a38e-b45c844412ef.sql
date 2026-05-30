
CREATE POLICY "students update own pending correction requests"
ON public.correction_requests
FOR UPDATE
TO authenticated
USING (student_id = auth.uid() AND status = 'pending')
WITH CHECK (student_id = auth.uid() AND status = 'pending');

CREATE POLICY "students delete own pending correction requests"
ON public.correction_requests
FOR DELETE
TO authenticated
USING (student_id = auth.uid() AND status = 'pending');
