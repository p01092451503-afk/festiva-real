-- Tighten tenants RLS: restrict super_admin policy to authenticated role only
-- (was applied to {public} which includes anon — anon was blocked by has_role()
-- check anyway, but explicit role narrowing prevents accidental exposure if
-- the function ever changes behavior).

DROP POLICY IF EXISTS "Super admins can manage tenants" ON public.tenants;

CREATE POLICY "Super admins can manage tenants"
ON public.tenants
AS PERMISSIVE
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Ensure RLS is enforced (defense-in-depth)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants FORCE ROW LEVEL SECURITY;

-- Revoke any direct table privileges from anon to prevent bypass
-- attempts via PostgREST when no policy applies.
REVOKE ALL ON public.tenants FROM anon;
REVOKE ALL ON public.tenants FROM PUBLIC;

-- Grant minimum required to authenticated (RLS still gates row visibility)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;