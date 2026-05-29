ALTER TABLE public.assessment_answers ADD COLUMN feedback text DEFAULT NULL;
ALTER TABLE public.assessment_answers ADD COLUMN graded_by uuid DEFAULT NULL;
ALTER TABLE public.assessment_answers ADD COLUMN graded_at timestamp with time zone DEFAULT NULL;