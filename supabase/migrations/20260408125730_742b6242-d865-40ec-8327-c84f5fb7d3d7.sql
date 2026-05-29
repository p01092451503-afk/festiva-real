
-- Board posts table (general board + course-specific board)
CREATE TABLE public.board_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id UUID NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT true,
  file_urls TEXT[] DEFAULT '{}',
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.board_posts ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read published posts
CREATE POLICY "Anyone can view published board posts"
  ON public.board_posts FOR SELECT TO authenticated
  USING (is_published = true);

-- Admins and teachers can manage posts
CREATE POLICY "Admins and teachers can insert board posts"
  ON public.board_posts FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher')
  );

CREATE POLICY "Admins and teachers can update board posts"
  ON public.board_posts FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher')
  );

CREATE POLICY "Admins and teachers can delete board posts"
  ON public.board_posts FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher')
  );

-- Storage bucket for board attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('board-files', 'board-files', true);

CREATE POLICY "Authenticated users can read board files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'board-files');

CREATE POLICY "Admins and teachers can upload board files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'board-files' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'))
  );

CREATE POLICY "Admins and teachers can delete board files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'board-files' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'))
  );
