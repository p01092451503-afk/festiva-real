-- Allow public/anon read of community content for public community page
GRANT SELECT ON public.community_posts TO anon;
GRANT SELECT ON public.community_comments TO anon;
GRANT SELECT ON public.community_likes TO anon;
GRANT SELECT ON public.community_categories TO anon;

CREATE POLICY "posts public viewable" ON public.community_posts
  FOR SELECT TO anon USING (is_hidden = false);

CREATE POLICY "comments public viewable" ON public.community_comments
  FOR SELECT TO anon USING (true);

CREATE POLICY "likes public viewable" ON public.community_likes
  FOR SELECT TO anon USING (true);
