create or replace view public.course_curriculum_public
with (security_invoker = false) as
select
  cc.id,
  cc.course_id,
  cc.title,
  cc.description,
  cc.order_index,
  cc.duration_minutes,
  cc.content_type,
  cc.is_preview
from public.course_contents cc
join public.courses c on c.id = cc.course_id
where cc.is_published = true
  and c.status = 'published'
  and c.visibility = 'shown';

grant select on public.course_curriculum_public to anon, authenticated;
grant all on public.course_curriculum_public to service_role;