
-- Allow branch admins to view and issue certificates for their branch members
CREATE POLICY "Branch admins can view branch certificates"
ON public.certificates
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.departments d ON d.id = p.department_id
    WHERE p.user_id = certificates.user_id
      AND public.is_branch_admin_of(
        auth.uid(),
        COALESCE(d.parent_department_id, d.id)
      )
  )
);

CREATE POLICY "Branch admins can insert branch certificates"
ON public.certificates
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.departments d ON d.id = p.department_id
    WHERE p.user_id = certificates.user_id
      AND public.is_branch_admin_of(
        auth.uid(),
        COALESCE(d.parent_department_id, d.id)
      )
  )
);
