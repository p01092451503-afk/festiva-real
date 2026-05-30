CREATE TABLE public.correction_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  instructions TEXT,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  assigned_by UUID NOT NULL,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.correction_assignments TO authenticated;
GRANT ALL ON public.correction_assignments TO service_role;
CREATE INDEX idx_correction_assignments_assigned_by ON public.correction_assignments(assigned_by);
CREATE INDEX idx_correction_assignments_course ON public.correction_assignments(course_id);
ALTER TABLE public.correction_assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.correction_assignment_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES public.correction_assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'assigned',
  request_id UUID REFERENCES public.correction_requests(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.correction_assignment_targets TO authenticated;
GRANT ALL ON public.correction_assignment_targets TO service_role;
CREATE INDEX idx_correction_targets_student ON public.correction_assignment_targets(student_id);
CREATE INDEX idx_correction_targets_assignment ON public.correction_assignment_targets(assignment_id);
ALTER TABLE public.correction_assignment_targets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_correction_assignment(_assignment_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.correction_assignments a
    LEFT JOIN public.courses c ON c.id = a.course_id
    WHERE a.id = _assignment_id
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'super_admin'::app_role)
        OR a.assigned_by = auth.uid()
        OR c.instructor_id = auth.uid()
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_correction_assignment_target(_assignment_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.correction_assignment_targets t
    WHERE t.assignment_id = _assignment_id AND t.student_id = auth.uid()
  );
$$;

CREATE POLICY "admins manage correction assignments"
ON public.correction_assignments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "teachers manage own correction assignments"
ON public.correction_assignments FOR ALL TO authenticated
USING (
  assigned_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = correction_assignments.course_id AND c.instructor_id = auth.uid())
)
WITH CHECK (
  assigned_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = correction_assignments.course_id AND c.instructor_id = auth.uid())
);

CREATE POLICY "students view assigned correction assignments"
ON public.correction_assignments FOR SELECT TO authenticated
USING (public.is_correction_assignment_target(id));

CREATE POLICY "admins manage all correction targets"
ON public.correction_assignment_targets FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "owners manage correction targets"
ON public.correction_assignment_targets FOR ALL TO authenticated
USING (public.can_manage_correction_assignment(assignment_id))
WITH CHECK (public.can_manage_correction_assignment(assignment_id));

CREATE POLICY "students view own correction targets"
ON public.correction_assignment_targets FOR SELECT TO authenticated
USING (student_id = auth.uid());

CREATE POLICY "students update own correction targets"
ON public.correction_assignment_targets FOR UPDATE TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

CREATE TRIGGER update_correction_assignments_updated_at
BEFORE UPDATE ON public.correction_assignments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER update_correction_targets_updated_at
BEFORE UPDATE ON public.correction_assignment_targets
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();