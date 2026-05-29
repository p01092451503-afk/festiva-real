
-- 1) 카테고리
CREATE TABLE public.community_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.community_categories TO anon, authenticated;
GRANT ALL ON public.community_categories TO service_role;
ALTER TABLE public.community_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories viewable by all" ON public.community_categories FOR SELECT USING (true);
CREATE POLICY "categories admin manage" ON public.community_categories FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

-- 2) 게시글
CREATE TABLE public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.community_categories(id) ON DELETE SET NULL,
  author_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  image_urls text[] NOT NULL DEFAULT '{}',
  view_count int NOT NULL DEFAULT 0,
  is_pinned boolean NOT NULL DEFAULT false,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_community_posts_category ON public.community_posts(category_id);
CREATE INDEX idx_community_posts_author ON public.community_posts(author_id);
CREATE INDEX idx_community_posts_created ON public.community_posts(created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts TO authenticated;
GRANT ALL ON public.community_posts TO service_role;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts viewable" ON public.community_posts FOR SELECT TO authenticated
  USING (is_hidden = false OR author_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "posts insert own" ON public.community_posts FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());
CREATE POLICY "posts update own or admin" ON public.community_posts FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "posts delete own or admin" ON public.community_posts FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

-- 3) 좋아요
CREATE TABLE public.community_likes (
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.community_likes TO authenticated;
GRANT ALL ON public.community_likes TO service_role;
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes viewable" ON public.community_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "likes insert own" ON public.community_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "likes delete own" ON public.community_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 4) 북마크
CREATE TABLE public.community_bookmarks (
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.community_bookmarks TO authenticated;
GRANT ALL ON public.community_bookmarks TO service_role;
ALTER TABLE public.community_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookmarks own select" ON public.community_bookmarks FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "bookmarks own insert" ON public.community_bookmarks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "bookmarks own delete" ON public.community_bookmarks FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 5) 댓글
CREATE TABLE public.community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_community_comments_post ON public.community_comments(post_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_comments TO authenticated;
GRANT ALL ON public.community_comments TO service_role;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments viewable" ON public.community_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "comments insert own" ON public.community_comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "comments update own or admin" ON public.community_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "comments delete own or admin" ON public.community_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

-- updated_at 트리거
CREATE TRIGGER trg_community_categories_updated BEFORE UPDATE ON public.community_categories FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_community_posts_updated BEFORE UPDATE ON public.community_posts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_community_comments_updated BEFORE UPDATE ON public.community_comments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 기본 카테고리
INSERT INTO public.community_categories (name, slug, sort_order) VALUES
  ('공지', 'notice', 1),
  ('자유게시판', 'free', 2),
  ('질문', 'qna', 3),
  ('후기', 'review', 4),
  ('정보공유', 'info', 5);

-- 스토리지 버킷 (커뮤니티 이미지)
INSERT INTO storage.buckets (id, name, public) VALUES ('community-images', 'community-images', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "community images public read" ON storage.objects FOR SELECT USING (bucket_id = 'community-images');
CREATE POLICY "community images authed upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'community-images');
CREATE POLICY "community images own delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'community-images' AND (owner = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin')));
