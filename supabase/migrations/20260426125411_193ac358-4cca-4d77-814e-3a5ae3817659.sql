-- 1) Review history table
CREATE TABLE IF NOT EXISTS public.i18n_review_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL CHECK (content_type IN ('course','content','assessment','announcement','board')),
  item_id uuid NOT NULL,
  language_code text NOT NULL DEFAULT 'en',
  from_status text,
  to_status text NOT NULL,
  reviewer_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_i18n_review_history_item ON public.i18n_review_history(content_type, item_id);
CREATE INDEX IF NOT EXISTS idx_i18n_review_history_created ON public.i18n_review_history(created_at DESC);

ALTER TABLE public.i18n_review_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage review history"
  ON public.i18n_review_history
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Authenticated can view review history"
  ON public.i18n_review_history
  FOR SELECT
  TO authenticated
  USING (true);

-- 2) RPC: update i18n status (single or bulk) and write history
CREATE OR REPLACE FUNCTION public.set_i18n_status(
  p_content_type text,
  p_item_ids uuid[],
  p_to_status text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table text;
  v_fk text;
  v_updated int := 0;
  v_id uuid;
  v_from_status text;
  v_uid uuid := auth.uid();
BEGIN
  IF NOT (has_role(v_uid, 'admin'::app_role) OR has_role(v_uid, 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_to_status NOT IN ('draft','ai_generated','reviewed','published','sync_required') THEN
    RAISE EXCEPTION 'invalid status %', p_to_status;
  END IF;

  CASE p_content_type
    WHEN 'course' THEN v_table := 'course_i18n'; v_fk := 'course_id';
    WHEN 'content' THEN v_table := 'course_content_i18n'; v_fk := 'content_id';
    WHEN 'assessment' THEN v_table := 'assessment_i18n'; v_fk := 'assessment_id';
    WHEN 'announcement' THEN v_table := 'announcement_i18n'; v_fk := 'announcement_id';
    WHEN 'board' THEN v_table := 'board_post_i18n'; v_fk := 'post_id';
    ELSE RAISE EXCEPTION 'invalid content_type %', p_content_type;
  END CASE;

  FOREACH v_id IN ARRAY p_item_ids LOOP
    EXECUTE format(
      'SELECT translation_status FROM public.%I WHERE %I = $1 AND language_code = ''en'' LIMIT 1',
      v_table, v_fk
    ) INTO v_from_status USING v_id;

    EXECUTE format(
      'UPDATE public.%I SET translation_status = $1, updated_at = now() WHERE %I = $2 AND language_code = ''en''',
      v_table, v_fk
    ) USING p_to_status, v_id;

    IF FOUND THEN
      v_updated := v_updated + 1;
      INSERT INTO public.i18n_review_history(content_type, item_id, language_code, from_status, to_status, reviewer_id, note)
      VALUES (p_content_type, v_id, 'en', v_from_status, p_to_status, v_uid, p_note);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('updated', v_updated);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_i18n_status(text, uuid[], text, text) TO authenticated;

-- 3) RPC: fetch bilingual preview (KO source vs EN translation) for a single item
CREATE OR REPLACE FUNCTION public.get_i18n_preview(
  p_content_type text,
  p_item_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ko_title text;
  v_ko_body text;
  v_en_title text;
  v_en_body text;
  v_status text;
  v_updated timestamptz;
BEGIN
  IF NOT (has_role(v_uid, 'admin'::app_role) OR has_role(v_uid, 'super_admin'::app_role) OR has_role(v_uid, 'teacher'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  CASE p_content_type
    WHEN 'course' THEN
      SELECT title, description INTO v_ko_title, v_ko_body FROM public.courses WHERE id = p_item_id;
      SELECT title, description, translation_status, updated_at INTO v_en_title, v_en_body, v_status, v_updated
        FROM public.course_i18n WHERE course_id = p_item_id AND language_code = 'en' LIMIT 1;
    WHEN 'content' THEN
      SELECT title, description INTO v_ko_title, v_ko_body FROM public.course_contents WHERE id = p_item_id;
      SELECT title, description, translation_status, updated_at INTO v_en_title, v_en_body, v_status, v_updated
        FROM public.course_content_i18n WHERE content_id = p_item_id AND language_code = 'en' LIMIT 1;
    WHEN 'assessment' THEN
      SELECT title, description INTO v_ko_title, v_ko_body FROM public.assessments WHERE id = p_item_id;
      SELECT title, description, translation_status, updated_at INTO v_en_title, v_en_body, v_status, v_updated
        FROM public.assessment_i18n WHERE assessment_id = p_item_id AND language_code = 'en' LIMIT 1;
    WHEN 'announcement' THEN
      SELECT title, content INTO v_ko_title, v_ko_body FROM public.announcements WHERE id = p_item_id;
      SELECT title, content, translation_status, updated_at INTO v_en_title, v_en_body, v_status, v_updated
        FROM public.announcement_i18n WHERE announcement_id = p_item_id AND language_code = 'en' LIMIT 1;
    WHEN 'board' THEN
      SELECT title, content INTO v_ko_title, v_ko_body FROM public.board_posts WHERE id = p_item_id;
      SELECT title, content, translation_status, updated_at INTO v_en_title, v_en_body, v_status, v_updated
        FROM public.board_post_i18n WHERE post_id = p_item_id AND language_code = 'en' LIMIT 1;
    ELSE RAISE EXCEPTION 'invalid content_type %', p_content_type;
  END CASE;

  RETURN jsonb_build_object(
    'ko_title', v_ko_title,
    'ko_body', v_ko_body,
    'en_title', v_en_title,
    'en_body', v_en_body,
    'status', COALESCE(v_status, 'draft'),
    'updated_at', v_updated
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_i18n_preview(text, uuid) TO authenticated;

-- 4) RPC: save edited EN translation (manual review save)
CREATE OR REPLACE FUNCTION public.save_i18n_translation(
  p_content_type text,
  p_item_id uuid,
  p_en_title text,
  p_en_body text,
  p_mark_reviewed boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_table text;
  v_fk text;
  v_body_col text;
  v_ko_title text;
  v_ko_body text;
  v_hash text;
  v_status text;
  v_from_status text;
BEGIN
  IF NOT (has_role(v_uid, 'admin'::app_role) OR has_role(v_uid, 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  CASE p_content_type
    WHEN 'course' THEN v_table := 'course_i18n'; v_fk := 'course_id'; v_body_col := 'description';
      SELECT title, description INTO v_ko_title, v_ko_body FROM public.courses WHERE id = p_item_id;
    WHEN 'content' THEN v_table := 'course_content_i18n'; v_fk := 'content_id'; v_body_col := 'description';
      SELECT title, description INTO v_ko_title, v_ko_body FROM public.course_contents WHERE id = p_item_id;
    WHEN 'assessment' THEN v_table := 'assessment_i18n'; v_fk := 'assessment_id'; v_body_col := 'description';
      SELECT title, description INTO v_ko_title, v_ko_body FROM public.assessments WHERE id = p_item_id;
    WHEN 'announcement' THEN v_table := 'announcement_i18n'; v_fk := 'announcement_id'; v_body_col := 'content';
      SELECT title, content INTO v_ko_title, v_ko_body FROM public.announcements WHERE id = p_item_id;
    WHEN 'board' THEN v_table := 'board_post_i18n'; v_fk := 'post_id'; v_body_col := 'content';
      SELECT title, content INTO v_ko_title, v_ko_body FROM public.board_posts WHERE id = p_item_id;
    ELSE RAISE EXCEPTION 'invalid content_type %', p_content_type;
  END CASE;

  v_hash := encode(digest(coalesce(v_ko_title,'') || '|' || coalesce(v_ko_body,''), 'sha256'), 'hex');
  v_status := CASE WHEN p_mark_reviewed THEN 'reviewed' ELSE 'draft' END;

  EXECUTE format(
    'SELECT translation_status FROM public.%I WHERE %I = $1 AND language_code = ''en'' LIMIT 1',
    v_table, v_fk
  ) INTO v_from_status USING p_item_id;

  EXECUTE format(
    'INSERT INTO public.%I (%I, language_code, title, %I, source_hash, translation_status, translated_at, updated_at)
     VALUES ($1, ''en'', $2, $3, $4, $5, now(), now())
     ON CONFLICT (%I, language_code) DO UPDATE
     SET title = EXCLUDED.title, %I = EXCLUDED.%I, source_hash = EXCLUDED.source_hash,
         translation_status = EXCLUDED.translation_status, translated_at = now(), updated_at = now()',
    v_table, v_fk, v_body_col, v_fk, v_body_col, v_body_col
  ) USING p_item_id, p_en_title, p_en_body, v_hash, v_status;

  INSERT INTO public.i18n_review_history(content_type, item_id, language_code, from_status, to_status, reviewer_id, note)
  VALUES (p_content_type, p_item_id, 'en', v_from_status, v_status, v_uid, 'manual edit');

  RETURN jsonb_build_object('ok', true, 'status', v_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_i18n_translation(text, uuid, text, text, boolean) TO authenticated;