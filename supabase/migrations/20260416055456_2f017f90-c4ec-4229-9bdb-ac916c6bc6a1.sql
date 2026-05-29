
-- Create storage bucket for course detail blocks images
INSERT INTO storage.buckets (id, name, public) VALUES ('course-blocks', 'course-blocks', true) ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for hero banner images
INSERT INTO storage.buckets (id, name, public) VALUES ('banners', 'banners', true) ON CONFLICT (id) DO NOTHING;

-- Public read for course-blocks
CREATE POLICY "Anyone can view course block images" ON storage.objects FOR SELECT USING (bucket_id = 'course-blocks');

-- Admin/teacher upload for course-blocks
CREATE POLICY "Admins and teachers can upload course block images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'course-blocks' AND (auth.uid() IS NOT NULL));

CREATE POLICY "Admins and teachers can delete course block images" ON storage.objects FOR DELETE USING (bucket_id = 'course-blocks' AND (auth.uid() IS NOT NULL));

-- Public read for banners
CREATE POLICY "Anyone can view banner images" ON storage.objects FOR SELECT USING (bucket_id = 'banners');

-- Admin upload for banners
CREATE POLICY "Admins can upload banner images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'banners' AND (auth.uid() IS NOT NULL));

CREATE POLICY "Admins can delete banner images" ON storage.objects FOR DELETE USING (bucket_id = 'banners' AND (auth.uid() IS NOT NULL));
