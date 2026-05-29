
-- =========================================
-- 산학프로젝트 관리 (Industry-Academic Projects)
-- =========================================

-- 1) 프로젝트 마스터
CREATE TABLE public.ia_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  partner_company text,
  partner_contact text,
  partner_email text,
  partner_phone text,
  description text,
  category text,
  cohort text,
  starts_at date,
  ends_at date,
  budget numeric,
  status text NOT NULL DEFAULT 'planning', -- planning | active | on_hold | completed | cancelled
  progress integer NOT NULL DEFAULT 0,     -- 0~100 (수동 또는 마일스톤 기반)
  lead_teacher_id uuid,                    -- 담당 교수/멘토
  lead_teacher_name text,
  manager_name text,                       -- 사업단 담당자
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ia_projects_status ON public.ia_projects(status);
CREATE INDEX idx_ia_projects_cohort ON public.ia_projects(cohort);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_projects TO authenticated;
GRANT ALL ON public.ia_projects TO service_role;

ALTER TABLE public.ia_projects ENABLE ROW LEVEL SECURITY;

-- 관리자 전체 권한
CREATE POLICY "ia_projects_admin_all" ON public.ia_projects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 담당 교수 본인 프로젝트 조회/수정
CREATE POLICY "ia_projects_lead_view" ON public.ia_projects FOR SELECT TO authenticated
  USING (lead_teacher_id = auth.uid());

CREATE POLICY "ia_projects_lead_update" ON public.ia_projects FOR UPDATE TO authenticated
  USING (lead_teacher_id = auth.uid())
  WITH CHECK (lead_teacher_id = auth.uid());

CREATE TRIGGER trg_ia_projects_updated_at
BEFORE UPDATE ON public.ia_projects
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


-- 2) 프로젝트 멤버 (참여 학생/멘토)
CREATE TABLE public.ia_project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.ia_projects(id) ON DELETE CASCADE,
  user_id uuid,
  beneficiary_id uuid REFERENCES public.beneficiary_students(id) ON DELETE SET NULL,
  member_name text NOT NULL,
  member_email text,
  role text NOT NULL DEFAULT 'student',  -- student | mentor | manager
  joined_at date DEFAULT (now()::date),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
CREATE INDEX idx_ia_members_project ON public.ia_project_members(project_id);
CREATE INDEX idx_ia_members_user ON public.ia_project_members(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_project_members TO authenticated;
GRANT ALL ON public.ia_project_members TO service_role;

ALTER TABLE public.ia_project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ia_members_admin_all" ON public.ia_project_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "ia_members_self_view" ON public.ia_project_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.ia_projects p WHERE p.id = project_id AND p.lead_teacher_id = auth.uid())
  );


-- 3) 마일스톤
CREATE TABLE public.ia_project_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.ia_projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_date date,
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'pending',  -- pending | in_progress | done | overdue
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ia_milestones_project ON public.ia_project_milestones(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_project_milestones TO authenticated;
GRANT ALL ON public.ia_project_milestones TO service_role;

ALTER TABLE public.ia_project_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ia_milestones_admin_all" ON public.ia_project_milestones FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "ia_milestones_member_view" ON public.ia_project_milestones FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.ia_projects p WHERE p.id = project_id AND p.lead_teacher_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.ia_project_members m WHERE m.project_id = project_id AND m.user_id = auth.uid())
  );

CREATE TRIGGER trg_ia_milestones_updated_at
BEFORE UPDATE ON public.ia_project_milestones
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


-- 4) 산출물 (간단 메타데이터 + 파일 URL)
CREATE TABLE public.ia_project_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.ia_projects(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES public.ia_project_milestones(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  file_url text,
  file_name text,
  file_size bigint,
  submitted_by uuid,
  submitted_by_name text,
  status text NOT NULL DEFAULT 'submitted',  -- submitted | approved | rejected
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ia_deliv_project ON public.ia_project_deliverables(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_project_deliverables TO authenticated;
GRANT ALL ON public.ia_project_deliverables TO service_role;

ALTER TABLE public.ia_project_deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ia_deliv_admin_all" ON public.ia_project_deliverables FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "ia_deliv_member_view" ON public.ia_project_deliverables FOR SELECT TO authenticated
  USING (
    submitted_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.ia_projects p WHERE p.id = project_id AND p.lead_teacher_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.ia_project_members m WHERE m.project_id = project_id AND m.user_id = auth.uid())
  );

CREATE POLICY "ia_deliv_member_insert" ON public.ia_project_deliverables FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.ia_project_members m WHERE m.project_id = project_id AND m.user_id = auth.uid())
  );

CREATE TRIGGER trg_ia_deliv_updated_at
BEFORE UPDATE ON public.ia_project_deliverables
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


-- 5) 산출물용 스토리지 버킷 (비공개)
INSERT INTO storage.buckets (id, name, public) VALUES ('ia-deliverables', 'ia-deliverables', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "ia_deliv_storage_admin_all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'ia-deliverables' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')))
  WITH CHECK (bucket_id = 'ia-deliverables' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')));

CREATE POLICY "ia_deliv_storage_member_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ia-deliverables' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "ia_deliv_storage_self_view" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ia-deliverables' AND auth.uid()::text = (storage.foldername(name))[1]);
