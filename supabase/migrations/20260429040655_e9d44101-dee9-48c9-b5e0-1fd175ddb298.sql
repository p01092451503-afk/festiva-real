
REVOKE EXECUTE ON FUNCTION public.get_assessment_pool_questions_for_student(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_assessment_pool_questions_with_answers(uuid, uuid[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_assessment_pool_questions_for_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_assessment_pool_questions_with_answers(uuid, uuid[]) TO authenticated;
