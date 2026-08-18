grant select on public.categories to anon;
create policy "Public can view active categories"
on public.categories
for select
to anon
using (is_active = true);