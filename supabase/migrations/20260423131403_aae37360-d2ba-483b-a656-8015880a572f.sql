-- ============================================
-- 1. Learning Tracks 메인 테이블
-- ============================================
CREATE TABLE public.learning_tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  description_en TEXT,
  thumbnail_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_learning_tracks_active ON public.learning_tracks(is_active, sort_order);

-- ============================================
-- 2. Track Steps (Foundation/BASIC/ADVANCED 단계)
-- ============================================
CREATE TABLE public.track_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id UUID NOT NULL REFERENCES public.learning_tracks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  description_en TEXT,
  level_order INTEGER NOT NULL DEFAULT 0,
  unlock_previous_required BOOLEAN NOT NULL DEFAULT true,
  badge_color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(track_id, level_order)
);

CREATE INDEX idx_track_steps_track ON public.track_steps(track_id, level_order);

-- ============================================
-- 3. Track Step Courses (단계별 강의 연결)
-- ============================================
CREATE TABLE public.track_step_courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  step_id UUID NOT NULL REFERENCES public.track_steps(id) ON DELETE CASCADE,
  course_id UUID NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(step_id, course_id)
);

CREATE INDEX idx_track_step_courses_step ON public.track_step_courses(step_id, sort_order);
CREATE INDEX idx_track_step_courses_course ON public.track_step_courses(course_id);

-- ============================================
-- 4. User Track Progress (사용자 진행 현황)
-- ============================================
CREATE TABLE public.user_track_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  track_id UUID NOT NULL REFERENCES public.learning_tracks(id) ON DELETE CASCADE,
  current_step_id UUID REFERENCES public.track_steps(id) ON DELETE SET NULL,
  completed_step_ids UUID[] NOT NULL DEFAULT '{}',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  last_accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, track_id)
);

CREATE INDEX idx_user_track_progress_user ON public.user_track_progress(user_id);
CREATE INDEX idx_user_track_progress_track ON public.user_track_progress(track_id);

-- ============================================
-- 5. departments 테이블에 글로벌 구조 컬럼 추가
-- ============================================
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS country_code TEXT,
  ADD COLUMN IF NOT EXISTS entity_type TEXT DEFAULT 'department';

CREATE INDEX IF NOT EXISTS idx_departments_country ON public.departments(country_code);
CREATE INDEX IF NOT EXISTS idx_departments_entity_type ON public.departments(entity_type);

COMMENT ON COLUMN public.departments.country_code IS 'ISO 3166-1 alpha-2 country code (e.g. US, JP, CN, KR)';
COMMENT ON COLUMN public.departments.entity_type IS 'country, entity, branch, team — 글로벌 대리점 계층 구분';

-- ============================================
-- 6. Updated_at Triggers
-- ============================================
CREATE TRIGGER trg_learning_tracks_updated
  BEFORE UPDATE ON public.learning_tracks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_track_steps_updated
  BEFORE UPDATE ON public.track_steps
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_user_track_progress_updated
  BEFORE UPDATE ON public.user_track_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================
-- 7. Row Level Security
-- ============================================
ALTER TABLE public.learning_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_step_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_track_progress ENABLE ROW LEVEL SECURITY;

-- learning_tracks 정책
CREATE POLICY "Anyone authenticated can view active tracks"
  ON public.learning_tracks FOR SELECT TO authenticated
  USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Admins and teachers can manage tracks"
  ON public.learning_tracks FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role));

-- track_steps 정책
CREATE POLICY "Anyone authenticated can view track steps"
  ON public.track_steps FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and teachers can manage track steps"
  ON public.track_steps FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role));

-- track_step_courses 정책
CREATE POLICY "Anyone authenticated can view step courses"
  ON public.track_step_courses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and teachers can manage step courses"
  ON public.track_step_courses FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role));

-- user_track_progress 정책
CREATE POLICY "Users can view own track progress"
  ON public.user_track_progress FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Users can manage own track progress"
  ON public.user_track_progress FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own track progress"
  ON public.user_track_progress FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Admins can delete track progress"
  ON public.user_track_progress FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));