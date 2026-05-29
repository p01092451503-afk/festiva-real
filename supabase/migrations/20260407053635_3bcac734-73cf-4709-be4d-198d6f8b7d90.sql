
CREATE OR REPLACE FUNCTION public.submit_and_grade_assessment(
  p_attempt_id uuid,
  p_answers jsonb -- array of {question_id, user_answer}
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt RECORD;
  v_question RECORD;
  v_answer RECORD;
  v_total_points numeric := 0;
  v_total_score numeric := 0;
  v_assessment RECORD;
  v_passed boolean;
  v_result jsonb;
BEGIN
  -- Verify the attempt belongs to the calling user and is not yet completed
  SELECT * INTO v_attempt FROM assessment_attempts WHERE id = p_attempt_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt not found or not owned by user';
  END IF;
  IF v_attempt.completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Attempt already completed';
  END IF;

  -- Get assessment for passing score
  SELECT * INTO v_assessment FROM assessments WHERE id = v_attempt.assessment_id;

  -- Process each answer
  FOR v_answer IN SELECT * FROM jsonb_array_elements(p_answers) AS a
  LOOP
    SELECT * INTO v_question FROM assessment_questions
    WHERE id = (v_answer.value->>'question_id')::uuid
      AND assessment_id = v_attempt.assessment_id;

    IF FOUND THEN
      DECLARE
        v_user_answer text := v_answer.value->>'user_answer';
        v_is_correct boolean := false;
        v_points_earned numeric := 0;
      BEGIN
        v_total_points := v_total_points + v_question.points;

        IF v_question.question_type = 'essay' THEN
          v_is_correct := false;
          v_points_earned := 0;
        ELSIF v_user_answer IS NOT NULL AND v_user_answer != '' THEN
          v_is_correct := lower(trim(v_user_answer)) = lower(trim(v_question.correct_answer));
          IF v_is_correct THEN
            v_points_earned := v_question.points;
          END IF;
        END IF;

        v_total_score := v_total_score + v_points_earned;

        INSERT INTO assessment_answers (attempt_id, question_id, user_answer, is_correct, points_earned)
        VALUES (p_attempt_id, v_question.id, v_user_answer, v_is_correct, v_points_earned);
      END;
    END IF;
  END LOOP;

  -- Calculate final score percentage
  DECLARE
    v_score_pct numeric := 0;
  BEGIN
    IF v_total_points > 0 THEN
      v_score_pct := round((v_total_score / v_total_points) * 100);
    END IF;
    v_passed := v_score_pct >= v_assessment.passing_score;

    -- Update the attempt
    UPDATE assessment_attempts
    SET score = v_score_pct,
        total_points = v_total_points,
        passed = v_passed,
        completed_at = now()
    WHERE id = p_attempt_id;

    v_result := jsonb_build_object(
      'score', v_score_pct,
      'total_points', v_total_points,
      'earned_points', v_total_score,
      'passed', v_passed
    );
  END;

  RETURN v_result;
END;
$$;
