CREATE TABLE public.video_session_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.video_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vsm_session_created ON public.video_session_messages(session_id, created_at);

ALTER TABLE public.video_session_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all session messages"
ON public.video_session_messages
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Hosts read own session messages"
ON public.video_session_messages
FOR SELECT
TO authenticated
USING (is_video_session_host(session_id, auth.uid()));

CREATE POLICY "Hosts insert own session messages"
ON public.video_session_messages
FOR INSERT
TO authenticated
WITH CHECK (is_video_session_host(session_id, auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Participants read session messages"
ON public.video_session_messages
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.video_session_participants p
  WHERE p.session_id = video_session_messages.session_id AND p.user_id = auth.uid()
));

CREATE POLICY "Participants insert session messages"
ON public.video_session_messages
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.video_session_participants p
    WHERE p.session_id = video_session_messages.session_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users delete own session messages"
ON public.video_session_messages
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.video_session_messages;
ALTER TABLE public.video_session_messages REPLICA IDENTITY FULL;