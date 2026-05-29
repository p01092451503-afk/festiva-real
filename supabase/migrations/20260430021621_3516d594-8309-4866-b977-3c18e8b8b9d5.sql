
REVOKE EXECUTE ON FUNCTION public.search_articles(text, uuid, text, integer, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.recommend_articles(uuid, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.publish_scheduled_articles() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.increment_article_view(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.articles_before_write() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.search_articles(text, uuid, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recommend_articles(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_article_view(uuid) TO authenticated;
-- publish_scheduled_articles 는 cron / service_role 만 호출
GRANT EXECUTE ON FUNCTION public.publish_scheduled_articles() TO service_role;
