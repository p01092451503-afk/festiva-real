
CREATE TABLE public.board_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.board_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.board_comments ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view comments on published posts
CREATE POLICY "Anyone can view comments on published posts"
ON public.board_comments
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.board_posts bp WHERE bp.id = board_comments.post_id AND bp.is_published = true)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'teacher'::app_role)
);

-- Authenticated users can insert comments
CREATE POLICY "Authenticated users can insert comments"
ON public.board_comments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = author_id);

-- Users can update own comments
CREATE POLICY "Users can update own comments"
ON public.board_comments
FOR UPDATE
TO authenticated
USING (auth.uid() = author_id)
WITH CHECK (auth.uid() = author_id);

-- Users can delete own comments, admins/teachers can delete any
CREATE POLICY "Users and admins can delete comments"
ON public.board_comments
FOR DELETE
TO authenticated
USING (
  auth.uid() = author_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'teacher'::app_role)
);
