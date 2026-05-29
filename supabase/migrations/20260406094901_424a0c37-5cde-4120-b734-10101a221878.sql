
CREATE OR REPLACE FUNCTION public.trigger_award_points_on_assessment()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.completed_at IS NOT NULL AND (OLD.completed_at IS NULL) THEN
    IF NEW.passed = true THEN
      PERFORM public.award_points(NEW.user_id, 30, 'assessment_passed', '평가 합격');
    ELSE
      PERFORM public.award_points(NEW.user_id, 10, 'assessment_completed', '평가 응시');
    END IF;
    PERFORM public.update_streak(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_assessment_attempt_complete
  AFTER UPDATE ON public.assessment_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_award_points_on_assessment();
