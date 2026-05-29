
-- profiles.department_id -> SET NULL
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_department_id_fkey,
  ADD CONSTRAINT profiles_department_id_fkey
    FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

-- course_target_departments.department_id -> CASCADE
ALTER TABLE public.course_target_departments
  DROP CONSTRAINT IF EXISTS course_target_departments_department_id_fkey,
  ADD CONSTRAINT course_target_departments_department_id_fkey
    FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;

-- user_department_roles.department_id -> CASCADE
ALTER TABLE public.user_department_roles
  DROP CONSTRAINT IF EXISTS user_department_roles_department_id_fkey,
  ADD CONSTRAINT user_department_roles_department_id_fkey
    FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;

-- departments.parent_department_id -> SET NULL
ALTER TABLE public.departments
  DROP CONSTRAINT IF EXISTS departments_parent_department_id_fkey,
  ADD CONSTRAINT departments_parent_department_id_fkey
    FOREIGN KEY (parent_department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
