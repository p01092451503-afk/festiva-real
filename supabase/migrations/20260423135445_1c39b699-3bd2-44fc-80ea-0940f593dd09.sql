-- Remove enrollment & related progress data for archived (hidden) courses
-- so they no longer appear in the learning progress dashboard.

-- 1) Delete content progress rows tied to archived courses' contents
DELETE FROM public.content_progress cp
USING public.course_contents cc, public.courses c
WHERE cp.content_id = cc.id
  AND cc.course_id = c.id
  AND c.status = 'archived';

-- 2) Delete assessment answers/attempts tied to archived courses
DELETE FROM public.assessment_answers aa
USING public.assessment_attempts att, public.assessments a, public.courses c
WHERE aa.attempt_id = att.id
  AND att.assessment_id = a.id
  AND a.course_id = c.id
  AND c.status = 'archived';

DELETE FROM public.assessment_attempts att
USING public.assessments a, public.courses c
WHERE att.assessment_id = a.id
  AND a.course_id = c.id
  AND c.status = 'archived';

-- 3) Delete attendance rows for archived courses
DELETE FROM public.attendance att
USING public.courses c
WHERE att.course_id = c.id
  AND c.status = 'archived';

-- 4) Delete certificates issued for archived courses
DELETE FROM public.certificates cert
USING public.courses c
WHERE cert.course_id = c.id
  AND c.status = 'archived';

-- 5) Finally, delete enrollments for archived courses
DELETE FROM public.enrollments e
USING public.courses c
WHERE e.course_id = c.id
  AND c.status = 'archived';

-- 6) Reset enrolled_count cached field on archived courses
UPDATE public.courses
SET enrolled_count = 0
WHERE status = 'archived';