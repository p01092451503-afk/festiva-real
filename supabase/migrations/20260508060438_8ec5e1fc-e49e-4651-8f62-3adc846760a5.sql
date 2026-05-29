
UPDATE public.course_contents
SET video_url = 'https://www.youtube.com/watch?v=54wCpQXUCl4',
    video_provider = 'youtube',
    updated_at = now()
WHERE course_id IN (SELECT id FROM public.courses WHERE title LIKE '샘플 강의%');
