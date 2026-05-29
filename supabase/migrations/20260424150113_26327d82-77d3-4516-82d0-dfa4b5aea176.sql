-- 1) 수료 조건 충족 시 이수증 자동 발급 함수
CREATE OR REPLACE FUNCTION public.auto_issue_certificate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min_progress numeric := 80;
  v_min_score numeric := NULL;
  v_cert_enabled boolean := true;
  v_user_best_score numeric;
  v_cert_number text;
BEGIN
  -- 진도율 100% 미만이면 종료
  IF NEW.progress IS NULL OR NEW.progress < 80 THEN
    RETURN NEW;
  END IF;

  -- 이미 발급된 이수증이 있으면 종료
  IF EXISTS (
    SELECT 1 FROM public.certificates
    WHERE user_id = NEW.user_id AND course_id = NEW.course_id
  ) THEN
    RETURN NEW;
  END IF;

  -- 강좌별 수료 조건 조회 (없으면 기본 80% / 자동발급 ON)
  SELECT
    COALESCE(min_progress_pct, 80),
    min_assessment_score,
    COALESCE(certificate_enabled, true)
  INTO v_min_progress, v_min_score, v_cert_enabled
  FROM public.completion_criteria
  WHERE course_id = NEW.course_id;

  -- 자동발급 비활성화면 종료
  IF v_cert_enabled IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  -- 진도율 미충족 종료
  IF NEW.progress < v_min_progress THEN
    RETURN NEW;
  END IF;

  -- 평가 점수 조건 확인
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

  -- 발급
  v_cert_number := 'CERT-' || to_char(now(), 'YYYYMMDD') || '-' ||
                   upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.certificates (user_id, course_id, certificate_number, issued_at)
  VALUES (NEW.user_id, NEW.course_id, v_cert_number, now())
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2) enrollments INSERT/UPDATE 트리거
DROP TRIGGER IF EXISTS trg_auto_issue_certificate ON public.enrollments;
CREATE TRIGGER trg_auto_issue_certificate
AFTER INSERT OR UPDATE OF progress, completed_at
ON public.enrollments
FOR EACH ROW
EXECUTE FUNCTION public.auto_issue_certificate();

-- 3) 기존에 이미 수료한 학습자에 대한 백필 (조건 충족 + 미발급 건)
INSERT INTO public.certificates (user_id, course_id, certificate_number, issued_at)
SELECT
  e.user_id,
  e.course_id,
  'CERT-' || to_char(now(), 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  COALESCE(e.completed_at, now())
FROM public.enrollments e
LEFT JOIN public.completion_criteria cc ON cc.course_id = e.course_id
WHERE e.progress >= COALESCE(cc.min_progress_pct, 80)
  AND COALESCE(cc.certificate_enabled, true) = true
  AND (
    cc.min_assessment_score IS NULL
    OR EXISTS (
      SELECT 1 FROM public.assessment_attempts att
      JOIN public.assessments a ON a.id = att.assessment_id
      WHERE att.user_id = e.user_id
        AND a.course_id = e.course_id
        AND att.completed_at IS NOT NULL
        AND COALESCE(att.score, 0) >= cc.min_assessment_score
    )
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.certificates c
    WHERE c.user_id = e.user_id AND c.course_id = e.course_id
  );