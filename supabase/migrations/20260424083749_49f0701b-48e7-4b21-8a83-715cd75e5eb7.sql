-- Add targeting columns to announcements
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS target_scope text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS target_country_code text,
  ADD COLUMN IF NOT EXISTS target_branch_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL;

-- Constraint: scope must be valid
ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_target_scope_check;
ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_target_scope_check
  CHECK (target_scope IN ('all', 'country', 'branch', 'course'));

-- Add targeting columns to board_posts (course_id already exists, add scope/country/branch)
ALTER TABLE public.board_posts
  ADD COLUMN IF NOT EXISTS target_scope text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS target_country_code text,
  ADD COLUMN IF NOT EXISTS target_branch_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

ALTER TABLE public.board_posts
  DROP CONSTRAINT IF EXISTS board_posts_target_scope_check;
ALTER TABLE public.board_posts
  ADD CONSTRAINT board_posts_target_scope_check
  CHECK (target_scope IN ('all', 'country', 'branch', 'course'));

-- Backfill: existing board_posts with course_id should have scope='course'
UPDATE public.board_posts SET target_scope = 'course' WHERE course_id IS NOT NULL AND target_scope = 'all';

-- Indexes for filter performance
CREATE INDEX IF NOT EXISTS idx_announcements_target ON public.announcements(target_scope, target_country_code, target_branch_id, target_course_id);
CREATE INDEX IF NOT EXISTS idx_board_posts_target ON public.board_posts(target_scope, target_country_code, target_branch_id, course_id);