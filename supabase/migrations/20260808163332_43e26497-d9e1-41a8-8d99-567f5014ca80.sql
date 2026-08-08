ALTER TABLE public.video_assets ADD COLUMN IF NOT EXISTS storage_path TEXT;

DROP POLICY IF EXISTS "course_videos_read" ON storage.objects;
CREATE POLICY "course_videos_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'course-videos');

DROP POLICY IF EXISTS "course_videos_insert" ON storage.objects;
CREATE POLICY "course_videos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'course-videos'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'teacher')
    )
  );

DROP POLICY IF EXISTS "course_videos_update" ON storage.objects;
CREATE POLICY "course_videos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'course-videos'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'teacher')
    )
  );

DROP POLICY IF EXISTS "course_videos_delete" ON storage.objects;
CREATE POLICY "course_videos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'course-videos'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
    )
  );