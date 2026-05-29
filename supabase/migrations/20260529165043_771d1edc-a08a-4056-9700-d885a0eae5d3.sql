
ALTER TABLE public.course_detail_blocks
  DROP CONSTRAINT IF EXISTS course_detail_blocks_block_type_check;

ALTER TABLE public.course_detail_blocks
  ADD CONSTRAINT course_detail_blocks_block_type_check
  CHECK (block_type = ANY (ARRAY['text'::text, 'image'::text, 'checklist'::text, 'video'::text, 'heading'::text]));

ALTER TABLE public.course_detail_blocks
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS video_provider text;
