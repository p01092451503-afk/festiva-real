
CREATE TABLE public.admin_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_chat_messages_user_created
  ON public.admin_chat_messages(user_id, created_at);

GRANT SELECT, INSERT, DELETE ON public.admin_chat_messages TO authenticated;
GRANT ALL ON public.admin_chat_messages TO service_role;

ALTER TABLE public.admin_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view their own chat"
  ON public.admin_chat_messages FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

CREATE POLICY "Admins can insert their own chat"
  ON public.admin_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

CREATE POLICY "Admins can delete their own chat"
  ON public.admin_chat_messages FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  );
