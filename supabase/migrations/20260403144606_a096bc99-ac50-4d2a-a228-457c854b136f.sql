
-- Create storage bucket for course thumbnails
INSERT INTO storage.buckets (id, name, public) VALUES ('course-thumbnails', 'course-thumbnails', true);

-- Allow authenticated users to upload thumbnails
CREATE POLICY "Authenticated users can upload thumbnails"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'course-thumbnails');

-- Allow anyone to view thumbnails
CREATE POLICY "Anyone can view thumbnails"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'course-thumbnails');

-- Allow owners to update/delete their thumbnails
CREATE POLICY "Users can update own thumbnails"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'course-thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own thumbnails"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'course-thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text);
