
-- 부서/팀 테이블 (계층 구조)
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT,
  code TEXT UNIQUE,
  parent_department_id UUID REFERENCES public.departments(id),
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 유저-부서-역할 매핑
CREATE TABLE IF NOT EXISTS public.user_department_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  dept_role TEXT NOT NULL CHECK (dept_role IN ('dept_admin', 'team_admin', 'learner')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, department_id)
);

-- profiles 테이블에 부서 연결 컬럼 추가
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id),
  ADD COLUMN IF NOT EXISTS team_name TEXT;

-- 강좌 대상 부서 매핑
CREATE TABLE IF NOT EXISTS public.course_target_departments (
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, department_id)
);

-- RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_department_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_target_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view departments"
ON public.departments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage departments"
ON public.departments FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own dept roles"
ON public.user_department_roles FOR SELECT TO authenticated USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.user_department_roles udr
    WHERE udr.user_id = auth.uid()
      AND udr.dept_role IN ('dept_admin', 'team_admin')
      AND udr.department_id = user_department_roles.department_id
  )
);

CREATE POLICY "Admins can manage dept roles"
ON public.user_department_roles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can view course targets"
ON public.course_target_departments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage course targets"
ON public.course_target_departments FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));
