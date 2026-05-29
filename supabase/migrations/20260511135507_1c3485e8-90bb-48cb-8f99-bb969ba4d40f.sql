
-- Break RLS recursion between video_sessions and video_session_participants
CREATE OR REPLACE FUNCTION public.is_video_session_host(_session_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.video_sessions s WHERE s.id = _session_id AND s.host_user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_video_session_participant(_session_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.video_session_participants p WHERE p.session_id = _session_id AND p.user_id = _user_id);
$$;

DROP POLICY IF EXISTS "Participants view their sessions" ON public.video_sessions;
CREATE POLICY "Participants view their sessions" ON public.video_sessions
FOR SELECT USING (public.is_video_session_participant(id, auth.uid()));

DROP POLICY IF EXISTS "Hosts manage own session participants" ON public.video_session_participants;
CREATE POLICY "Hosts manage own session participants" ON public.video_session_participants
FOR ALL USING (public.is_video_session_host(session_id, auth.uid()))
WITH CHECK (public.is_video_session_host(session_id, auth.uid()));
