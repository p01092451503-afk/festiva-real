
-- evidence_categories
CREATE TABLE public.evidence_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  scope text NOT NULL DEFAULT 'general', -- general | program | project
  is_required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_evcat_scope ON public.evidence_categories(scope);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidence_categories TO authenticated;
GRANT ALL ON public.evidence_categories TO service_role;

ALTER TABLE public.evidence_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evcat_admin_all" ON public.evidence_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "evcat_view_active" ON public.evidence_categories FOR SELECT TO authenticated
  USING (active = true);

CREATE TRIGGER trg_evcat_updated_at
BEFORE UPDATE ON public.evidence_categories
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- evidence_submissions
CREATE TABLE public.evidence_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.evidence_categories(id) ON DELETE RESTRICT,
  program_id uuid REFERENCES public.programs(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.ia_projects(id) ON DELETE SET NULL,
  beneficiary_id uuid REFERENCES public.beneficiary_students(id) ON DELETE SET NULL,
  submitted_by uuid NOT NULL,
  submitter_name text,
  title text NOT NULL,
  note text,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size integer,
  file_mime text,
  status text NOT NULL DEFAULT 'submitted', -- submitted | approved | rejected | changes_requested
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_evsub_category ON public.evidence_submissions(category_id);
CREATE INDEX idx_evsub_program ON public.evidence_submissions(program_id);
CREATE INDEX idx_evsub_project ON public.evidence_submissions(project_id);
CREATE INDEX idx_evsub_user ON public.evidence_submissions(submitted_by);
CREATE INDEX idx_evsub_status ON public.evidence_submissions(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidence_submissions TO authenticated;
GRANT ALL ON public.evidence_submissions TO service_role;

ALTER TABLE public.evidence_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evsub_admin_all" ON public.evidence_submissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "evsub_self_view" ON public.evidence_submissions FOR SELECT TO authenticated
  USING (submitted_by = auth.uid());

CREATE POLICY "evsub_self_insert" ON public.evidence_submissions FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "evsub_self_update" ON public.evidence_submissions FOR UPDATE TO authenticated
  USING (submitted_by = auth.uid() AND status IN ('submitted','changes_requested'))
  WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "evsub_self_delete" ON public.evidence_submissions FOR DELETE TO authenticated
  USING (submitted_by = auth.uid() AND status IN ('submitted','changes_requested'));

CREATE TRIGGER trg_evsub_updated_at
BEFORE UPDATE ON public.evidence_submissions
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('evidence-files', 'evidence-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "evidence_files_admin_all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'evidence-files' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')))
  WITH CHECK (bucket_id = 'evidence-files' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')));

CREATE POLICY "evidence_files_self_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'evidence-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "evidence_files_self_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'evidence-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "evidence_files_self_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'evidence-files' AND auth.uid()::text = (storage.foldername(name))[1]);
