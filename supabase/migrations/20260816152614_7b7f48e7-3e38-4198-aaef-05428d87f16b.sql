create or replace function public.open_alert_count(_course_id uuid default null, _product_id uuid default null)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.product_open_alerts
  where (_course_id is null or course_id = _course_id)
    and (_product_id is null or product_id = _product_id)
    and (_course_id is not null or _product_id is not null)
$$;
grant execute on function public.open_alert_count(uuid, uuid) to authenticated, anon;