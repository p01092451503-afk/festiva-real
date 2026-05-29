
UPDATE public.course_contents 
SET video_url = 'bunny://e251372e-c3d4-4c66-ac35-7b27b97cad05',
    video_provider = 'bunny',
    bunny_video_guid = 'e251372e-c3d4-4c66-ac35-7b27b97cad05'
WHERE order_index = 1;

UPDATE public.course_contents 
SET video_url = 'bunny://6ece04bd-692a-448c-a6a5-37898453e605',
    video_provider = 'bunny',
    bunny_video_guid = '6ece04bd-692a-448c-a6a5-37898453e605'
WHERE order_index = 2;
