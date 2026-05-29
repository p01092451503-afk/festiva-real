
-- Add sequential learning toggle to courses
ALTER TABLE public.courses ADD COLUMN is_sequential boolean NOT NULL DEFAULT false;

-- Add order_index to assessments so they can be interleaved with course_contents
ALTER TABLE public.assessments ADD COLUMN order_index integer NOT NULL DEFAULT 0;
