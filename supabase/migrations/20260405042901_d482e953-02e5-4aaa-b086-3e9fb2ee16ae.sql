
-- Marketing: 디지털 마케팅 전략 마스터
UPDATE public.courses SET thumbnail_url = 'https://hugyfvlbdrxcxnaarnsm.supabase.co/storage/v1/object/public/course-thumbnails/generated/marketing-digital.jpg' WHERE id = 'a0000001-0001-0001-0001-000000000001';

-- Sales: 리테일 영업 전략
UPDATE public.courses SET thumbnail_url = 'https://hugyfvlbdrxcxnaarnsm.supabase.co/storage/v1/object/public/course-thumbnails/generated/sales-retail.jpg' WHERE id = 'f7883b08-f003-4a90-8266-cae3251cfe80';

-- Sales: 뷰티 세일즈 실전 클래스
UPDATE public.courses SET thumbnail_url = 'https://hugyfvlbdrxcxnaarnsm.supabase.co/storage/v1/object/public/course-thumbnails/generated/sales-beauty.jpg' WHERE id = 'a0000001-0001-0001-0001-000000000002';

-- Product Development: 스킨케어 제형 개발
UPDATE public.courses SET thumbnail_url = 'https://hugyfvlbdrxcxnaarnsm.supabase.co/storage/v1/object/public/course-thumbnails/generated/product-skincare.jpg' WHERE id = '4c6775bc-b8da-4f91-9bf4-dda699c23d3a';

-- Product Development: 화장품 원료학 기초
UPDATE public.courses SET thumbnail_url = 'https://hugyfvlbdrxcxnaarnsm.supabase.co/storage/v1/object/public/course-thumbnails/generated/product-ingredients.jpg' WHERE id = 'a0000001-0001-0001-0001-000000000003';

-- Skin Science: 피부 과학 입문
UPDATE public.courses SET thumbnail_url = 'https://hugyfvlbdrxcxnaarnsm.supabase.co/storage/v1/object/public/course-thumbnails/generated/skin-science-intro.jpg' WHERE id = 'a0000001-0001-0001-0001-000000000005';

-- Skin Science: 피부 장벽과 보습 메커니즘
UPDATE public.courses SET thumbnail_url = 'https://hugyfvlbdrxcxnaarnsm.supabase.co/storage/v1/object/public/course-thumbnails/generated/skin-barrier.jpg' WHERE id = 'ce14dcab-3f8d-4fce-ab45-b169b144f080';

-- All other courses: common icon
UPDATE public.courses SET thumbnail_url = 'https://hugyfvlbdrxcxnaarnsm.supabase.co/storage/v1/object/public/course-thumbnails/generated/common-course-icon.png' WHERE thumbnail_url IS NULL;
