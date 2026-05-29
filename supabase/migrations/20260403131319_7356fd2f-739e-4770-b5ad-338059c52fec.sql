
-- 1. Enum 타입
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'student');
CREATE TYPE public.content_type AS ENUM ('video', 'document', 'quiz', 'assignment', 'live');
CREATE TYPE public.video_provider AS ENUM ('youtube', 'vimeo', 'custom', 'upload');
CREATE TYPE public.assignment_status AS ENUM ('draft', 'published', 'closed');
CREATE TYPE public.submission_status AS ENUM ('submitted', 'graded', 'returned');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late', 'excused');

-- 2. 모든 테이블 생성 (순서 중요: FK 의존성 순)
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT, avatar_url TEXT, phone_number TEXT, department TEXT,
  position TEXT, employee_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, description TEXT,
  display_order INT DEFAULT 0, is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL, description TEXT,
  category_id UUID REFERENCES public.categories(id),
  instructor_id UUID REFERENCES auth.users(id),
  thumbnail_url TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  difficulty_level TEXT DEFAULT 'beginner' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  estimated_duration_hours INT DEFAULT 0, max_students INT,
  is_mandatory BOOLEAN DEFAULT false, deadline DATE,
  target_departments TEXT[], version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  progress DECIMAL DEFAULT 0,
  enrolled_at TIMESTAMPTZ DEFAULT now(), completed_at TIMESTAMPTZ,
  UNIQUE(user_id, course_id)
);

CREATE TABLE public.course_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT,
  content_type content_type DEFAULT 'video',
  video_url TEXT, video_provider video_provider,
  duration_minutes INT, order_index INT DEFAULT 0,
  is_published BOOLEAN DEFAULT false, is_preview BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.content_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.course_contents(id) ON DELETE CASCADE,
  progress_percentage DECIMAL DEFAULT 0,
  last_position_seconds INT DEFAULT 0,
  completed BOOLEAN DEFAULT false, completed_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, content_id)
);

CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT, instructions TEXT,
  due_date TIMESTAMPTZ, max_score INT DEFAULT 100,
  status assignment_status DEFAULT 'draft',
  allow_late_submission BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id),
  submission_text TEXT, file_urls TEXT[],
  score INT, feedback TEXT,
  status submission_status DEFAULT 'submitted',
  graded_by UUID REFERENCES auth.users(id), graded_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  course_id UUID NOT NULL REFERENCES public.courses(id),
  attendance_date DATE DEFAULT CURRENT_DATE,
  status attendance_status DEFAULT 'present',
  check_in_time TIMESTAMPTZ, notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, message TEXT NOT NULL,
  type TEXT DEFAULT 'info', is_read BOOLEAN DEFAULT false,
  action_url TEXT, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, description TEXT,
  icon TEXT NOT NULL, badge_type TEXT NOT NULL,
  requirement_type TEXT NOT NULL, requirement_value INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

CREATE TABLE public.user_gamification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points INT DEFAULT 0, level INT DEFAULT 1,
  experience_points INT DEFAULT 0, streak_days INT DEFAULT 0,
  last_activity_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE public.point_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points INT NOT NULL, action_type TEXT NOT NULL, description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS 활성화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_gamification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_history ENABLE ROW LEVEL SECURITY;

-- 4. has_role 함수 (RLS에서 사용)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- 5. RLS 정책
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view published courses" ON public.courses FOR SELECT TO authenticated USING (status = 'published' OR instructor_id = auth.uid() OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can create courses" ON public.courses FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'teacher') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners/admins can update courses" ON public.courses FOR UPDATE TO authenticated USING (instructor_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own enrollments" ON public.enrollments FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'teacher'));
CREATE POLICY "Users can enroll" ON public.enrollments FOR INSERT WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Enrolled users can view contents" ON public.course_contents FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.enrollments WHERE user_id = auth.uid() AND course_id = course_contents.course_id)
  OR EXISTS (SELECT 1 FROM public.courses WHERE id = course_contents.course_id AND instructor_id = auth.uid())
  OR has_role(auth.uid(), 'admin') OR is_preview = true
);
CREATE POLICY "Instructors/admins can manage contents" ON public.course_contents FOR ALL USING (
  EXISTS (SELECT 1 FROM public.courses WHERE id = course_contents.course_id AND instructor_id = auth.uid())
  OR has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can manage own progress" ON public.content_progress FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins/teachers can view progress" ON public.content_progress FOR SELECT USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'teacher'));

CREATE POLICY "Enrolled users can view assignments" ON public.assignments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.enrollments WHERE user_id = auth.uid() AND course_id = assignments.course_id)
  OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'teacher')
);

CREATE POLICY "Students can manage own submissions" ON public.assignment_submissions FOR ALL USING (auth.uid() = student_id);
CREATE POLICY "Teachers/admins can view/grade" ON public.assignment_submissions FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'teacher'));

CREATE POLICY "Users can view own attendance" ON public.attendance FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'teacher'));

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view badges" ON public.badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage badges" ON public.badges FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own badges" ON public.user_badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view badges for leaderboard" ON public.user_badges FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view own gamification" ON public.user_gamification FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view for leaderboard" ON public.user_gamification FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view own points" ON public.point_history FOR SELECT USING (auth.uid() = user_id);

-- 6. 게이미피케이션 함수들
CREATE OR REPLACE FUNCTION public.check_and_award_badges(p_user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  badge_record RECORD;
  user_value INT;
BEGIN
  FOR badge_record IN
    SELECT * FROM public.badges WHERE id NOT IN (SELECT badge_id FROM public.user_badges WHERE user_id = p_user_id)
  LOOP
    user_value := 0;
    CASE badge_record.requirement_type
      WHEN 'points' THEN SELECT total_points INTO user_value FROM public.user_gamification WHERE user_id = p_user_id;
      WHEN 'streak' THEN SELECT streak_days INTO user_value FROM public.user_gamification WHERE user_id = p_user_id;
      WHEN 'courses_completed' THEN SELECT COUNT(*) INTO user_value FROM public.enrollments WHERE user_id = p_user_id AND completed_at IS NOT NULL;
      WHEN 'lessons_completed' THEN SELECT COUNT(*) INTO user_value FROM public.content_progress WHERE user_id = p_user_id AND completed = true;
      WHEN 'assignments_completed' THEN SELECT COUNT(*) INTO user_value FROM public.assignment_submissions WHERE student_id = p_user_id AND status = 'graded';
    END CASE;
    IF user_value >= badge_record.requirement_value THEN
      INSERT INTO public.user_badges (user_id, badge_id) VALUES (p_user_id, badge_record.id) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_points(p_user_id UUID, p_points INT, p_action_type TEXT, p_description TEXT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_new_level INT; v_experience INT;
BEGIN
  INSERT INTO public.point_history (user_id, points, action_type, description) VALUES (p_user_id, p_points, p_action_type, p_description);
  INSERT INTO public.user_gamification (user_id, total_points, experience_points) VALUES (p_user_id, p_points, p_points)
  ON CONFLICT (user_id) DO UPDATE SET total_points = user_gamification.total_points + p_points, experience_points = user_gamification.experience_points + p_points, updated_at = now();
  SELECT experience_points INTO v_experience FROM public.user_gamification WHERE user_id = p_user_id;
  v_new_level := GREATEST(1, FLOOR(v_experience / 100) + 1);
  UPDATE public.user_gamification SET level = v_new_level WHERE user_id = p_user_id;
  PERFORM public.check_and_award_badges(p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_streak(p_user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_last_date DATE; v_current_streak INT;
BEGIN
  SELECT last_activity_date, streak_days INTO v_last_date, v_current_streak FROM public.user_gamification WHERE user_id = p_user_id;
  IF v_last_date IS NULL THEN
    UPDATE public.user_gamification SET streak_days = 1, last_activity_date = CURRENT_DATE WHERE user_id = p_user_id;
  ELSIF v_last_date = CURRENT_DATE THEN RETURN;
  ELSIF v_last_date = CURRENT_DATE - INTERVAL '1 day' THEN
    UPDATE public.user_gamification SET streak_days = streak_days + 1, last_activity_date = CURRENT_DATE WHERE user_id = p_user_id;
    IF v_current_streak + 1 >= 7 THEN PERFORM public.award_points(p_user_id, 50, 'streak_bonus', '7일 연속 학습 보너스'); END IF;
  ELSE
    UPDATE public.user_gamification SET streak_days = 1, last_activity_date = CURRENT_DATE WHERE user_id = p_user_id;
  END IF;
END;
$$;

-- 7. 트리거 함수들
CREATE OR REPLACE FUNCTION public.trigger_award_points_on_content()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.completed = true AND (OLD.completed IS NULL OR OLD.completed = false) THEN
    PERFORM public.award_points(NEW.user_id, 10, 'lesson_completed', '강의 완료');
    PERFORM public.update_streak(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_content_completed AFTER UPDATE ON public.content_progress FOR EACH ROW EXECUTE FUNCTION public.trigger_award_points_on_content();

CREATE OR REPLACE FUNCTION public.trigger_award_points_on_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'graded' AND (OLD.status IS NULL OR OLD.status != 'graded') THEN
    PERFORM public.award_points(NEW.student_id, GREATEST(5, FLOOR(COALESCE(NEW.score, 0) / 10))::integer, 'assignment_completed', '과제 완료');
    PERFORM public.update_streak(NEW.student_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_assignment_graded AFTER UPDATE ON public.assignment_submissions FOR EACH ROW EXECUTE FUNCTION public.trigger_award_points_on_assignment();

-- 8. 자동 프로필 생성 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  INSERT INTO public.user_gamification (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. 수강 진행률 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION public.update_enrollment_progress_on_content()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_course_id UUID; v_total INT; v_completed INT; v_progress DECIMAL;
BEGIN
  SELECT cc.course_id INTO v_course_id FROM public.course_contents cc WHERE cc.id = NEW.content_id;
  SELECT COUNT(*), COUNT(*) FILTER (WHERE cp.completed = true) INTO v_total, v_completed
  FROM public.course_contents cc LEFT JOIN public.content_progress cp ON cp.content_id = cc.id AND cp.user_id = NEW.user_id
  WHERE cc.course_id = v_course_id AND cc.is_published = true;
  IF v_total > 0 THEN
    v_progress := (v_completed::DECIMAL / v_total::DECIMAL) * 100;
    UPDATE public.enrollments SET progress = v_progress, completed_at = CASE WHEN v_progress >= 100 THEN now() ELSE NULL END
    WHERE user_id = NEW.user_id AND course_id = v_course_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_content_progress_update AFTER INSERT OR UPDATE ON public.content_progress FOR EACH ROW EXECUTE FUNCTION public.update_enrollment_progress_on_content();

-- 10. 기본 뱃지 데이터
INSERT INTO public.badges (name, description, icon, badge_type, requirement_type, requirement_value) VALUES
  ('첫 걸음', '첫 번째 강의를 완료했습니다', 'target', 'milestone', 'lessons_completed', 1),
  ('학습왕', '10개 강의를 완료했습니다', 'book-open', 'milestone', 'lessons_completed', 10),
  ('마스터', '50개 강의를 완료했습니다', 'trophy', 'milestone', 'lessons_completed', 50),
  ('꾸준함', '7일 연속 학습했습니다', 'flame', 'streak', 'streak', 7),
  ('습관 형성', '30일 연속 학습했습니다', 'gem', 'streak', 'streak', 30),
  ('포인트 수집가', '100 포인트를 달성했습니다', 'star', 'points', 'points', 100),
  ('포인트 부자', '1000 포인트를 달성했습니다', 'sparkles', 'points', 'points', 1000),
  ('과제 마스터', '10개 과제를 완료했습니다', 'pen-tool', 'milestone', 'assignments_completed', 10),
  ('코스 정복자', '3개 코스를 수료했습니다', 'graduation-cap', 'milestone', 'courses_completed', 3);
