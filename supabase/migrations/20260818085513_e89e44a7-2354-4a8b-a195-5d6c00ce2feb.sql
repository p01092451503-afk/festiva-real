-- Deactivate any existing header menu items, then seed the festcert GNB (4 items)
UPDATE public.nav_items SET is_active = false WHERE position = 'header';

INSERT INTO public.nav_items (label, label_en, url, position, sort_order, is_active, open_in_new_tab)
VALUES
  ('교육원 소개',        'About',        '/about',                'header', 1, true, false),
  ('강의 안내',          'Courses',      '/store/courses',        'header', 2, true, false),
  ('학습운영·문의',      'My Learning',  '/dashboard',            'header', 3, true, false),
  ('자격증 신청 및 발급', 'Certificates', '/student/certificates', 'header', 4, true, false);