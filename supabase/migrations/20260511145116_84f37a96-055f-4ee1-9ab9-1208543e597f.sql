-- Replace existing categories with English-learning categories and assign new sample courses

-- Insert new categories (idempotent via slug unique)
INSERT INTO public.categories (name, name_en, slug, description, description_en, display_order, is_active)
VALUES
  ('TOEIC', 'TOEIC', 'toeic', 'TOEIC RC/LC 학습', 'TOEIC RC/LC preparation', 1, true),
  ('메디컬 영어', 'Medical English', 'medical-english', '병원·의료 현장 영어', 'Hospital and medical English', 2, true),
  ('토익스피킹', 'TOEIC Speaking', 'toeic-speaking', '토익스피킹 파트별 학습', 'TOEIC Speaking by parts', 3, true)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    name_en = EXCLUDED.name_en,
    description = EXCLUDED.description,
    description_en = EXCLUDED.description_en,
    display_order = EXCLUDED.display_order,
    is_active = true;

-- Assign sample courses to new categories
UPDATE public.courses SET category_id = (SELECT id FROM public.categories WHERE slug = 'toeic')
WHERE title ILIKE 'TOEIC %' AND title NOT ILIKE '토익스피킹%';

UPDATE public.courses SET category_id = (SELECT id FROM public.categories WHERE slug = 'medical-english')
WHERE title ILIKE '메디컬 영어%';

UPDATE public.courses SET category_id = (SELECT id FROM public.categories WHERE slug = 'toeic-speaking')
WHERE title ILIKE '토익스피킹%';

-- Deactivate (and unlink) the legacy categories that no longer match the curriculum
UPDATE public.categories
SET is_active = false
WHERE slug IN ('product-training','clinical-procedure','skin-science','sales-marketing','compliance','customer-service','safety-hygiene','onboarding');
