DELETE FROM categories WHERE is_active = false;
UPDATE categories SET display_order = 1 WHERE slug = 'toeic';
UPDATE categories SET display_order = 2 WHERE slug = 'toeic-speaking';
UPDATE categories SET display_order = 3 WHERE slug = 'medical-english';