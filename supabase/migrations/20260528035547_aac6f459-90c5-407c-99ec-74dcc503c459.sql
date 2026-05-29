GRANT SELECT ON public.profiles TO anon;

CREATE POLICY "community author profiles viewable" ON public.profiles
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.community_posts cp WHERE cp.author_id = profiles.user_id AND cp.is_hidden = false));
