-- Map Bunny CDN videos to lessons 1, 2, 3 of every course
UPDATE public.course_contents
SET bunny_video_guid = '9e891cd3-a608-49ee-9815-669daca9d6af',
    video_provider = 'bunny',
    video_url = 'bunny://9e891cd3-a608-49ee-9815-669daca9d6af',
    content_type = 'video',
    updated_at = now()
WHERE order_index = 1;

UPDATE public.course_contents
SET bunny_video_guid = '6ece04bd-692a-448c-a6a5-37898453e605',
    video_provider = 'bunny',
    video_url = 'bunny://6ece04bd-692a-448c-a6a5-37898453e605',
    content_type = 'video',
    updated_at = now()
WHERE order_index = 2;

UPDATE public.course_contents
SET bunny_video_guid = 'e251372e-c3d4-4c66-ac35-7b27b97cad05',
    video_provider = 'bunny',
    video_url = 'bunny://e251372e-c3d4-4c66-ac35-7b27b97cad05',
    content_type = 'video',
    updated_at = now()
WHERE order_index = 3;