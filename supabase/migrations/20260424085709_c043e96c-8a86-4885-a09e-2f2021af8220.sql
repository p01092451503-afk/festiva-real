ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS target_country_codes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_branch_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_course_ids uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE public.board_posts
  ADD COLUMN IF NOT EXISTS target_country_codes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_branch_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_course_ids uuid[] NOT NULL DEFAULT '{}';

UPDATE public.announcements
   SET target_country_codes = ARRAY[target_country_code]
 WHERE target_country_code IS NOT NULL AND COALESCE(array_length(target_country_codes,1),0) = 0;

UPDATE public.announcements
   SET target_branch_ids = ARRAY[target_branch_id]
 WHERE target_branch_id IS NOT NULL AND COALESCE(array_length(target_branch_ids,1),0) = 0;

UPDATE public.announcements
   SET target_course_ids = ARRAY[target_course_id]
 WHERE target_course_id IS NOT NULL AND COALESCE(array_length(target_course_ids,1),0) = 0;

UPDATE public.board_posts
   SET target_country_codes = ARRAY[target_country_code]
 WHERE target_country_code IS NOT NULL AND COALESCE(array_length(target_country_codes,1),0) = 0;

UPDATE public.board_posts
   SET target_branch_ids = ARRAY[target_branch_id]
 WHERE target_branch_id IS NOT NULL AND COALESCE(array_length(target_branch_ids,1),0) = 0;

UPDATE public.board_posts
   SET target_course_ids = ARRAY[course_id]
 WHERE course_id IS NOT NULL AND COALESCE(array_length(target_course_ids,1),0) = 0;