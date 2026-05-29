-- Clear track_steps.description_en where the value was incorrectly set
-- to the Korean track name (not a real English translation).
UPDATE public.track_steps
SET description_en = NULL
WHERE description_en IS NOT NULL
  AND TRIM(description_en) ~ '[가-힣]';