-- Add enrollment status
CREATE TYPE public.enrollment_status AS ENUM ('pending', 'approved', 'rejected');

-- Add status column with default 'pending' for new enrollments
ALTER TABLE public.enrollments ADD COLUMN status public.enrollment_status NOT NULL DEFAULT 'pending';

-- Set all existing enrollments to 'approved'
UPDATE public.enrollments SET status = 'approved';

-- Add reviewed_by and reviewed_at columns
ALTER TABLE public.enrollments ADD COLUMN reviewed_by uuid;
ALTER TABLE public.enrollments ADD COLUMN reviewed_at timestamptz;

-- Drop existing UPDATE restriction and add update policy for admins/teachers
CREATE POLICY "Admins and teachers can update enrollments"
ON public.enrollments
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role));