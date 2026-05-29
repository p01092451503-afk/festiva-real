
-- 1. video_sessions
CREATE TABLE public.video_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  session_type TEXT NOT NULL DEFAULT 'lecture' CHECK (session_type IN ('consultation','lecture','study')),
  host_user_id UUID NOT NULL,
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','completed','cancelled')),
  daily_room_name TEXT,
  daily_room_url TEXT,
  recording_enabled BOOLEAN NOT NULL DEFAULT false,
  max_participants INTEGER NOT NULL DEFAULT 50,
  course_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_video_sessions_host ON public.video_sessions(host_user_id);
CREATE INDEX idx_video_sessions_start ON public.video_sessions(scheduled_start DESC);

-- 2. participants
CREATE TABLE public.video_session_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.video_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('host','participant')),
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);

CREATE INDEX idx_vsp_user ON public.video_session_participants(user_id);
CREATE INDEX idx_vsp_session ON public.video_session_participants(session_id);

-- 3. RLS
ALTER TABLE public.video_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_session_participants ENABLE ROW LEVEL SECURITY;

-- video_sessions policies
CREATE POLICY "Admins manage all sessions" ON public.video_sessions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Hosts manage own sessions" ON public.video_sessions
  FOR ALL TO authenticated
  USING (host_user_id = auth.uid())
  WITH CHECK (host_user_id = auth.uid() AND (public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')));

CREATE POLICY "Participants view their sessions" ON public.video_sessions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.video_session_participants p WHERE p.session_id = video_sessions.id AND p.user_id = auth.uid()));

-- participants policies
CREATE POLICY "Admins manage all participants" ON public.video_session_participants
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Hosts manage own session participants" ON public.video_session_participants
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.video_sessions s WHERE s.id = video_session_participants.session_id AND s.host_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.video_sessions s WHERE s.id = video_session_participants.session_id AND s.host_user_id = auth.uid()));

CREATE POLICY "Users view own participation" ON public.video_session_participants
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users update own attendance" ON public.video_session_participants
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. updated_at trigger
CREATE TRIGGER trg_video_sessions_updated
  BEFORE UPDATE ON public.video_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
