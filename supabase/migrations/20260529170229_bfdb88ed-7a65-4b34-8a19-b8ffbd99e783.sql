
-- Fix enrollments RLS to include super_admin (matches project convention)
DROP POLICY IF EXISTS "Admins and teachers can update enrollments" ON public.enrollments;
CREATE POLICY "Admins and teachers can update enrollments"
ON public.enrollments
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'teacher'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'teacher'::app_role)
);

DROP POLICY IF EXISTS "Users can view own enrollments" ON public.enrollments;
CREATE POLICY "Users can view own enrollments"
ON public.enrollments
FOR SELECT
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'teacher'::app_role)
);

DROP POLICY IF EXISTS "Users can enroll" ON public.enrollments;
CREATE POLICY "Users can enroll"
ON public.enrollments
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Add DELETE policy for admins/super_admins (was missing entirely)
DROP POLICY IF EXISTS "Admins can delete enrollments" ON public.enrollments;
CREATE POLICY "Admins can delete enrollments"
ON public.enrollments
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Approve the already-submitted enrollments for test@test.co.kr that admin "approved" but were blocked
UPDATE public.enrollments
SET status = 'approved', reviewed_at = now()
WHERE user_id = 'f61dbfb0-c75c-464d-93e1-2e768c08d273'
  AND status = 'pending';
