ALTER TABLE public.content_summaries
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS transcript_lang text,
  ADD COLUMN IF NOT EXISTS transcript_chars integer;

COMMENT ON COLUMN public.content_summaries.transcript IS '강의 영상에서 추출한 실제 전사문(자막). YouTube/Vimeo/Bunny 자막 트랙 또는 외부 STT 결과.';
COMMENT ON COLUMN public.content_summaries.transcript_lang IS '전사문 언어 코드 (ko/en 등).';
COMMENT ON COLUMN public.content_summaries.transcript_chars IS '전사문 글자 수 (저장 후 통계용).';