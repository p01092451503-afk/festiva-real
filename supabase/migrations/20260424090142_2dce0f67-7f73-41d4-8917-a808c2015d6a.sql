CREATE TABLE IF NOT EXISTS public.announcement_i18n (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  language_code text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, language_code)
);

CREATE TABLE IF NOT EXISTS public.board_post_i18n (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.board_posts(id) ON DELETE CASCADE,
  language_code text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, language_code)
);

ALTER TABLE public.announcement_i18n ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_post_i18n ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view announcement i18n"
  ON public.announcement_i18n FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins/teachers can manage announcement i18n"
  ON public.announcement_i18n FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Authenticated can view board post i18n"
  ON public.board_post_i18n FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins/teachers can manage board post i18n"
  ON public.board_post_i18n FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role));

CREATE TRIGGER trg_announcement_i18n_touch
  BEFORE UPDATE ON public.announcement_i18n
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_board_post_i18n_touch
  BEFORE UPDATE ON public.board_post_i18n
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_announcement_i18n_announcement ON public.announcement_i18n(announcement_id);
CREATE INDEX IF NOT EXISTS idx_board_post_i18n_post ON public.board_post_i18n(post_id);