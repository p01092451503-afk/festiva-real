
-- 1) Translation glossary
CREATE TABLE IF NOT EXISTS public.translation_glossary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ko_term TEXT NOT NULL,
  en_term TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'all',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ko_term, scope)
);

CREATE INDEX IF NOT EXISTS idx_translation_glossary_active ON public.translation_glossary (is_active, scope);

ALTER TABLE public.translation_glossary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view glossary" ON public.translation_glossary;
CREATE POLICY "Authenticated can view glossary"
  ON public.translation_glossary FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage glossary" ON public.translation_glossary;
CREATE POLICY "Admins can manage glossary"
  ON public.translation_glossary FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_translation_glossary_updated_at ON public.translation_glossary;
CREATE TRIGGER trg_translation_glossary_updated_at
  BEFORE UPDATE ON public.translation_glossary
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2) Export RPC
CREATE OR REPLACE FUNCTION public.export_i18n_rows(p_content_type TEXT)
RETURNS TABLE (
  item_id UUID, ko_title TEXT, ko_body TEXT,
  en_title TEXT, en_body TEXT, status TEXT, updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_content_type = 'course' THEN
    RETURN QUERY
      SELECT c.id, c.title, c.description, ci.title, ci.description,
             COALESCE(ci.translation_status,'draft'), COALESCE(ci.updated_at, c.updated_at)
      FROM courses c
      LEFT JOIN course_i18n ci ON ci.course_id = c.id AND ci.language_code = 'en'
      WHERE COALESCE(c.status,'') <> 'archived';
  ELSIF p_content_type = 'content' THEN
    RETURN QUERY
      SELECT cc.id, cc.title, cc.description, cci.title, cci.description,
             COALESCE(cci.translation_status,'draft'), COALESCE(cci.updated_at, cc.updated_at)
      FROM course_contents cc
      JOIN courses c ON c.id = cc.course_id AND COALESCE(c.status,'') <> 'archived'
      LEFT JOIN course_content_i18n cci ON cci.content_id = cc.id AND cci.language_code = 'en';
  ELSIF p_content_type = 'assessment' THEN
    RETURN QUERY
      SELECT a.id, a.title, a.description, ai.title, ai.description,
             COALESCE(ai.translation_status,'draft'), COALESCE(ai.updated_at, a.updated_at)
      FROM assessments a
      JOIN courses c ON c.id = a.course_id AND COALESCE(c.status,'') <> 'archived'
      LEFT JOIN assessment_i18n ai ON ai.assessment_id = a.id AND ai.language_code = 'en';
  ELSIF p_content_type = 'announcement' THEN
    RETURN QUERY
      SELECT a.id, a.title, a.content, ai.title, ai.content,
             COALESCE(ai.translation_status,'draft'), COALESCE(ai.updated_at, a.updated_at)
      FROM announcements a
      LEFT JOIN announcement_i18n ai ON ai.announcement_id = a.id AND ai.language_code = 'en';
  ELSIF p_content_type = 'board' THEN
    RETURN QUERY
      SELECT b.id, b.title, b.content, bi.title, bi.content,
             COALESCE(bi.translation_status,'draft'), COALESCE(bi.updated_at, b.updated_at)
      FROM board_posts b
      LEFT JOIN board_post_i18n bi ON bi.post_id = b.id AND bi.language_code = 'en';
  ELSE
    RAISE EXCEPTION 'invalid content_type: %', p_content_type;
  END IF;
END; $$;

-- 3) Import RPC
CREATE OR REPLACE FUNCTION public.import_i18n_rows(
  p_content_type TEXT, p_rows JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r JSONB;
  v_item UUID; v_title TEXT; v_body TEXT;
  v_ko_title TEXT; v_ko_body TEXT; v_hash TEXT;
  v_updated INT := 0; v_skipped INT := 0;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR r IN SELECT jsonb_array_elements(p_rows) LOOP
    v_item := (r->>'item_id')::UUID;
    v_title := COALESCE(r->>'en_title','');
    v_body  := COALESCE(r->>'en_body','');

    IF v_item IS NULL OR (v_title = '' AND v_body = '') THEN
      v_skipped := v_skipped + 1; CONTINUE;
    END IF;

    IF p_content_type = 'course' THEN
      SELECT title, description INTO v_ko_title, v_ko_body FROM courses WHERE id = v_item;
      v_hash := encode(digest(coalesce(v_ko_title,'')||'|'||coalesce(v_ko_body,''),'sha256'),'hex');
      INSERT INTO course_i18n (course_id, language_code, title, description, source_hash, translation_status, translated_at)
        VALUES (v_item,'en',v_title,NULLIF(v_body,''),v_hash,'reviewed',now())
        ON CONFLICT (course_id, language_code) DO UPDATE
          SET title=EXCLUDED.title, description=EXCLUDED.description,
              source_hash=EXCLUDED.source_hash, translation_status='reviewed',
              translated_at=now(), updated_at=now();
    ELSIF p_content_type = 'content' THEN
      SELECT title, description INTO v_ko_title, v_ko_body FROM course_contents WHERE id = v_item;
      v_hash := encode(digest(coalesce(v_ko_title,'')||'|'||coalesce(v_ko_body,''),'sha256'),'hex');
      INSERT INTO course_content_i18n (content_id, language_code, title, description, source_hash, translation_status, translated_at)
        VALUES (v_item,'en',v_title,NULLIF(v_body,''),v_hash,'reviewed',now())
        ON CONFLICT (content_id, language_code) DO UPDATE
          SET title=EXCLUDED.title, description=EXCLUDED.description,
              source_hash=EXCLUDED.source_hash, translation_status='reviewed',
              translated_at=now(), updated_at=now();
    ELSIF p_content_type = 'assessment' THEN
      SELECT title, description INTO v_ko_title, v_ko_body FROM assessments WHERE id = v_item;
      v_hash := encode(digest(coalesce(v_ko_title,'')||'|'||coalesce(v_ko_body,''),'sha256'),'hex');
      INSERT INTO assessment_i18n (assessment_id, language_code, title, description, source_hash, translation_status, translated_at)
        VALUES (v_item,'en',v_title,NULLIF(v_body,''),v_hash,'reviewed',now())
        ON CONFLICT (assessment_id, language_code) DO UPDATE
          SET title=EXCLUDED.title, description=EXCLUDED.description,
              source_hash=EXCLUDED.source_hash, translation_status='reviewed',
              translated_at=now(), updated_at=now();
    ELSIF p_content_type = 'announcement' THEN
      SELECT title, content INTO v_ko_title, v_ko_body FROM announcements WHERE id = v_item;
      v_hash := encode(digest(coalesce(v_ko_title,'')||'|'||coalesce(v_ko_body,''),'sha256'),'hex');
      INSERT INTO announcement_i18n (announcement_id, language_code, title, content, source_hash, translation_status, translated_at)
        VALUES (v_item,'en',v_title,COALESCE(NULLIF(v_body,''),v_ko_body),v_hash,'reviewed',now())
        ON CONFLICT (announcement_id, language_code) DO UPDATE
          SET title=EXCLUDED.title, content=EXCLUDED.content,
              source_hash=EXCLUDED.source_hash, translation_status='reviewed',
              translated_at=now(), updated_at=now();
    ELSIF p_content_type = 'board' THEN
      SELECT title, content INTO v_ko_title, v_ko_body FROM board_posts WHERE id = v_item;
      v_hash := encode(digest(coalesce(v_ko_title,'')||'|'||coalesce(v_ko_body,''),'sha256'),'hex');
      INSERT INTO board_post_i18n (post_id, language_code, title, content, source_hash, translation_status, translated_at)
        VALUES (v_item,'en',v_title,COALESCE(NULLIF(v_body,''),v_ko_body),v_hash,'reviewed',now())
        ON CONFLICT (post_id, language_code) DO UPDATE
          SET title=EXCLUDED.title, content=EXCLUDED.content,
              source_hash=EXCLUDED.source_hash, translation_status='reviewed',
              translated_at=now(), updated_at=now();
    ELSE
      RAISE EXCEPTION 'invalid content_type: %', p_content_type;
    END IF;

    v_updated := v_updated + 1;
  END LOOP;

  RETURN jsonb_build_object('updated', v_updated, 'skipped', v_skipped);
END; $$;

-- 4) Seed glossary
INSERT INTO public.translation_glossary (ko_term, en_term, scope, notes) VALUES
  ('차시','Lesson','all','강의 하위 단위'),
  ('강의','Course','all','교육 상위 단위'),
  ('수강생','Learner','all',NULL),
  ('수료증','Certificate','all',NULL),
  ('평가','Assessment','all',NULL),
  ('학습 트랙','Learning Track','all',NULL),
  ('지점','Branch','all',NULL),
  ('본사','HQ','all',NULL)
ON CONFLICT (ko_term, scope) DO NOTHING;
