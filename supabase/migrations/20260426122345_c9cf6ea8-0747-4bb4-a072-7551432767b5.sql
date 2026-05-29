-- ============================================================
-- Phase 1: 다국어 운영 효율화 - 번역 상태 추적
-- ============================================================

-- 1. i18n 테이블에 공통 컬럼 추가
ALTER TABLE public.course_i18n
  ADD COLUMN IF NOT EXISTS source_hash TEXT,
  ADD COLUMN IF NOT EXISTS translation_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS translated_at TIMESTAMPTZ;

ALTER TABLE public.course_content_i18n
  ADD COLUMN IF NOT EXISTS source_hash TEXT,
  ADD COLUMN IF NOT EXISTS translation_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS translated_at TIMESTAMPTZ;

ALTER TABLE public.assessment_i18n
  ADD COLUMN IF NOT EXISTS source_hash TEXT,
  ADD COLUMN IF NOT EXISTS translation_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS translated_at TIMESTAMPTZ;

ALTER TABLE public.assessment_question_i18n
  ADD COLUMN IF NOT EXISTS source_hash TEXT,
  ADD COLUMN IF NOT EXISTS translation_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS translated_at TIMESTAMPTZ;

ALTER TABLE public.announcement_i18n
  ADD COLUMN IF NOT EXISTS source_hash TEXT,
  ADD COLUMN IF NOT EXISTS translation_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS translated_at TIMESTAMPTZ;

ALTER TABLE public.board_post_i18n
  ADD COLUMN IF NOT EXISTS source_hash TEXT,
  ADD COLUMN IF NOT EXISTS translation_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS translated_at TIMESTAMPTZ;

-- translation_status 유효값 체크
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_i18n_status_check') THEN
    ALTER TABLE public.course_i18n
      ADD CONSTRAINT course_i18n_status_check
      CHECK (translation_status IN ('draft','ai_generated','reviewed','published','sync_required'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_content_i18n_status_check') THEN
    ALTER TABLE public.course_content_i18n
      ADD CONSTRAINT course_content_i18n_status_check
      CHECK (translation_status IN ('draft','ai_generated','reviewed','published','sync_required'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assessment_i18n_status_check') THEN
    ALTER TABLE public.assessment_i18n
      ADD CONSTRAINT assessment_i18n_status_check
      CHECK (translation_status IN ('draft','ai_generated','reviewed','published','sync_required'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assessment_question_i18n_status_check') THEN
    ALTER TABLE public.assessment_question_i18n
      ADD CONSTRAINT assessment_question_i18n_status_check
      CHECK (translation_status IN ('draft','ai_generated','reviewed','published','sync_required'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'announcement_i18n_status_check') THEN
    ALTER TABLE public.announcement_i18n
      ADD CONSTRAINT announcement_i18n_status_check
      CHECK (translation_status IN ('draft','ai_generated','reviewed','published','sync_required'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'board_post_i18n_status_check') THEN
    ALTER TABLE public.board_post_i18n
      ADD CONSTRAINT board_post_i18n_status_check
      CHECK (translation_status IN ('draft','ai_generated','reviewed','published','sync_required'));
  END IF;
END $$;

-- 인덱스 (대시보드 성능)
CREATE INDEX IF NOT EXISTS idx_course_i18n_status ON public.course_i18n(translation_status, language_code);
CREATE INDEX IF NOT EXISTS idx_course_content_i18n_status ON public.course_content_i18n(translation_status, language_code);
CREATE INDEX IF NOT EXISTS idx_assessment_i18n_status ON public.assessment_i18n(translation_status, language_code);
CREATE INDEX IF NOT EXISTS idx_announcement_i18n_status ON public.announcement_i18n(translation_status, language_code);
CREATE INDEX IF NOT EXISTS idx_board_post_i18n_status ON public.board_post_i18n(translation_status, language_code);

-- 2. 통계 집계 함수
CREATE OR REPLACE FUNCTION public.get_i18n_dashboard_stats()
RETURNS TABLE(
  content_type TEXT,
  total BIGINT,
  ko_only BIGINT,
  en_missing BIGINT,
  sync_required BIGINT,
  reviewed BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin/Super Admin only
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  -- 강의
  SELECT
    'course'::TEXT,
    (SELECT COUNT(*) FROM public.courses)::BIGINT AS total,
    (SELECT COUNT(*) FROM public.courses c
       WHERE NOT EXISTS (SELECT 1 FROM public.course_i18n i WHERE i.course_id = c.id AND i.language_code = 'en'))::BIGINT AS ko_only,
    (SELECT COUNT(*) FROM public.courses c
       WHERE NOT EXISTS (SELECT 1 FROM public.course_i18n i WHERE i.course_id = c.id AND i.language_code = 'en' AND COALESCE(i.title,'') <> ''))::BIGINT AS en_missing,
    (SELECT COUNT(*) FROM public.course_i18n WHERE language_code = 'en' AND translation_status = 'sync_required')::BIGINT AS sync_required,
    (SELECT COUNT(*) FROM public.course_i18n WHERE language_code = 'en' AND translation_status IN ('reviewed','published'))::BIGINT AS reviewed
  UNION ALL
  -- 차시
  SELECT
    'content'::TEXT,
    (SELECT COUNT(*) FROM public.course_contents)::BIGINT,
    (SELECT COUNT(*) FROM public.course_contents c
       WHERE NOT EXISTS (SELECT 1 FROM public.course_content_i18n i WHERE i.content_id = c.id AND i.language_code = 'en'))::BIGINT,
    (SELECT COUNT(*) FROM public.course_contents c
       WHERE NOT EXISTS (SELECT 1 FROM public.course_content_i18n i WHERE i.content_id = c.id AND i.language_code = 'en' AND COALESCE(i.title,'') <> ''))::BIGINT,
    (SELECT COUNT(*) FROM public.course_content_i18n WHERE language_code = 'en' AND translation_status = 'sync_required')::BIGINT,
    (SELECT COUNT(*) FROM public.course_content_i18n WHERE language_code = 'en' AND translation_status IN ('reviewed','published'))::BIGINT
  UNION ALL
  -- 평가
  SELECT
    'assessment'::TEXT,
    (SELECT COUNT(*) FROM public.assessments)::BIGINT,
    (SELECT COUNT(*) FROM public.assessments a
       WHERE NOT EXISTS (SELECT 1 FROM public.assessment_i18n i WHERE i.assessment_id = a.id AND i.language_code = 'en'))::BIGINT,
    (SELECT COUNT(*) FROM public.assessments a
       WHERE NOT EXISTS (SELECT 1 FROM public.assessment_i18n i WHERE i.assessment_id = a.id AND i.language_code = 'en' AND COALESCE(i.title,'') <> ''))::BIGINT,
    (SELECT COUNT(*) FROM public.assessment_i18n WHERE language_code = 'en' AND translation_status = 'sync_required')::BIGINT,
    (SELECT COUNT(*) FROM public.assessment_i18n WHERE language_code = 'en' AND translation_status IN ('reviewed','published'))::BIGINT
  UNION ALL
  -- 공지
  SELECT
    'announcement'::TEXT,
    (SELECT COUNT(*) FROM public.announcements)::BIGINT,
    (SELECT COUNT(*) FROM public.announcements a
       WHERE NOT EXISTS (SELECT 1 FROM public.announcement_i18n i WHERE i.announcement_id = a.id AND i.language_code = 'en'))::BIGINT,
    (SELECT COUNT(*) FROM public.announcements a
       WHERE NOT EXISTS (SELECT 1 FROM public.announcement_i18n i WHERE i.announcement_id = a.id AND i.language_code = 'en' AND COALESCE(i.title,'') <> ''))::BIGINT,
    (SELECT COUNT(*) FROM public.announcement_i18n WHERE language_code = 'en' AND translation_status = 'sync_required')::BIGINT,
    (SELECT COUNT(*) FROM public.announcement_i18n WHERE language_code = 'en' AND translation_status IN ('reviewed','published'))::BIGINT
  UNION ALL
  -- 게시판
  SELECT
    'board'::TEXT,
    (SELECT COUNT(*) FROM public.board_posts)::BIGINT,
    (SELECT COUNT(*) FROM public.board_posts b
       WHERE NOT EXISTS (SELECT 1 FROM public.board_post_i18n i WHERE i.post_id = b.id AND i.language_code = 'en'))::BIGINT,
    (SELECT COUNT(*) FROM public.board_posts b
       WHERE NOT EXISTS (SELECT 1 FROM public.board_post_i18n i WHERE i.post_id = b.id AND i.language_code = 'en' AND COALESCE(i.title,'') <> ''))::BIGINT,
    (SELECT COUNT(*) FROM public.board_post_i18n WHERE language_code = 'en' AND translation_status = 'sync_required')::BIGINT,
    (SELECT COUNT(*) FROM public.board_post_i18n WHERE language_code = 'en' AND translation_status IN ('reviewed','published'))::BIGINT;
END;
$$;

-- 3. 누락 항목 상세 조회 함수 (drift 감지 포함)
CREATE OR REPLACE FUNCTION public.get_i18n_missing_items(p_content_type TEXT, p_filter TEXT DEFAULT 'en_missing')
RETURNS TABLE(
  item_id UUID,
  ko_title TEXT,
  ko_content TEXT,
  en_title TEXT,
  status TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_content_type = 'course' THEN
    RETURN QUERY
    SELECT c.id, c.title, c.description,
           (SELECT i.title FROM public.course_i18n i WHERE i.course_id = c.id AND i.language_code='en') AS en_title,
           COALESCE((SELECT i.translation_status FROM public.course_i18n i WHERE i.course_id = c.id AND i.language_code='en'),'draft') AS status,
           c.updated_at
    FROM public.courses c
    WHERE
      (p_filter = 'en_missing' AND NOT EXISTS (SELECT 1 FROM public.course_i18n i WHERE i.course_id = c.id AND i.language_code='en' AND COALESCE(i.title,'')<>''))
      OR (p_filter = 'sync_required' AND EXISTS (SELECT 1 FROM public.course_i18n i WHERE i.course_id = c.id AND i.language_code='en' AND i.translation_status='sync_required'))
      OR (p_filter = 'all')
    ORDER BY c.updated_at DESC NULLS LAST
    LIMIT 200;
  ELSIF p_content_type = 'content' THEN
    RETURN QUERY
    SELECT cc.id, cc.title, cc.description,
           (SELECT i.title FROM public.course_content_i18n i WHERE i.content_id = cc.id AND i.language_code='en'),
           COALESCE((SELECT i.translation_status FROM public.course_content_i18n i WHERE i.content_id = cc.id AND i.language_code='en'),'draft'),
           cc.updated_at
    FROM public.course_contents cc
    WHERE
      (p_filter = 'en_missing' AND NOT EXISTS (SELECT 1 FROM public.course_content_i18n i WHERE i.content_id = cc.id AND i.language_code='en' AND COALESCE(i.title,'')<>''))
      OR (p_filter = 'sync_required' AND EXISTS (SELECT 1 FROM public.course_content_i18n i WHERE i.content_id = cc.id AND i.language_code='en' AND i.translation_status='sync_required'))
      OR (p_filter = 'all')
    ORDER BY cc.updated_at DESC NULLS LAST
    LIMIT 200;
  ELSIF p_content_type = 'assessment' THEN
    RETURN QUERY
    SELECT a.id, a.title, a.description,
           (SELECT i.title FROM public.assessment_i18n i WHERE i.assessment_id = a.id AND i.language_code='en'),
           COALESCE((SELECT i.translation_status FROM public.assessment_i18n i WHERE i.assessment_id = a.id AND i.language_code='en'),'draft'),
           a.updated_at
    FROM public.assessments a
    WHERE
      (p_filter = 'en_missing' AND NOT EXISTS (SELECT 1 FROM public.assessment_i18n i WHERE i.assessment_id = a.id AND i.language_code='en' AND COALESCE(i.title,'')<>''))
      OR (p_filter = 'sync_required' AND EXISTS (SELECT 1 FROM public.assessment_i18n i WHERE i.assessment_id = a.id AND i.language_code='en' AND i.translation_status='sync_required'))
      OR (p_filter = 'all')
    ORDER BY a.updated_at DESC NULLS LAST
    LIMIT 200;
  ELSIF p_content_type = 'announcement' THEN
    RETURN QUERY
    SELECT a.id, a.title, a.content,
           (SELECT i.title FROM public.announcement_i18n i WHERE i.announcement_id = a.id AND i.language_code='en'),
           COALESCE((SELECT i.translation_status FROM public.announcement_i18n i WHERE i.announcement_id = a.id AND i.language_code='en'),'draft'),
           a.updated_at
    FROM public.announcements a
    WHERE
      (p_filter = 'en_missing' AND NOT EXISTS (SELECT 1 FROM public.announcement_i18n i WHERE i.announcement_id = a.id AND i.language_code='en' AND COALESCE(i.title,'')<>''))
      OR (p_filter = 'sync_required' AND EXISTS (SELECT 1 FROM public.announcement_i18n i WHERE i.announcement_id = a.id AND i.language_code='en' AND i.translation_status='sync_required'))
      OR (p_filter = 'all')
    ORDER BY a.updated_at DESC NULLS LAST
    LIMIT 200;
  ELSIF p_content_type = 'board' THEN
    RETURN QUERY
    SELECT b.id, b.title, b.content,
           (SELECT i.title FROM public.board_post_i18n i WHERE i.post_id = b.id AND i.language_code='en'),
           COALESCE((SELECT i.translation_status FROM public.board_post_i18n i WHERE i.post_id = b.id AND i.language_code='en'),'draft'),
           b.updated_at
    FROM public.board_posts b
    WHERE
      (p_filter = 'en_missing' AND NOT EXISTS (SELECT 1 FROM public.board_post_i18n i WHERE i.post_id = b.id AND i.language_code='en' AND COALESCE(i.title,'')<>''))
      OR (p_filter = 'sync_required' AND EXISTS (SELECT 1 FROM public.board_post_i18n i WHERE i.post_id = b.id AND i.language_code='en' AND i.translation_status='sync_required'))
      OR (p_filter = 'all')
    ORDER BY b.updated_at DESC NULLS LAST
    LIMIT 200;
  END IF;
END;
$$;

-- 4. Drift 감지 함수: KO 원본을 비교해 sync_required 플래그 갱신
CREATE OR REPLACE FUNCTION public.detect_i18n_drift()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_courses_marked INT := 0;
  v_contents_marked INT := 0;
  v_assessments_marked INT := 0;
  v_announcements_marked INT := 0;
  v_boards_marked INT := 0;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- courses
  WITH src AS (
    SELECT c.id, encode(extensions.digest(coalesce(c.title,'') || '|' || coalesce(c.description,''), 'sha256'), 'hex') AS h
    FROM public.courses c
  )
  UPDATE public.course_i18n i
  SET translation_status = 'sync_required'
  FROM src
  WHERE i.course_id = src.id
    AND i.language_code = 'en'
    AND COALESCE(i.title,'') <> ''
    AND (i.source_hash IS NULL OR i.source_hash <> src.h)
    AND i.translation_status NOT IN ('sync_required');
  GET DIAGNOSTICS v_courses_marked = ROW_COUNT;

  -- contents
  WITH src AS (
    SELECT cc.id, encode(extensions.digest(coalesce(cc.title,'') || '|' || coalesce(cc.description,''), 'sha256'), 'hex') AS h
    FROM public.course_contents cc
  )
  UPDATE public.course_content_i18n i
  SET translation_status = 'sync_required'
  FROM src
  WHERE i.content_id = src.id
    AND i.language_code = 'en'
    AND COALESCE(i.title,'') <> ''
    AND (i.source_hash IS NULL OR i.source_hash <> src.h)
    AND i.translation_status NOT IN ('sync_required');
  GET DIAGNOSTICS v_contents_marked = ROW_COUNT;

  -- assessments
  WITH src AS (
    SELECT a.id, encode(extensions.digest(coalesce(a.title,'') || '|' || coalesce(a.description,''), 'sha256'), 'hex') AS h
    FROM public.assessments a
  )
  UPDATE public.assessment_i18n i
  SET translation_status = 'sync_required'
  FROM src
  WHERE i.assessment_id = src.id
    AND i.language_code = 'en'
    AND COALESCE(i.title,'') <> ''
    AND (i.source_hash IS NULL OR i.source_hash <> src.h)
    AND i.translation_status NOT IN ('sync_required');
  GET DIAGNOSTICS v_assessments_marked = ROW_COUNT;

  -- announcements
  WITH src AS (
    SELECT a.id, encode(extensions.digest(coalesce(a.title,'') || '|' || coalesce(a.content,''), 'sha256'), 'hex') AS h
    FROM public.announcements a
  )
  UPDATE public.announcement_i18n i
  SET translation_status = 'sync_required'
  FROM src
  WHERE i.announcement_id = src.id
    AND i.language_code = 'en'
    AND COALESCE(i.title,'') <> ''
    AND (i.source_hash IS NULL OR i.source_hash <> src.h)
    AND i.translation_status NOT IN ('sync_required');
  GET DIAGNOSTICS v_announcements_marked = ROW_COUNT;

  -- board_posts
  WITH src AS (
    SELECT b.id, encode(extensions.digest(coalesce(b.title,'') || '|' || coalesce(b.content,''), 'sha256'), 'hex') AS h
    FROM public.board_posts b
  )
  UPDATE public.board_post_i18n i
  SET translation_status = 'sync_required'
  FROM src
  WHERE i.post_id = src.id
    AND i.language_code = 'en'
    AND COALESCE(i.title,'') <> ''
    AND (i.source_hash IS NULL OR i.source_hash <> src.h)
    AND i.translation_status NOT IN ('sync_required');
  GET DIAGNOSTICS v_boards_marked = ROW_COUNT;

  RETURN jsonb_build_object(
    'courses', v_courses_marked,
    'contents', v_contents_marked,
    'assessments', v_assessments_marked,
    'announcements', v_announcements_marked,
    'boards', v_boards_marked
  );
END;
$$;