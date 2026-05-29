ALTER TABLE public.course_contents ALTER COLUMN duration_minutes TYPE numeric(8,2) USING duration_minutes::numeric(8,2);
ALTER TABLE public.course_content_i18n ALTER COLUMN duration_minutes TYPE numeric(8,2) USING duration_minutes::numeric(8,2);
ALTER TABLE public.video_assets ALTER COLUMN duration_minutes TYPE numeric(8,2) USING duration_minutes::numeric(8,2);