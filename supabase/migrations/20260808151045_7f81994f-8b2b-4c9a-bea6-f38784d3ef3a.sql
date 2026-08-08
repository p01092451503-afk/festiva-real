
CREATE TABLE public.micro_content_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.micro_contents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (content_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.micro_content_assignments TO authenticated;
GRANT ALL ON public.micro_content_assignments TO service_role;
ALTER TABLE public.micro_content_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "micro assignments own read" ON public.micro_content_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'teacher'));
CREATE POLICY "micro assignments admin manage" ON public.micro_content_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
