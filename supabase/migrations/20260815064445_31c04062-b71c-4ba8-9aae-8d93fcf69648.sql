ALTER TABLE public.course_extensions ADD CONSTRAINT course_extensions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
ALTER TABLE public.course_suspensions ADD CONSTRAINT course_suspensions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
ALTER TABLE public.member_group_members ADD CONSTRAINT member_group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
ALTER TABLE public.refund_requests ADD CONSTRAINT refund_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
ALTER TABLE public.survey_responses ADD CONSTRAINT survey_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
ALTER TABLE public.course_invitations ADD CONSTRAINT course_invitations_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;