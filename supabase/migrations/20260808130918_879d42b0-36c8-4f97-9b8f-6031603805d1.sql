-- ===== 1. 영상 원본 =====
CREATE TABLE public.content_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text,
  provider text NOT NULL DEFAULT 'bunny',
  video_key text,
  video_url text,
  thumbnail_url text,
  duration_seconds integer NOT NULL DEFAULT 0,
  resolution text,
  file_size_bytes bigint,
  drm_enabled boolean NOT NULL DEFAULT false,
  encoding_status text NOT NULL DEFAULT 'ready',
  is_active boolean NOT NULL DEFAULT true,
  memo text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_videos TO authenticated;
GRANT ALL ON public.content_videos TO service_role;
ALTER TABLE public.content_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage content_videos" ON public.content_videos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'teacher'));
CREATE POLICY "Authenticated read active videos" ON public.content_videos FOR SELECT TO authenticated USING (is_active);

-- ===== 2. 강의 그룹 =====
CREATE TABLE public.lecture_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  manager_id uuid,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lecture_groups TO authenticated;
GRANT ALL ON public.lecture_groups TO service_role;
ALTER TABLE public.lecture_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage lecture_groups" ON public.lecture_groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'teacher'));
CREATE POLICY "Authenticated read lecture_groups" ON public.lecture_groups FOR SELECT TO authenticated USING (is_active);

-- ===== 3. 강의(차시 원본) =====
CREATE TABLE public.lectures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.lecture_groups(id) ON DELETE SET NULL,
  video_id uuid REFERENCES public.content_videos(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  content_type text NOT NULL DEFAULT 'video',
  content_url text,
  content_width integer,
  content_height integer,
  play_time_seconds integer NOT NULL DEFAULT 0,
  credit_time_seconds integer NOT NULL DEFAULT 0,
  handout_url text,
  handout_name text,
  ai_chat_enabled boolean NOT NULL DEFAULT false,
  manager_id uuid,
  admin_memo text,
  is_active boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lectures TO authenticated;
GRANT ALL ON public.lectures TO service_role;
ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage lectures" ON public.lectures FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'teacher'));
CREATE POLICY "Authenticated read active lectures" ON public.lectures FOR SELECT TO authenticated USING (is_active);
CREATE INDEX idx_lectures_group ON public.lectures(group_id);
CREATE INDEX idx_lectures_video ON public.lectures(video_id);

-- ===== 4. 과정 <-> 강의 매핑 =====
CREATE TABLE public.course_lectures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lecture_id uuid NOT NULL REFERENCES public.lectures(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  credit_time_override integer,
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, lecture_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_lectures TO authenticated;
GRANT ALL ON public.course_lectures TO service_role;
ALTER TABLE public.course_lectures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage course_lectures" ON public.course_lectures FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'teacher'));
CREATE POLICY "Authenticated read course_lectures" ON public.course_lectures FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_course_lectures_course ON public.course_lectures(course_id);
CREATE INDEX idx_course_lectures_lecture ON public.course_lectures(lecture_id);

-- ===== 5. 과정 확장 컬럼 =====
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS use_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS price_display_type text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS monthly_price integer,
  ADD COLUMN IF NOT EXISTS free_price_label text,
  ADD COLUMN IF NOT EXISTS promo_label_text text,
  ADD COLUMN IF NOT EXISTS promo_label_color text,
  ADD COLUMN IF NOT EXISTS event_text text,
  ADD COLUMN IF NOT EXISTS vat_exempt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS extension_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS extension_price integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extension_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS suspension_max_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS suspension_max_days integer NOT NULL DEFAULT 0;

-- ===== 6. 수강 연장 이력 =====
CREATE TABLE public.course_extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  extend_days integer NOT NULL,
  price integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  previous_end_at timestamptz,
  new_end_at timestamptz,
  processed_by uuid,
  processed_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_extensions TO authenticated;
GRANT ALL ON public.course_extensions TO service_role;
ALTER TABLE public.course_extensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage course_extensions" ON public.course_extensions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'teacher'));
CREATE POLICY "Users view own course_extensions" ON public.course_extensions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users request own course_extensions" ON public.course_extensions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ===== 7. 일시정지 이력 =====
CREATE TABLE public.course_suspensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL DEFAULT now(),
  planned_end_at timestamptz,
  end_at timestamptz,
  days_used integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_suspensions TO authenticated;
GRANT ALL ON public.course_suspensions TO service_role;
ALTER TABLE public.course_suspensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage course_suspensions" ON public.course_suspensions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'teacher'));
CREATE POLICY "Users view own course_suspensions" ON public.course_suspensions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users create own course_suspensions" ON public.course_suspensions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users end own course_suspensions" ON public.course_suspensions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ===== 8. updated_at 트리거 =====
CREATE TRIGGER trg_content_videos_updated BEFORE UPDATE ON public.content_videos FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_lecture_groups_updated BEFORE UPDATE ON public.lecture_groups FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_lectures_updated BEFORE UPDATE ON public.lectures FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_course_lectures_updated BEFORE UPDATE ON public.course_lectures FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_course_extensions_updated BEFORE UPDATE ON public.course_extensions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_course_suspensions_updated BEFORE UPDATE ON public.course_suspensions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();