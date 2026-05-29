
INSERT INTO storage.buckets (id, name, public) VALUES ('assignment-files', 'assignment-files', false);

CREATE POLICY "Users can upload own assignment files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'assignment-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own assignment files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'assignment-files' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
  ));
