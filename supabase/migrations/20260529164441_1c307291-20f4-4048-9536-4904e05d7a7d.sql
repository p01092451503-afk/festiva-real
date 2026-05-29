
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS instructor_bio text,
  ADD COLUMN IF NOT EXISTS textbook_title text,
  ADD COLUMN IF NOT EXISTS textbook_author text,
  ADD COLUMN IF NOT EXISTS textbook_publisher text,
  ADD COLUMN IF NOT EXISTS textbook_isbn text,
  ADD COLUMN IF NOT EXISTS textbook_price integer,
  ADD COLUMN IF NOT EXISTS textbook_image_url text,
  ADD COLUMN IF NOT EXISTS textbook_description text,
  ADD COLUMN IF NOT EXISTS textbook_purchase_url text;
