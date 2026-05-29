-- Beneficiary Students Master Table
CREATE TABLE public.beneficiary_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_no text NOT NULL,
  full_name text NOT NULL,
  dept_name text,
  grade text,
  contact_phone text,
  contact_email text,
  program_name text,
  track text,
  cohort text,
  income_bracket smallint CHECK (income_bracket IS NULL OR (income_bracket BETWEEN 0 AND 10)),
  is_vulnerable boolean NOT NULL DEFAULT false,
  vulnerable_type text,
  nationality text,
  gender text,
  birth_year smallint,
  enrolled_on date,
  status text NOT NULL DEFAULT 'active',
  profile_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_no)
);

CREATE INDEX idx_ben_students_full_name ON public.beneficiary_students (full_name);
CREATE INDEX idx_ben_students_program ON public.beneficiary_students (program_name);
CREATE INDEX idx_ben_students_cohort ON public.beneficiary_students (cohort);
CREATE INDEX idx_ben_students_status ON public.beneficiary_students (status);
CREATE INDEX idx_ben_students_branch ON public.beneficiary_students (branch_id);
CREATE INDEX idx_ben_students_profile ON public.beneficiary_students (profile_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.beneficiary_students TO authenticated;
GRANT ALL ON public.beneficiary_students TO service_role;

ALTER TABLE public.beneficiary_students ENABLE ROW LEVEL SECURITY;

-- Admins / Super Admins: full access
CREATE POLICY "beneficiary_admin_all"
ON public.beneficiary_students
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Branch admins: view students in their branch
CREATE POLICY "beneficiary_branch_admin_view"
ON public.beneficiary_students
FOR SELECT
TO authenticated
USING (
  branch_id IS NOT NULL
  AND public.is_branch_admin_of(auth.uid(), branch_id)
);

-- Self view: linked student profile can view own record
CREATE POLICY "beneficiary_self_view"
ON public.beneficiary_students
FOR SELECT
TO authenticated
USING (profile_id = auth.uid());

-- updated_at trigger
CREATE TRIGGER trg_beneficiary_students_updated_at
BEFORE UPDATE ON public.beneficiary_students
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();