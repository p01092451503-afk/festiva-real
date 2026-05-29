
CREATE OR REPLACE FUNCTION public.set_updated_at_now()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.content_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID NOT NULL,
  course_id UUID,
  user_id UUID NOT NULL,
  parent_id UUID REFERENCES public.content_comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(btrim(body)) > 0 AND length(body) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_comments_content ON public.content_comments(content_id, created_at);
CREATE INDEX idx_content_comments_parent ON public.content_comments(parent_id);
CREATE INDEX idx_content_comments_user ON public.content_comments(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_comments TO authenticated;
GRANT SELECT ON public.content_comments TO anon;
GRANT ALL ON public.content_comments TO service_role;

ALTER TABLE public.content_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read content comments"
  ON public.content_comments FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create comments"
  ON public.content_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
  ON public.content_comments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments or admins"
  ON public.content_comments FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE TRIGGER trg_content_comments_updated_at
  BEFORE UPDATE ON public.content_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
