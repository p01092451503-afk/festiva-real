CREATE TABLE public.course_custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_required boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.course_custom_fields TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_custom_fields TO authenticated;
GRANT ALL ON public.course_custom_fields TO service_role;
ALTER TABLE public.course_custom_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active custom fields" ON public.course_custom_fields FOR SELECT USING (is_active = true OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins manage custom fields" ON public.course_custom_fields FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE INDEX idx_course_custom_fields_course ON public.course_custom_fields(course_id);

CREATE TABLE public.order_custom_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  field_id uuid REFERENCES public.course_custom_fields(id) ON DELETE SET NULL,
  label text NOT NULL,
  value text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_custom_field_values TO authenticated;
GRANT ALL ON public.order_custom_field_values TO service_role;
ALTER TABLE public.order_custom_field_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own order field values" ON public.order_custom_field_values FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "Admins read order field values" ON public.order_custom_field_values FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE INDEX idx_order_custom_values_order ON public.order_custom_field_values(order_id);