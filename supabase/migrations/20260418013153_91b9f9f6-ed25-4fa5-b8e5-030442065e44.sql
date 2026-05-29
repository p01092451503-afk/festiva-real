-- Bunny Stream 통합을 위한 컬럼 추가
ALTER TABLE public.video_assets
  ADD COLUMN IF NOT EXISTS bunny_video_guid TEXT;

ALTER TABLE public.course_contents
  ADD COLUMN IF NOT EXISTS bunny_video_guid TEXT;

ALTER TABLE public.course_content_i18n
  ADD COLUMN IF NOT EXISTS bunny_video_guid TEXT;

CREATE INDEX IF NOT EXISTS idx_video_assets_bunny_guid ON public.video_assets(bunny_video_guid) WHERE bunny_video_guid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_course_contents_bunny_guid ON public.course_contents(bunny_video_guid) WHERE bunny_video_guid IS NOT NULL;