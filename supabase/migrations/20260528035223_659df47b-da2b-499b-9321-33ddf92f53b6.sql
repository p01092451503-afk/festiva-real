
CREATE OR REPLACE FUNCTION public.check_and_award_badges(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  badge_record RECORD;
  user_value INT;
BEGIN
  FOR badge_record IN
    SELECT * FROM public.badges WHERE id NOT IN (SELECT badge_id FROM public.user_badges WHERE user_id = p_user_id)
  LOOP
    user_value := 0;
    CASE badge_record.requirement_type
      WHEN 'points' THEN SELECT total_points INTO user_value FROM public.user_gamification WHERE user_id = p_user_id;
      WHEN 'streak' THEN SELECT streak_days INTO user_value FROM public.user_gamification WHERE user_id = p_user_id;
      WHEN 'courses_completed' THEN SELECT COUNT(*) INTO user_value FROM public.enrollments WHERE user_id = p_user_id AND completed_at IS NOT NULL;
      WHEN 'lessons_completed' THEN SELECT COUNT(*) INTO user_value FROM public.content_progress WHERE user_id = p_user_id AND completed = true;
      WHEN 'assignments_completed' THEN SELECT COUNT(*) INTO user_value FROM public.assignment_submissions WHERE student_id = p_user_id AND status = 'graded';
      WHEN 'community_posts' THEN SELECT COUNT(*) INTO user_value FROM public.community_posts WHERE author_id = p_user_id AND is_hidden = false;
      WHEN 'community_comments' THEN SELECT COUNT(*) INTO user_value FROM public.community_comments WHERE author_id = p_user_id;
      WHEN 'community_likes_received' THEN
        SELECT COUNT(*) INTO user_value
        FROM public.community_likes l
        JOIN public.community_posts p ON p.id = l.post_id
        WHERE p.author_id = p_user_id;
      ELSE user_value := 0;
    END CASE;
    IF user_value >= badge_record.requirement_value THEN
      INSERT INTO public.user_badges (user_id, badge_id) VALUES (p_user_id, badge_record.id) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$function$;
