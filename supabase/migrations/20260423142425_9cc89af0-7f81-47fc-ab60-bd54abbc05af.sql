-- Add missing FK from track_step_courses.course_id to courses(id)
-- This enables PostgREST to perform the embedded join (course:courses(...))
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.track_step_courses'::regclass
      AND conname = 'track_step_courses_course_id_fkey'
  ) THEN
    ALTER TABLE public.track_step_courses
      ADD CONSTRAINT track_step_courses_course_id_fkey
      FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Helpful index for the new FK lookups
CREATE INDEX IF NOT EXISTS idx_track_step_courses_course_id
  ON public.track_step_courses(course_id);