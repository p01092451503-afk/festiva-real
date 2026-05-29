
-- ============================================================
-- CMS: article_categories
-- ============================================================
CREATE TABLE IF NOT EXISTS public.article_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  name_en text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.article_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "article_categories readable by authenticated"
  ON public.article_categories FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "article_categories admin/teacher manage"
  ON public.article_categories FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
  );

CREATE TRIGGER trg_article_categories_updated_at
  BEFORE UPDATE ON public.article_categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 기본 카테고리 시드
INSERT INTO public.article_categories (slug, name, name_en, sort_order)
VALUES
  ('notice',     '공지',     'Notice',         10),
  ('industry',   '산업동향', 'Industry News',  20),
  ('learning',   '학습자료', 'Learning',       30),
  ('case-study', '사례연구', 'Case Study',     40)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- CMS: articles
-- ============================================================
CREATE TYPE public.article_status AS ENUM ('draft', 'scheduled', 'published', 'archived');

CREATE TABLE IF NOT EXISTS public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text UNIQUE,
  summary text,
  body text NOT NULL DEFAULT '',
  thumbnail_url text,
  category_id uuid REFERENCES public.article_categories(id) ON DELETE SET NULL,
  tags text[] NOT NULL DEFAULT '{}',
  status public.article_status NOT NULL DEFAULT 'draft',
  publish_at timestamptz,             -- scheduled / published 시점
  published_at timestamptz,           -- 실제 발행된 순간 (자동 기록)
  author_id uuid,                     -- auth.users(id) — FK 미사용 (Supabase 권장)
  view_count integer NOT NULL DEFAULT 0,
  language_code text NOT NULL DEFAULT 'ko',
  search_tsv tsvector,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_articles_status_publish_at
  ON public.articles (status, publish_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category
  ON public.articles (category_id);
CREATE INDEX IF NOT EXISTS idx_articles_tags
  ON public.articles USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_articles_search_tsv
  ON public.articles USING GIN (search_tsv);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- 학습자: published + publish_at 도달분만
CREATE POLICY "articles published readable by authenticated"
  ON public.articles FOR SELECT
  TO authenticated
  USING (
    (status = 'published' AND (publish_at IS NULL OR publish_at <= now()))
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
  );

-- 등록/수정/삭제: admin/super_admin/teacher
CREATE POLICY "articles admin/teacher insert"
  ON public.articles FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
  );

CREATE POLICY "articles admin/teacher update"
  ON public.articles FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
  );

CREATE POLICY "articles admin/teacher delete"
  ON public.articles FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
  );

CREATE TRIGGER trg_articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================
-- 검색용 tsvector 자동 채움 + 발행 시점 자동 기록
-- ============================================================
CREATE OR REPLACE FUNCTION public.articles_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_cfg regconfig := 'simple'::regconfig;  -- 한국어 호환을 위해 simple 사용 (ILIKE 보다 정확)
BEGIN
  -- 가중치 tsvector: A=title, B=summary+tags, D=body
  NEW.search_tsv :=
       setweight(to_tsvector(v_cfg, coalesce(NEW.title, '')), 'A')
    || setweight(to_tsvector(v_cfg, coalesce(NEW.summary, '')), 'B')
    || setweight(to_tsvector(v_cfg, array_to_string(coalesce(NEW.tags, '{}'::text[]), ' ')), 'B')
    || setweight(to_tsvector(v_cfg, coalesce(NEW.body, '')), 'D');

  -- 상태 → 시점 일관성
  IF NEW.status = 'published' THEN
    IF NEW.publish_at IS NULL THEN
      NEW.publish_at := now();
    END IF;
    IF NEW.published_at IS NULL THEN
      NEW.published_at := COALESCE(NEW.publish_at, now());
    END IF;
  ELSIF NEW.status = 'scheduled' THEN
    IF NEW.publish_at IS NULL THEN
      RAISE EXCEPTION 'scheduled 상태는 publish_at(예약 시각)이 필요합니다';
    END IF;
    NEW.published_at := NULL;
  ELSE
    -- draft / archived
    NEW.published_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_articles_before_write
  BEFORE INSERT OR UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.articles_before_write();

-- ============================================================
-- 검색 RPC: 가중치 ts_rank + 카테고리/태그/페이지네이션
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_articles(
  p_query text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_tag text DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  title text,
  slug text,
  summary text,
  thumbnail_url text,
  category_id uuid,
  category_name text,
  tags text[],
  publish_at timestamptz,
  view_count integer,
  rank real,
  total_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q tsquery;
  v_total bigint;
BEGIN
  IF p_query IS NOT NULL AND btrim(p_query) <> '' THEN
    -- websearch_to_tsquery 가 사용자 친화적 (따옴표/OR 지원)
    BEGIN
      v_q := websearch_to_tsquery('simple', p_query);
    EXCEPTION WHEN OTHERS THEN
      v_q := plainto_tsquery('simple', p_query);
    END;
  ELSE
    v_q := NULL;
  END IF;

  -- 총 개수
  SELECT count(*) INTO v_total
  FROM public.articles a
  WHERE a.status = 'published'
    AND (a.publish_at IS NULL OR a.publish_at <= now())
    AND (p_category_id IS NULL OR a.category_id = p_category_id)
    AND (p_tag IS NULL OR p_tag = ANY(a.tags))
    AND (v_q IS NULL OR a.search_tsv @@ v_q);

  RETURN QUERY
  SELECT
    a.id,
    a.title,
    a.slug,
    a.summary,
    a.thumbnail_url,
    a.category_id,
    c.name AS category_name,
    a.tags,
    a.publish_at,
    a.view_count,
    CASE WHEN v_q IS NULL THEN 0::real
         ELSE ts_rank_cd(a.search_tsv, v_q)
    END AS rank,
    v_total AS total_count
  FROM public.articles a
  LEFT JOIN public.article_categories c ON c.id = a.category_id
  WHERE a.status = 'published'
    AND (a.publish_at IS NULL OR a.publish_at <= now())
    AND (p_category_id IS NULL OR a.category_id = p_category_id)
    AND (p_tag IS NULL OR p_tag = ANY(a.tags))
    AND (v_q IS NULL OR a.search_tsv @@ v_q)
  ORDER BY
    CASE WHEN v_q IS NULL THEN 0 ELSE 1 END DESC,
    rank DESC NULLS LAST,
    a.publish_at DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(p_limit, 100))
  OFFSET GREATEST(0, p_offset);
END;
$$;

-- ============================================================
-- 추천 RPC: 같은 카테고리 + 태그 유사도
-- ============================================================
CREATE OR REPLACE FUNCTION public.recommend_articles(
  p_article_id uuid,
  p_limit integer DEFAULT 4
)
RETURNS TABLE (
  id uuid,
  title text,
  summary text,
  thumbnail_url text,
  category_name text,
  publish_at timestamptz,
  similarity_score integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat uuid;
  v_tags text[];
BEGIN
  SELECT category_id, tags INTO v_cat, v_tags
  FROM public.articles WHERE id = p_article_id;

  RETURN QUERY
  SELECT
    a.id, a.title, a.summary, a.thumbnail_url, c.name, a.publish_at,
    (
      (CASE WHEN v_cat IS NOT NULL AND a.category_id = v_cat THEN 5 ELSE 0 END)
      + COALESCE(cardinality(ARRAY(SELECT unnest(a.tags) INTERSECT SELECT unnest(coalesce(v_tags,'{}'::text[])))), 0)
    )::int AS similarity_score
  FROM public.articles a
  LEFT JOIN public.article_categories c ON c.id = a.category_id
  WHERE a.id <> p_article_id
    AND a.status = 'published'
    AND (a.publish_at IS NULL OR a.publish_at <= now())
  ORDER BY similarity_score DESC, a.publish_at DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(p_limit, 20));
END;
$$;

-- ============================================================
-- 예약 발행 일괄 전환 RPC (cron + 조회 시점 폴백)
-- ============================================================
CREATE OR REPLACE FUNCTION public.publish_scheduled_articles()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  WITH upd AS (
    UPDATE public.articles
       SET status = 'published',
           published_at = COALESCE(published_at, publish_at, now())
     WHERE status = 'scheduled'
       AND publish_at IS NOT NULL
       AND publish_at <= now()
     RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$$;

-- ============================================================
-- 조회수 증가 (학습자 detail 페이지 진입 시 호출)
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_article_view(p_article_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.articles
     SET view_count = view_count + 1
   WHERE id = p_article_id
     AND status = 'published'
     AND (publish_at IS NULL OR publish_at <= now());
$$;
