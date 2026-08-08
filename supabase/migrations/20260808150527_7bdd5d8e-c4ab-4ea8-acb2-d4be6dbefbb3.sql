
-- ===== 노코드 운영 =====
CREATE TABLE public.site_popups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text,
  image_url text,
  link_url text,
  position text NOT NULL DEFAULT 'center',
  width integer NOT NULL DEFAULT 420,
  height integer NOT NULL DEFAULT 480,
  start_at timestamptz,
  end_at timestamptz,
  is_active boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_popups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_popups TO authenticated;
GRANT ALL ON public.site_popups TO service_role;
ALTER TABLE public.site_popups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_popups public read" ON public.site_popups FOR SELECT USING (true);
CREATE POLICY "site_popups admin manage" ON public.site_popups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.static_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  content text,
  meta_description text,
  is_published boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.static_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.static_pages TO authenticated;
GRANT ALL ON public.static_pages TO service_role;
ALTER TABLE public.static_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "static_pages public read" ON public.static_pages FOR SELECT USING (is_published = true);
CREATE POLICY "static_pages admin manage" ON public.static_pages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.main_page_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_type text NOT NULL,
  title text,
  subtitle text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.main_page_blocks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.main_page_blocks TO authenticated;
GRANT ALL ON public.main_page_blocks TO service_role;
ALTER TABLE public.main_page_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "main_blocks public read" ON public.main_page_blocks FOR SELECT USING (true);
CREATE POLICY "main_blocks admin manage" ON public.main_page_blocks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.quick_menu_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  href text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, href)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quick_menu_favorites TO authenticated;
GRANT ALL ON public.quick_menu_favorites TO service_role;
ALTER TABLE public.quick_menu_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quick menu own" ON public.quick_menu_favorites FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.dashboard_widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  widget_key text NOT NULL,
  is_visible boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, widget_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_widgets TO authenticated;
GRANT ALL ON public.dashboard_widgets TO service_role;
ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dashboard widgets own" ON public.dashboard_widgets FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ===== 자격검정 =====
CREATE TABLE public.qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  grade text,
  description text,
  issuing_body text,
  fee integer NOT NULL DEFAULT 0,
  validity_months integer,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.qualifications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qualifications TO authenticated;
GRANT ALL ON public.qualifications TO service_role;
ALTER TABLE public.qualifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qualifications read" ON public.qualifications FOR SELECT USING (true);
CREATE POLICY "qualifications admin manage" ON public.qualifications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.exam_venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  region text,
  capacity integer NOT NULL DEFAULT 0,
  contact text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.exam_venues TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_venues TO authenticated;
GRANT ALL ON public.exam_venues TO service_role;
ALTER TABLE public.exam_venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exam_venues read" ON public.exam_venues FOR SELECT USING (true);
CREATE POLICY "exam_venues admin manage" ON public.exam_venues FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.exam_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_id uuid NOT NULL REFERENCES public.qualifications(id) ON DELETE CASCADE,
  venue_id uuid REFERENCES public.exam_venues(id) ON DELETE SET NULL,
  round_no integer NOT NULL DEFAULT 1,
  title text NOT NULL,
  apply_start_at timestamptz,
  apply_end_at timestamptz,
  exam_at timestamptz,
  result_at timestamptz,
  capacity integer NOT NULL DEFAULT 0,
  pass_score integer NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.exam_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_sessions TO authenticated;
GRANT ALL ON public.exam_sessions TO service_role;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exam_sessions read" ON public.exam_sessions FOR SELECT USING (true);
CREATE POLICY "exam_sessions admin manage" ON public.exam_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.exam_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  applicant_name text,
  status text NOT NULL DEFAULT 'applied',
  paid boolean NOT NULL DEFAULT false,
  score integer,
  is_passed boolean,
  seat_no text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_applications TO authenticated;
GRANT ALL ON public.exam_applications TO service_role;
ALTER TABLE public.exam_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exam_applications own read" ON public.exam_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "exam_applications own insert" ON public.exam_applications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "exam_applications admin update" ON public.exam_applications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "exam_applications admin delete" ON public.exam_applications FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.qualification_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES public.exam_applications(id) ON DELETE SET NULL,
  qualification_id uuid NOT NULL REFERENCES public.qualifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cert_number text NOT NULL UNIQUE,
  recipient_name text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  is_revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qualification_certificates TO authenticated;
GRANT ALL ON public.qualification_certificates TO service_role;
ALTER TABLE public.qualification_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qual_certs own read" ON public.qualification_certificates FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "qual_certs admin manage" ON public.qualification_certificates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.qualification_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_id uuid NOT NULL REFERENCES public.qualifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  rating integer NOT NULL DEFAULT 5,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.qualification_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qualification_reviews TO authenticated;
GRANT ALL ON public.qualification_reviews TO service_role;
ALTER TABLE public.qualification_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qual_reviews public read" ON public.qualification_reviews FOR SELECT
  USING (is_published = true);
CREATE POLICY "qual_reviews own read" ON public.qualification_reviews FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "qual_reviews own write" ON public.qualification_reviews FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "qual_reviews admin manage" ON public.qualification_reviews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER trg_site_popups_updated BEFORE UPDATE ON public.site_popups FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_static_pages_updated BEFORE UPDATE ON public.static_pages FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_main_blocks_updated BEFORE UPDATE ON public.main_page_blocks FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_qualifications_updated BEFORE UPDATE ON public.qualifications FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_exam_venues_updated BEFORE UPDATE ON public.exam_venues FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_exam_sessions_updated BEFORE UPDATE ON public.exam_sessions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_exam_applications_updated BEFORE UPDATE ON public.exam_applications FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
