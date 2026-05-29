-- programs
CREATE TABLE public.programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text,
  location text,
  capacity integer,
  starts_at timestamptz,
  ends_at timestamptz,
  apply_starts_at timestamptz,
  apply_ends_at timestamptz,
  manager_name text,
  contact text,
  budget numeric,
  status text NOT NULL DEFAULT 'draft',
  form_schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  cover_image_url text,
  is_public boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_programs_status ON public.programs(status);
CREATE INDEX idx_programs_starts_at ON public.programs(starts_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.programs TO authenticated;
GRANT ALL ON public.programs TO service_role;

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "programs_admin_all" ON public.programs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "programs_public_view" ON public.programs FOR SELECT TO authenticated
  USING (is_public = true AND status IN ('open','closed','completed'));

CREATE TRIGGER trg_programs_updated_at
BEFORE UPDATE ON public.programs
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- program_applications
CREATE TABLE public.program_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  applicant_user_id uuid,
  beneficiary_id uuid REFERENCES public.beneficiary_students(id) ON DELETE SET NULL,
  applicant_name text NOT NULL,
  applicant_email text,
  applicant_phone text,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, applicant_user_id)
);
CREATE INDEX idx_papp_program ON public.program_applications(program_id);
CREATE INDEX idx_papp_user ON public.program_applications(applicant_user_id);
CREATE INDEX idx_papp_status ON public.program_applications(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_applications TO authenticated;
GRANT ALL ON public.program_applications TO service_role;

ALTER TABLE public.program_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "papp_admin_all" ON public.program_applications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "papp_self_view" ON public.program_applications FOR SELECT TO authenticated
  USING (applicant_user_id = auth.uid());

CREATE POLICY "papp_self_insert" ON public.program_applications FOR INSERT TO authenticated
  WITH CHECK (
    applicant_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_id AND p.is_public = true AND p.status = 'open')
  );

CREATE POLICY "papp_self_cancel" ON public.program_applications FOR UPDATE TO authenticated
  USING (applicant_user_id = auth.uid())
  WITH CHECK (applicant_user_id = auth.uid() AND status IN ('pending','cancelled'));

CREATE TRIGGER trg_papp_updated_at
BEFORE UPDATE ON public.program_applications
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- program_attendance
CREATE TABLE public.program_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES public.program_applications(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  session_label text NOT NULL DEFAULT '본 회차',
  status text NOT NULL DEFAULT 'present',
  checked_in_at timestamptz,
  checked_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, session_date, session_label)
);
CREATE INDEX idx_patt_program ON public.program_attendance(program_id);
CREATE INDEX idx_patt_app ON public.program_attendance(application_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_attendance TO authenticated;
GRANT ALL ON public.program_attendance TO service_role;

ALTER TABLE public.program_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patt_admin_all" ON public.program_attendance FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "patt_self_view" ON public.program_attendance FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.program_applications a
    WHERE a.id = application_id AND a.applicant_user_id = auth.uid()
  ));

CREATE TRIGGER trg_patt_updated_at
BEFORE UPDATE ON public.program_attendance
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();