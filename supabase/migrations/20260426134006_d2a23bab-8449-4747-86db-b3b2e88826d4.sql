-- =========================================================
-- 1) Trigger: when KO source changes, mark EN i18n rows as
--    'sync_required' so the auto-translate worker picks them up.
--    (Existing detect_i18n_drift() did this manually; these triggers
--     run automatically on every insert/update of KO content.)
-- =========================================================

CREATE OR REPLACE FUNCTION public.mark_i18n_sync_required()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_table TEXT;
  v_fk    TEXT;
  v_body_col TEXT;
  v_ko_title TEXT;
  v_ko_body  TEXT;
  v_hash TEXT;
BEGIN
  -- pick i18n table + body column based on the source table firing the trigger
  IF TG_TABLE_NAME = 'courses' THEN
    v_table := 'course_i18n'; v_fk := 'course_id'; v_body_col := 'description';
    v_ko_title := NEW.title; v_ko_body := NEW.description;
  ELSIF TG_TABLE_NAME = 'course_contents' THEN
    v_table := 'course_content_i18n'; v_fk := 'content_id'; v_body_col := 'description';
    v_ko_title := NEW.title; v_ko_body := NEW.description;
  ELSIF TG_TABLE_NAME = 'assessments' THEN
    v_table := 'assessment_i18n'; v_fk := 'assessment_id'; v_body_col := 'description';
    v_ko_title := NEW.title; v_ko_body := NEW.description;
  ELSIF TG_TABLE_NAME = 'announcements' THEN
    v_table := 'announcement_i18n'; v_fk := 'announcement_id'; v_body_col := 'content';
    v_ko_title := NEW.title; v_ko_body := NEW.content;
  ELSIF TG_TABLE_NAME = 'board_posts' THEN
    v_table := 'board_post_i18n'; v_fk := 'post_id'; v_body_col := 'content';
    v_ko_title := NEW.title; v_ko_body := NEW.content;
  ELSE
    RETURN NEW;
  END IF;

  v_hash := encode(extensions.digest(coalesce(v_ko_title,'')||'|'||coalesce(v_ko_body,''),'sha256'),'hex');

  -- Only mark if EN row exists AND its source_hash differs AND status is not human-curated.
  EXECUTE format(
    'UPDATE public.%I
        SET translation_status = ''sync_required'', updated_at = now()
      WHERE %I = $1
        AND language_code = ''en''
        AND COALESCE(source_hash,'''') <> $2
        AND translation_status NOT IN (''reviewed'', ''published'', ''human_reviewed'')',
    v_table, v_fk
  ) USING NEW.id, v_hash;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_i18n_courses ON public.courses;
CREATE TRIGGER trg_mark_i18n_courses
  AFTER INSERT OR UPDATE OF title, description ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.mark_i18n_sync_required();

DROP TRIGGER IF EXISTS trg_mark_i18n_contents ON public.course_contents;
CREATE TRIGGER trg_mark_i18n_contents
  AFTER INSERT OR UPDATE OF title, description ON public.course_contents
  FOR EACH ROW EXECUTE FUNCTION public.mark_i18n_sync_required();

DROP TRIGGER IF EXISTS trg_mark_i18n_assessments ON public.assessments;
CREATE TRIGGER trg_mark_i18n_assessments
  AFTER INSERT OR UPDATE OF title, description ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.mark_i18n_sync_required();

DROP TRIGGER IF EXISTS trg_mark_i18n_announcements ON public.announcements;
CREATE TRIGGER trg_mark_i18n_announcements
  AFTER INSERT OR UPDATE OF title, content ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.mark_i18n_sync_required();

DROP TRIGGER IF EXISTS trg_mark_i18n_boards ON public.board_posts;
CREATE TRIGGER trg_mark_i18n_boards
  AFTER INSERT OR UPDATE OF title, content ON public.board_posts
  FOR EACH ROW EXECUTE FUNCTION public.mark_i18n_sync_required();


-- =========================================================
-- 2) Helper RPC: list IDs that need auto-translation
--    (EN missing OR sync_required, AND status not human-curated)
--    Used by the bulk backfill worker and the admin "Run all" button.
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_i18n_pending_ids(p_content_type TEXT, p_limit INT DEFAULT 200)
RETURNS TABLE(item_id UUID)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_content_type = 'course' THEN
    RETURN QUERY
      SELECT c.id FROM public.courses c
      WHERE NOT EXISTS (
        SELECT 1 FROM public.course_i18n i
        WHERE i.course_id = c.id AND i.language_code = 'en'
          AND COALESCE(i.title,'') <> ''
          AND i.translation_status NOT IN ('sync_required')
      )
      LIMIT p_limit;
  ELSIF p_content_type = 'content' THEN
    RETURN QUERY
      SELECT cc.id FROM public.course_contents cc
      WHERE NOT EXISTS (
        SELECT 1 FROM public.course_content_i18n i
        WHERE i.content_id = cc.id AND i.language_code = 'en'
          AND COALESCE(i.title,'') <> ''
          AND i.translation_status NOT IN ('sync_required')
      )
      LIMIT p_limit;
  ELSIF p_content_type = 'assessment' THEN
    RETURN QUERY
      SELECT a.id FROM public.assessments a
      WHERE NOT EXISTS (
        SELECT 1 FROM public.assessment_i18n i
        WHERE i.assessment_id = a.id AND i.language_code = 'en'
          AND COALESCE(i.title,'') <> ''
          AND i.translation_status NOT IN ('sync_required')
      )
      LIMIT p_limit;
  ELSIF p_content_type = 'question' THEN
    RETURN QUERY
      SELECT q.id FROM public.assessment_questions q
      WHERE NOT EXISTS (
        SELECT 1 FROM public.assessment_question_i18n i
        WHERE i.question_id = q.id AND i.language_code = 'en'
          AND COALESCE(i.question_text,'') <> ''
          AND i.translation_status NOT IN ('sync_required')
      )
      LIMIT p_limit;
  ELSIF p_content_type = 'announcement' THEN
    RETURN QUERY
      SELECT a.id FROM public.announcements a
      WHERE NOT EXISTS (
        SELECT 1 FROM public.announcement_i18n i
        WHERE i.announcement_id = a.id AND i.language_code = 'en'
          AND COALESCE(i.title,'') <> ''
          AND i.translation_status NOT IN ('sync_required')
      )
      LIMIT p_limit;
  ELSIF p_content_type = 'board' THEN
    RETURN QUERY
      SELECT b.id FROM public.board_posts b
      WHERE NOT EXISTS (
        SELECT 1 FROM public.board_post_i18n i
        WHERE i.post_id = b.id AND i.language_code = 'en'
          AND COALESCE(i.title,'') <> ''
          AND i.translation_status NOT IN ('sync_required')
      )
      LIMIT p_limit;
  END IF;
END;
$$;