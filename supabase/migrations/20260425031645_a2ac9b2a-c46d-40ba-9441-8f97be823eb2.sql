ALTER TABLE public.track_steps
ADD COLUMN IF NOT EXISTS require_assessment_pass boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.track_steps.require_assessment_pass IS 'When true, all assessments in step courses must be passed (in addition to progress) for the step to count as complete.';