
-- 1. 배지 마스터
CREATE TABLE public.community_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT DEFAULT 'primary',
  criteria JSONB DEFAULT '{}'::jsonb,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.community_badges TO anon, authenticated;
GRANT ALL ON public.community_badges TO service_role;
ALTER TABLE public.community_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges_select_all" ON public.community_badges FOR SELECT USING (true);
CREATE POLICY "badges_admin_manage" ON public.community_badges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- 2. 사용자별 보유 배지
CREATE TABLE public.community_user_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  badge_id UUID NOT NULL REFERENCES public.community_badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);
CREATE INDEX idx_user_badges_user ON public.community_user_badges(user_id);
GRANT SELECT ON public.community_user_badges TO authenticated;
GRANT ALL ON public.community_user_badges TO service_role;
ALTER TABLE public.community_user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_badges_select" ON public.community_user_badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_badges_admin_manage" ON public.community_user_badges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- 3. Q&A 답변
CREATE TABLE public.community_qna_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL,
  author_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_accepted BOOLEAN NOT NULL DEFAULT false,
  accepted_at TIMESTAMPTZ,
  like_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_qna_answers_post ON public.community_qna_answers(post_id);
CREATE INDEX idx_qna_answers_author ON public.community_qna_answers(author_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_qna_answers TO authenticated;
GRANT SELECT ON public.community_qna_answers TO anon;
GRANT ALL ON public.community_qna_answers TO service_role;
ALTER TABLE public.community_qna_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qna_answers_select_all" ON public.community_qna_answers FOR SELECT USING (true);
CREATE POLICY "qna_answers_insert_own" ON public.community_qna_answers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);
CREATE POLICY "qna_answers_update_own" ON public.community_qna_answers FOR UPDATE TO authenticated
  USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "qna_answers_delete_own" ON public.community_qna_answers FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- 질문 작성자만 답변 채택 가능 (트리거)
CREATE OR REPLACE FUNCTION public.community_qna_accept_check()
RETURNS TRIGGER AS $$
DECLARE
  post_author UUID;
BEGIN
  IF NEW.is_accepted IS DISTINCT FROM OLD.is_accepted AND NEW.is_accepted = true THEN
    SELECT author_id INTO post_author FROM public.community_posts WHERE id = NEW.post_id;
    IF post_author IS NULL THEN
      RAISE EXCEPTION 'Post not found';
    END IF;
    IF auth.uid() <> post_author AND NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
      RAISE EXCEPTION 'Only post author can accept answers';
    END IF;
    NEW.accepted_at := now();
    -- 다른 답변 채택 해제 (단일 채택)
    UPDATE public.community_qna_answers
      SET is_accepted = false, accepted_at = NULL
      WHERE post_id = NEW.post_id AND id <> NEW.id AND is_accepted = true;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_qna_accept_check
BEFORE UPDATE ON public.community_qna_answers
FOR EACH ROW EXECUTE FUNCTION public.community_qna_accept_check();

-- 4. 일별 랭킹 스냅샷
CREATE TABLE public.community_rankings_daily (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  user_id UUID NOT NULL,
  post_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  like_received INTEGER NOT NULL DEFAULT 0,
  follower_count INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(snapshot_date, user_id)
);
CREATE INDEX idx_rankings_date_score ON public.community_rankings_daily(snapshot_date, score DESC);
GRANT SELECT ON public.community_rankings_daily TO anon, authenticated;
GRANT ALL ON public.community_rankings_daily TO service_role;
ALTER TABLE public.community_rankings_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rankings_select_all" ON public.community_rankings_daily FOR SELECT USING (true);
CREATE POLICY "rankings_admin_manage" ON public.community_rankings_daily FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- 5. 일별 랭킹 집계 함수 (관리자/엣지펑션에서 호출)
CREATE OR REPLACE FUNCTION public.community_aggregate_daily_rankings(target_date DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER AS $$
DECLARE
  affected INTEGER;
BEGIN
  -- 기존 스냅샷 삭제
  DELETE FROM public.community_rankings_daily WHERE snapshot_date = target_date;

  WITH post_stats AS (
    SELECT author_id AS user_id, COUNT(*) AS post_count
    FROM public.community_posts WHERE is_hidden = false GROUP BY author_id
  ),
  comment_stats AS (
    SELECT author_id AS user_id, COUNT(*) AS comment_count
    FROM public.community_comments GROUP BY author_id
  ),
  like_stats AS (
    SELECT p.author_id AS user_id, COUNT(*) AS like_received
    FROM public.community_likes l JOIN public.community_posts p ON p.id = l.post_id
    GROUP BY p.author_id
  ),
  follow_stats AS (
    SELECT following_id AS user_id, COUNT(*) AS follower_count
    FROM public.community_follows GROUP BY following_id
  ),
  combined AS (
    SELECT
      COALESCE(ps.user_id, cs.user_id, ls.user_id, fs.user_id) AS user_id,
      COALESCE(ps.post_count, 0) AS post_count,
      COALESCE(cs.comment_count, 0) AS comment_count,
      COALESCE(ls.like_received, 0) AS like_received,
      COALESCE(fs.follower_count, 0) AS follower_count,
      COALESCE(ps.post_count, 0) * 5
        + COALESCE(cs.comment_count, 0) * 2
        + COALESCE(ls.like_received, 0) * 3
        + COALESCE(fs.follower_count, 0) * 4 AS score
    FROM post_stats ps
    FULL OUTER JOIN comment_stats cs ON ps.user_id = cs.user_id
    FULL OUTER JOIN like_stats ls ON COALESCE(ps.user_id, cs.user_id) = ls.user_id
    FULL OUTER JOIN follow_stats fs ON COALESCE(ps.user_id, cs.user_id, ls.user_id) = fs.user_id
  ),
  ranked AS (
    SELECT *, RANK() OVER (ORDER BY score DESC) AS rank FROM combined WHERE user_id IS NOT NULL
  )
  INSERT INTO public.community_rankings_daily
    (snapshot_date, user_id, post_count, comment_count, like_received, follower_count, score, rank)
  SELECT target_date, user_id, post_count, comment_count, like_received, follower_count, score, rank
  FROM ranked;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
