
-- ===========================================
-- 1) Tables
-- ===========================================

-- Capability master list
CREATE TABLE IF NOT EXISTS public.branch_admin_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ko text NOT NULL,
  name_en text NOT NULL,
  description_ko text,
  description_en text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.branch_admin_capabilities (code, name_ko, name_en, description_ko, description_en, sort_order) VALUES
  ('track_manage', '트랙 관리', 'Track Management', '자기 지점용 학습 트랙 생성/수정/삭제', 'Create/edit/delete learning tracks for own branch', 10),
  ('staff_manage', '직원 관리', 'Staff Management', '자기 지점 소속 직원 정보 조회 및 편집', 'View and edit staff profiles in own branch', 20),
  ('track_assign', '트랙/강의 배정', 'Track/Course Assignment', '자기 지점 직원에게 트랙·강의 배정', 'Assign tracks and courses to staff in own branch', 30),
  ('stats_view', '학습 통계 조회', 'Learning Statistics', '자기 지점 직원의 학습 진도/완료율 조회', 'View learning progress and completion stats for own branch', 40)
ON CONFLICT (code) DO NOTHING;

-- Branch -> manager assignment
CREATE TABLE IF NOT EXISTS public.branch_admin_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_baa_user ON public.branch_admin_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_baa_branch ON public.branch_admin_assignments(branch_id);

-- Per-(user, branch, capability) toggles
CREATE TABLE IF NOT EXISTS public.branch_admin_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  capability_code text NOT NULL REFERENCES public.branch_admin_capabilities(code) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, branch_id, capability_code)
);

CREATE INDEX IF NOT EXISTS idx_bap_user ON public.branch_admin_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_bap_branch ON public.branch_admin_permissions(branch_id);

-- Trigger for updated_at
CREATE TRIGGER trg_baa_updated_at BEFORE UPDATE ON public.branch_admin_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_bap_updated_at BEFORE UPDATE ON public.branch_admin_permissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===========================================
-- 2) Helper functions
-- ===========================================

CREATE OR REPLACE FUNCTION public.is_branch_admin_of(_user_id uuid, _branch_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.branch_admin_assignments
    WHERE user_id = _user_id AND branch_id = _branch_id
  )
$$;

CREATE OR REPLACE FUNCTION public.has_branch_capability(_user_id uuid, _branch_id uuid, _capability text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.branch_admin_assignments a
    JOIN public.branch_admin_permissions p
      ON p.user_id = a.user_id AND p.branch_id = a.branch_id
    WHERE a.user_id = _user_id
      AND a.branch_id = _branch_id
      AND p.capability_code = _capability
      AND p.enabled = true
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_branch_admin_branches(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(array_agg(branch_id), ARRAY[]::uuid[])
  FROM public.branch_admin_assignments
  WHERE user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.user_has_any_branch_capability(_user_id uuid, _capability text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.branch_admin_assignments a
    JOIN public.branch_admin_permissions p
      ON p.user_id = a.user_id AND p.branch_id = a.branch_id
    WHERE a.user_id = _user_id
      AND p.capability_code = _capability
      AND p.enabled = true
  )
$$;

-- ===========================================
-- 3) Enable RLS + policies on new tables
-- ===========================================

ALTER TABLE public.branch_admin_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_admin_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_admin_permissions ENABLE ROW LEVEL SECURITY;

-- capabilities: anyone authenticated can read; only super_admin/admin can manage
CREATE POLICY "capabilities readable by authenticated"
  ON public.branch_admin_capabilities FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "capabilities admin manage"
  ON public.branch_admin_capabilities FOR ALL
  TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

-- assignments
CREATE POLICY "assignments admin all"
  ON public.branch_admin_assignments FOR ALL
  TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

CREATE POLICY "assignments self read"
  ON public.branch_admin_assignments FOR SELECT
  TO authenticated USING (user_id = auth.uid());

-- permissions
CREATE POLICY "permissions admin all"
  ON public.branch_admin_permissions FOR ALL
  TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

CREATE POLICY "permissions self read"
  ON public.branch_admin_permissions FOR SELECT
  TO authenticated USING (user_id = auth.uid());

-- ===========================================
-- 4) Extend existing table policies for branch_admin
-- ===========================================

-- learning_tracks: branch admin with track_manage can CRUD tracks targeted at their branches
DROP POLICY IF EXISTS "branch_admin manage own tracks" ON public.learning_tracks;
CREATE POLICY "branch_admin manage own tracks"
  ON public.learning_tracks FOR ALL
  TO authenticated
  USING (
    target_scope = 'targeted'
    AND target_branch_ids && public.get_user_branch_admin_branches(auth.uid())
    AND public.user_has_any_branch_capability(auth.uid(), 'track_manage')
  )
  WITH CHECK (
    target_scope = 'targeted'
    AND target_branch_ids && public.get_user_branch_admin_branches(auth.uid())
    AND public.user_has_any_branch_capability(auth.uid(), 'track_manage')
  );

-- track_steps: allow if parent track is owned by this branch admin
DROP POLICY IF EXISTS "branch_admin manage track steps" ON public.track_steps;
CREATE POLICY "branch_admin manage track steps"
  ON public.track_steps FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.learning_tracks t
      WHERE t.id = track_steps.track_id
        AND t.target_scope = 'targeted'
        AND t.target_branch_ids && public.get_user_branch_admin_branches(auth.uid())
        AND public.user_has_any_branch_capability(auth.uid(), 'track_manage')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.learning_tracks t
      WHERE t.id = track_steps.track_id
        AND t.target_scope = 'targeted'
        AND t.target_branch_ids && public.get_user_branch_admin_branches(auth.uid())
        AND public.user_has_any_branch_capability(auth.uid(), 'track_manage')
    )
  );

-- enrollments: branch_admin with track_assign can manage enrollments for staff in their branches
-- Need to find branch of target user. Branch = profile's branch (top-level dept).
CREATE OR REPLACE FUNCTION public.get_user_branch_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN d.parent_department_id IS NOT NULL THEN d.parent_department_id
    ELSE d.id
  END
  FROM public.profiles p
  LEFT JOIN public.departments d ON d.id = p.department_id
  WHERE p.user_id = _user_id
$$;

DROP POLICY IF EXISTS "branch_admin manage staff enrollments" ON public.enrollments;
CREATE POLICY "branch_admin manage staff enrollments"
  ON public.enrollments FOR ALL
  TO authenticated
  USING (
    public.get_user_branch_id(enrollments.user_id) = ANY(public.get_user_branch_admin_branches(auth.uid()))
    AND public.user_has_any_branch_capability(auth.uid(), 'track_assign')
  )
  WITH CHECK (
    public.get_user_branch_id(enrollments.user_id) = ANY(public.get_user_branch_admin_branches(auth.uid()))
    AND public.user_has_any_branch_capability(auth.uid(), 'track_assign')
  );

-- profiles: branch_admin with staff_manage or stats_view can read profiles in own branch
DROP POLICY IF EXISTS "branch_admin read staff profiles" ON public.profiles;
CREATE POLICY "branch_admin read staff profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.get_user_branch_id(profiles.user_id) = ANY(public.get_user_branch_admin_branches(auth.uid()))
    AND (
      public.user_has_any_branch_capability(auth.uid(), 'staff_manage')
      OR public.user_has_any_branch_capability(auth.uid(), 'stats_view')
    )
  );

DROP POLICY IF EXISTS "branch_admin update staff profiles" ON public.profiles;
CREATE POLICY "branch_admin update staff profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    public.get_user_branch_id(profiles.user_id) = ANY(public.get_user_branch_admin_branches(auth.uid()))
    AND public.user_has_any_branch_capability(auth.uid(), 'staff_manage')
  )
  WITH CHECK (
    public.get_user_branch_id(profiles.user_id) = ANY(public.get_user_branch_admin_branches(auth.uid()))
    AND public.user_has_any_branch_capability(auth.uid(), 'staff_manage')
  );

-- content_progress: branch_admin with stats_view can read for own branch staff
DROP POLICY IF EXISTS "branch_admin read content progress" ON public.content_progress;
CREATE POLICY "branch_admin read content progress"
  ON public.content_progress FOR SELECT
  TO authenticated
  USING (
    public.get_user_branch_id(content_progress.user_id) = ANY(public.get_user_branch_admin_branches(auth.uid()))
    AND public.user_has_any_branch_capability(auth.uid(), 'stats_view')
  );
