
-- 댓글 숨김 컬럼 (모더레이션용)
ALTER TABLE public.community_comments ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;

-- 배지 수여 헬퍼 함수
CREATE OR REPLACE FUNCTION public.award_community_badge(_user_id UUID, _badge_code TEXT)
RETURNS VOID AS $$
DECLARE
  _badge_id UUID;
  _badge_name TEXT;
  _inserted BOOLEAN := false;
BEGIN
  SELECT id, name INTO _badge_id, _badge_name
  FROM public.community_badges WHERE code = _badge_code AND is_active = true;
  IF _badge_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.community_user_badges (user_id, badge_id)
  VALUES (_user_id, _badge_id)
  ON CONFLICT (user_id, badge_id) DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;

  IF _inserted THEN
    INSERT INTO public.notifications (user_id, title, message, type, action_url)
    VALUES (_user_id, '새 배지 획득', '"' || _badge_name || '" 배지를 획득했습니다.', 'info', '/community/members/' || _user_id::text);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 게시글 작성 후: 첫 게시글 / 10건 작성자 배지
CREATE OR REPLACE FUNCTION public.community_post_badge_check()
RETURNS TRIGGER AS $$
DECLARE
  _count INTEGER;
BEGIN
  SELECT COUNT(*) INTO _count FROM public.community_posts WHERE author_id = NEW.author_id;
  IF _count = 1 THEN PERFORM public.award_community_badge(NEW.author_id, 'first_post'); END IF;
  IF _count >= 10 THEN PERFORM public.award_community_badge(NEW.author_id, 'writer_10'); END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_community_post_badge ON public.community_posts;
CREATE TRIGGER trg_community_post_badge
AFTER INSERT ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.community_post_badge_check();

-- 팔로우 후: 인플루언서 10 + 새 팔로워 알림
CREATE OR REPLACE FUNCTION public.community_follow_handler()
RETURNS TRIGGER AS $$
DECLARE
  _follower_count INTEGER;
  _follower_name TEXT;
BEGIN
  SELECT COUNT(*) INTO _follower_count FROM public.community_follows WHERE following_id = NEW.following_id;
  IF _follower_count >= 10 THEN PERFORM public.award_community_badge(NEW.following_id, 'influencer_10'); END IF;

  SELECT full_name INTO _follower_name FROM public.profiles WHERE user_id = NEW.follower_id;
  INSERT INTO public.notifications (user_id, title, message, type, action_url)
  VALUES (NEW.following_id, '새 팔로워', COALESCE(_follower_name, '회원') || '님이 팔로우했습니다.', 'info', '/community/members/' || NEW.follower_id::text);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_community_follow ON public.community_follows;
CREATE TRIGGER trg_community_follow
AFTER INSERT ON public.community_follows
FOR EACH ROW EXECUTE FUNCTION public.community_follow_handler();

-- 댓글 등록 시: 게시글 작성자에게 알림
CREATE OR REPLACE FUNCTION public.community_comment_notify()
RETURNS TRIGGER AS $$
DECLARE
  _post_author UUID;
  _post_title TEXT;
  _commenter_name TEXT;
BEGIN
  SELECT author_id, title INTO _post_author, _post_title FROM public.community_posts WHERE id = NEW.post_id;
  IF _post_author IS NULL OR _post_author = NEW.author_id THEN RETURN NEW; END IF;
  SELECT full_name INTO _commenter_name FROM public.profiles WHERE user_id = NEW.author_id;
  INSERT INTO public.notifications (user_id, title, message, type, action_url)
  VALUES (_post_author, '새 댓글', COALESCE(_commenter_name, '회원') || '님이 "' || LEFT(_post_title, 40) || '"에 댓글을 남겼습니다.', 'info', '/community/posts/' || NEW.post_id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_community_comment_notify ON public.community_comments;
CREATE TRIGGER trg_community_comment_notify
AFTER INSERT ON public.community_comments
FOR EACH ROW EXECUTE FUNCTION public.community_comment_notify();

-- Q&A 답변 채택 시: 답변자 도움왕 배지 + 알림
CREATE OR REPLACE FUNCTION public.community_qna_accept_reward()
RETURNS TRIGGER AS $$
DECLARE
  _post_title TEXT;
BEGIN
  IF NEW.is_accepted = true AND (OLD.is_accepted IS DISTINCT FROM NEW.is_accepted) THEN
    PERFORM public.award_community_badge(NEW.author_id, 'helpful');
    SELECT title INTO _post_title FROM public.community_posts WHERE id = NEW.post_id;
    INSERT INTO public.notifications (user_id, title, message, type, action_url)
    VALUES (NEW.author_id, '답변 채택', '"' || COALESCE(LEFT(_post_title, 40), '질문') || '"의 답변으로 채택되었습니다.', 'completion', '/community/posts/' || NEW.post_id::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_community_qna_accept_reward ON public.community_qna_answers;
CREATE TRIGGER trg_community_qna_accept_reward
AFTER UPDATE ON public.community_qna_answers
FOR EACH ROW EXECUTE FUNCTION public.community_qna_accept_reward();
