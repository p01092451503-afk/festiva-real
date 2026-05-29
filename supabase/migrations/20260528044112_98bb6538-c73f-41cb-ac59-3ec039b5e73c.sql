-- 1. community_categories 트리 구조 + 권한 확장
ALTER TABLE public.community_categories
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.community_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category_type text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS write_role text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS icon text;

ALTER TABLE public.community_categories
  DROP CONSTRAINT IF EXISTS community_categories_type_check;
ALTER TABLE public.community_categories
  ADD CONSTRAINT community_categories_type_check
  CHECK (category_type IN ('general','qna','column','notice','series'));

ALTER TABLE public.community_categories
  DROP CONSTRAINT IF EXISTS community_categories_write_role_check;
ALTER TABLE public.community_categories
  ADD CONSTRAINT community_categories_write_role_check
  CHECK (write_role IN ('all','member','teacher','admin'));

CREATE INDEX IF NOT EXISTS idx_community_categories_parent ON public.community_categories(parent_id);

-- 2. community_follows 테이블
CREATE TABLE IF NOT EXISTS public.community_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

GRANT SELECT ON public.community_follows TO anon;
GRANT SELECT, INSERT, DELETE ON public.community_follows TO authenticated;
GRANT ALL ON public.community_follows TO service_role;

ALTER TABLE public.community_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "follows viewable by all"
  ON public.community_follows FOR SELECT
  USING (true);

CREATE POLICY "follows insert own"
  ON public.community_follows FOR INSERT
  TO authenticated
  WITH CHECK (follower_id = auth.uid());

CREATE POLICY "follows delete own"
  ON public.community_follows FOR DELETE
  TO authenticated
  USING (follower_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.community_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.community_follows(following_id);

-- 3. 게시글 작성 권한 강화 (카테고리 write_role 검사)
DROP POLICY IF EXISTS "posts insert own" ON public.community_posts;
CREATE POLICY "posts insert with role"
  ON public.community_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      category_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.community_categories c
        WHERE c.id = category_id
          AND (
            c.write_role = 'all'
            OR (c.write_role = 'member' AND auth.uid() IS NOT NULL)
            OR (c.write_role = 'teacher' AND (public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')))
            OR (c.write_role = 'admin' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')))
          )
      )
    )
  );