
update public.courses
set price = 195000, vat_exempt = true, tags = array['9차시/9강','9주 과정','교재 포함']
where title in ('축제운영전문가 2급','축제운영전문가 1급');

create table if not exists public.support_faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.support_faqs to anon;
grant select, insert, update, delete on public.support_faqs to authenticated;
grant all on public.support_faqs to service_role;
alter table public.support_faqs enable row level security;
create policy "Anyone can view published faqs" on public.support_faqs for select using (is_published or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin'));
create policy "Admins manage faqs" on public.support_faqs for all to authenticated using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin'));

create table if not exists public.support_inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inquiry_type text not null default 'etc' check (inquiry_type in ('course','payment','tech','etc')),
  title text not null,
  content text not null,
  status text not null default 'pending' check (status in ('pending','answered','closed')),
  answer text,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.support_inquiries to authenticated;
grant all on public.support_inquiries to service_role;
alter table public.support_inquiries enable row level security;
create policy "Users view own inquiries" on public.support_inquiries for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin'));
create policy "Users create own inquiries" on public.support_inquiries for insert to authenticated with check (user_id = auth.uid());
create policy "Admins manage inquiries" on public.support_inquiries for update to authenticated using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin'));
create policy "Admins delete inquiries" on public.support_inquiries for delete to authenticated using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin'));

create table if not exists public.support_reviews (
  id uuid primary key default gen_random_uuid(),
  author_label text not null,
  course_label text not null,
  rating integer not null default 5 check (rating between 1 and 5),
  content text not null,
  is_published boolean not null default true,
  published_at date not null default current_date,
  created_at timestamptz not null default now()
);
grant select on public.support_reviews to anon;
grant select, insert, update, delete on public.support_reviews to authenticated;
grant all on public.support_reviews to service_role;
alter table public.support_reviews enable row level security;
create policy "Anyone can view published reviews" on public.support_reviews for select using (is_published or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin'));
create policy "Admins manage reviews" on public.support_reviews for all to authenticated using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin'));

grant select on public.announcements to anon;
create policy "Anon can view published announcements" on public.announcements for select to anon using (is_published = true);

insert into public.support_faqs (question, answer, sort_order) values
('영상을 빠르게 돌려봐도 출석으로 인정되나요?','네, 인정됩니다. 배속 재생(0.5배~2.0배)과 구간 반복 모두 허용되며, 영상 종료 지점까지 재생 완료 시 자동으로 출석 처리됩니다.',1),
('테스트에 몇 번이나 응시할 수 있나요?','횟수 제한이 없습니다. 60점 이상 합격할 때까지 즉시 재응시가 가능합니다.',2),
('수강 기간 안에 완료하지 못하면 어떻게 되나요?','수강 기간은 9주입니다. 9주 이내에 강의·시험 6주치 이상을 완료해야 수료 처리됩니다.',3),
('환불은 어떻게 신청하나요?','결제 후 7일 이내, 진도율 0%이면 전액 환불됩니다. 진도율 50% 미만이면 50% 환불됩니다.',4);

insert into public.support_reviews (author_label, course_label, rating, content, published_at) values
('홍○○','2급 수료',5,'갑자기 지자체 축제 담당자가 됐는데, 기획서 하나 없이 막막했어요. 2급 수료하고 나서 기획서·운영계획서가 생기니까 팀장님께 바로 보고할 수 있었습니다. 강추!','2026-09-15'),
('이○○','1급 수료',4,'문화재단에서 10년 일했는데 체계적으로 정리된 적이 없었습니다. 1급까지 수료하고 나서 성과지표 설계를 실무에 바로 적용할 수 있었어요.','2026-09-08');

insert into public.announcements (title, content, category, is_pinned, is_published, author_id)
select '상시 등록 안내','안녕하세요, 크리에이티브쉐이크 부설 평생교육원입니다.

축제운영전문가 2급·1급 온라인 자격증 과정은 별도의 개강일 없이 상시 등록제로 운영됩니다. 신청과 결제만 완료하시면 바로 학습을 시작하실 수 있습니다.

[학습 일정]
· 신청 접수: 연중 상시 접수
· 학습 시작: 결제 완료 익일부터 즉시 시작
· 수강 기간: 학습 시작일로부터 9주
· 수료 기준: 9주 이내 강의·시험 6주치 이상 완료 + 시험 60점 이상

[수강료]
· 2급 또는 1급 단독: 195,000원 (강의 150,000 + 교재·문제집 45,000)
· 2급·1급 동시 신청 시 별도 안내 예정
· 신청은 홈페이지 수강신청 메뉴에서 언제든 가능합니다.
· 결제 완료 익일부터 강의가 순차 오픈됩니다.
· 문의: 1:1 문의게시판 또는 이메일','general',true,true,u.id
from auth.users u order by u.created_at limit 1;

insert into public.announcements (title, content, category, is_pinned, is_published, author_id)
select '상시 등록 운영 방식 안내','축제운영전문가 과정은 상시 등록제로 운영됩니다. 별도의 개강일 없이, 수강생 개개인이 결제를 완료한 시점을 기준으로 학습이 시작됩니다.

[상시 등록 운영 구조]
① 신청 및 학습 시작 — 연중 상시 신청 접수 / 결제 완료 익일부터 즉시 학습 시작(개강일 대기 없음)
② 주차별 강의 오픈 방식 — 학습 시작일을 기준으로 매주 해당 주차 강의 오픈 → 7일 이내 강의(25분) + 시험(15분) 완료 필수. 미완료 시 해당 주차 미이수 처리(재이수 불가)
③ 수료 기준 — 9주 이내에 강의·시험 6주치 이상 완료 + 각 시험 60점 이상 합격, 두 조건 모두 충족 시 즉시 수료 처리
④ 미수료 시 재수강 — 9주 내 수료 조건 미달성 시 수료 불가. 재수강은 신규 신청·결제 후 가능(언제든 재신청 가능)

[학사 알림 발송 일정 (수강생 개인별 기준)]
· 등록(결제완료)일 — 학습 시작 안내(카카오 알림톡)
· 등록일 기준 매주 — 주차 오픈 알림
· 주차 마감 임박(종료 3일 전) — 미수강 시 독려 알림
· 수료 확정 시 — 자격증 발급 안내

추가 문의는 1:1 문의게시판을 이용해 주세요. 평일 기준 24시간 이내 답변드립니다.','general',false,true,u.id
from auth.users u order by u.created_at limit 1;
