
CREATE TABLE IF NOT EXISTS public.instructor_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_url TEXT,
  headline TEXT,
  bio TEXT,
  expertise TEXT[] NOT NULL DEFAULT '{}',
  years_experience INTEGER,
  website_url TEXT,
  public_email TEXT,
  social JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.instructor_profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructor_profiles TO authenticated;
GRANT ALL ON public.instructor_profiles TO service_role;

ALTER TABLE public.instructor_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructor profiles are viewable by everyone"
  ON public.instructor_profiles FOR SELECT
  USING (true);

CREATE POLICY "Admins manage instructor profiles"
  ON public.instructor_profiles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Instructors can upsert own profile"
  ON public.instructor_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Instructors can update own profile"
  ON public.instructor_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_instructor_profiles()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_instructor_profiles_updated
BEFORE UPDATE ON public.instructor_profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_instructor_profiles();

INSERT INTO storage.buckets (id, name, public)
VALUES ('instructor-photos', 'instructor-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Instructor photos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'instructor-photos');

CREATE POLICY "Admins manage instructor photos"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'instructor-photos'
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  )
  WITH CHECK (
    bucket_id = 'instructor-photos'
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  );

CREATE POLICY "Instructors manage own photos"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'instructor-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'instructor-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
