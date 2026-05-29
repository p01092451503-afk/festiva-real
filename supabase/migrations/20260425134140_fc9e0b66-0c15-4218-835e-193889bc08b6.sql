-- 1) 자동 발급 트리거 함수 수정: SELECT INTO가 행 없음일 때 기본값 유지
CREATE OR REPLACE FUNCTION public.auto_issue_certificate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_min_progress numeric := 80;
  v_min_score numeric := NULL;
  v_cert_enabled boolean := true;
  v_user_best_score numeric;
  v_cert_number text;
  v_found boolean := false;
BEGIN
  IF NEW.progress IS NULL OR NEW.progress < 80 THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.certificates
    WHERE user_id = NEW.user_id AND course_id = NEW.course_id
  ) THEN
    RETURN NEW;
  END IF;

  -- completion_criteria 행이 있을 때만 값을 덮어쓴다 (없으면 기본값 유지)
  SELECT
    COALESCE(min_progress_pct, 80),
    min_assessment_score,
    COALESCE(certificate_enabled, true),
    true
  INTO v_min_progress, v_min_score, v_cert_enabled, v_found
  FROM public.completion_criteria
  WHERE course_id = NEW.course_id;

  IF v_found AND v_cert_enabled IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  IF NEW.progress < v_min_progress THEN
    RETURN NEW;
  END IF;

  IF v_min_score IS NOT NULL THEN
    SELECT MAX(score) INTO v_user_best_score
    FROM public.assessment_attempts att
    JOIN public.assessments a ON a.id = att.assessment_id
    WHERE att.user_id = NEW.user_id
      AND a.course_id = NEW.course_id
      AND att.completed_at IS NOT NULL;

    IF v_user_best_score IS NULL OR v_user_best_score < v_min_score THEN
      RETURN NEW;
    END IF;
  END IF;

  v_cert_number := 'CERT-' || to_char(now(), 'YYYYMMDD') || '-' ||
                   upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.certificates (user_id, course_id, certificate_number, issued_at)
  VALUES (NEW.user_id, NEW.course_id, v_cert_number, now())
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 2) 누락된 이수증 백필: 100% 완료했지만 이수증 미발급 학습자에게 자동 발급
INSERT INTO public.certificates (user_id, course_id, certificate_number, issued_at)
SELECT
  e.user_id,
  e.course_id,
  'CERT-' || to_char(now(), 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  now()
FROM public.enrollments e
LEFT JOIN public.completion_criteria cc ON cc.course_id = e.course_id
WHERE e.progress >= COALESCE(cc.min_progress_pct, 80)
  AND COALESCE(cc.certificate_enabled, true) = true
  AND NOT EXISTS (
    SELECT 1 FROM public.certificates c
    WHERE c.user_id = e.user_id AND c.course_id = e.course_id
  )
  AND (
    cc.min_assessment_score IS NULL
    OR EXISTS (
      SELECT 1 FROM public.assessment_attempts att
      JOIN public.assessments a ON a.id = att.assessment_id
      WHERE att.user_id = e.user_id
        AND a.course_id = e.course_id
        AND att.completed_at IS NOT NULL
        AND att.score >= cc.min_assessment_score
    )
  );