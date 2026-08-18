-- 급수 카테고리
insert into public.categories (name, name_en, slug, description, display_order, is_active)
values
  ('2급', 'Level 2', 'level-2', '축제운영전문가 2급 · 기초 과정', 1, true),
  ('1급', 'Level 1', 'level-1', '축제운영전문가 1급 · 심화 과정', 2, true)
on conflict do nothing;

-- 2급 강의
with cat as (select id from public.categories where slug='level-2')
insert into public.courses (
  title, subtitle, description, category_id, base_category, difficulty_level,
  price, textbook_price, textbook_title, textbook_description,
  estimated_duration_hours, status, use_status, visibility, is_b2c, is_sequential,
  seo_title, seo_description, keywords, tags,
  short_intro_html, detail_intro_html
)
select
  '축제운영전문가 2급',
  '아이디어를 현실로 만드는 축제 실무의 모든 것 — 축제 기획·운영 실무 전문가',
  '개강일 매월 1일 · 총 시수 27시간(9강) · 수강 기간 9주 · 수료 조건: 6주 이상 이수 + 시험 60점 · 수료 후 PDF + 실물 수료증 발급',
  cat.id, '2급', 'beginner',
  150000, 45000,
  '[교재] 축제 기획·운영 실무 전문가 (2급)',
  '"기획부터 현장 운영까지, 축제의 기본기를 마스터하다!" 지자체·공공기관 축제 담당자, 문화재단 실무자, 그리고 축제 기획자를 꿈꾸는 입문자를 위한 대한민국 No.1 축제 실무 지침서.',
  27, 'published', 'active', 'shown', true, true,
  '축제운영전문가 2급 | festcert',
  '축제 기획·홍보·운영 실무를 9강으로 배우는 온라인 자격증 과정. 27시간, 9주, 교재 포함 195,000원.',
  array['축제운영전문가','2급','축제기획','축제운영'],
  array['9차시','9주','교재 포함'],
  '<p>아이디어를 현실로 만드는 축제 실무의 모든 것</p>',
  '<ul><li>6주 이상 이수 필수</li><li>시험 60점 이상 합격</li><li>수강 기간 9주</li><li>수료 후 PDF + 실물 수료증</li></ul>'
from cat
where not exists (select 1 from public.courses where title='축제운영전문가 2급');

-- 1급 강의
with cat as (select id from public.categories where slug='level-1')
insert into public.courses (
  title, subtitle, description, category_id, base_category, difficulty_level,
  price, textbook_price, textbook_title, textbook_description,
  estimated_duration_hours, status, use_status, visibility, is_b2c, is_sequential,
  seo_title, seo_description, keywords, tags,
  short_intro_html, detail_intro_html
)
select
  '축제운영전문가 1급',
  '메가 트렌드를 리드하는 축제 운영의 모든 것 — 축제 운영·평가·관리 전문가',
  '개강일 매월 1일 · 총 시수 27시간(9강) · 수강 기간 9주 · 수료 조건: 6주 이상 이수 + 시험 60점 + 경력증명서 · 권장 선수: 2급 수료 또는 경력 1년 이상',
  cat.id, '1급', 'advanced',
  150000, 45000,
  '[교재] 축제 운영·평가·관리 전문가 (1급)',
  '축제 운영·평가·관리 실무를 심화 학습하는 1급 과정 교재와 적중 예상문제집으로 구성됩니다.',
  27, 'published', 'active', 'shown', true, true,
  '축제운영전문가 1급 | festcert',
  '축제 실전 기획·통합 마케팅·운영 평가를 다루는 심화 자격증 과정. 27시간, 9주, 경력증명서 제출 필수.',
  array['축제운영전문가','1급','축제운영','축제평가'],
  array['9차시','9주','교재 포함'],
  '<p>메가 트렌드를 리드하는 축제 운영의 모든 것</p>',
  '<div><strong>1급 수강 전 필수 확인</strong><ul><li>자격 미달 시 1급 자격증이 취소됩니다</li><li>1급 지원 시 경력증명서를 반드시 제출해야 합니다</li><li>수강 자격: 관련 분야 현장 경력 3년 이상</li></ul></div><ul><li>6주 이상 이수 필수</li><li>시험 60점 이상 합격</li><li>경력증명서 제출</li><li>수료 후 PDF + 실물 수료증</li></ul>'
from cat
where not exists (select 1 from public.courses where title='축제운영전문가 1급');

-- 2급 커리큘럼 9차시
with c as (select id from public.courses where title='축제운영전문가 2급')
insert into public.course_contents (course_id, title, description, order_index, duration_minutes, content_type, is_published, is_preview)
select c.id, v.title, v.description, v.idx, 45, 'video'::content_type, true, v.idx = 1
from c, (values
  (1,'[과목 1 · 축제 콘셉트 기획] 1강. 지역자원·타깃 분석 기반 콘셉트 도출','로컬 리소스 발굴, 빅데이터 기반 타깃 세그멘테이션, 킬러 콘텐츠 설계'),
  (2,'[과목 1 · 축제 콘셉트 기획] 2강. 프로그램·예산·공간 기초 설계','적정 예산 산정, 공간 배치 기초, 일정 로드맵 수립'),
  (3,'[과목 1 · 축제 콘셉트 기획] 3강. 기본 기획서 작성 실습','표준 문서 체계, 축제 정체성 확립과 네이밍 전략, 기획서 구조화 (산출물: 기본 기획서)'),
  (4,'[과목 2 · 축제 홍보 및 마케팅] 4강. 홍보 목표·KPI 설정 및 채널 전략','축제 브랜딩, 홍보 KPI 정의, SNS 플랫폼별 콘텐츠 전략'),
  (5,'[과목 2 · 축제 홍보 및 마케팅] 5강. 콘텐츠 캘린더 수립','사전·현장·사후 홍보 일정표, 게시물 유형 및 제작 일정 관리'),
  (6,'[과목 2 · 축제 홍보 및 마케팅] 6강. 홍보 실행계획서 작성 실습','실제 제출 가능한 홍보 실행계획서 완성, 예산 배분 및 일정 매핑 (산출물: 홍보 실행계획서)'),
  (7,'[과목 3 · 축제 운영 및 관리] 7강. 운영조직·역할분장 및 현장 체크리스트','파트별 역할 정의, 현장 운영 표준 체크리스트 작성'),
  (8,'[과목 3 · 축제 운영 및 관리] 8강. 안전관리 기초 및 동선·혼잡 관리','안전 매뉴얼 기초, 관람객 동선 설계, 혼잡 시나리오 대응'),
  (9,'[과목 3 · 축제 운영 및 관리] 9강. 운영계획서 작성 실습','운영계획서와 현장 체크리스트 완성 (산출물: 운영계획서+체크리스트)')
) as v(idx, title, description)
where not exists (select 1 from public.course_contents cc where cc.course_id = c.id);

-- 1급 커리큘럼 9차시
with c as (select id from public.courses where title='축제운영전문가 1급')
insert into public.course_contents (course_id, title, description, order_index, duration_minutes, content_type, is_published, is_preview)
select c.id, v.title, v.description, v.idx, 45, 'video'::content_type, true, v.idx = 1
from c, (values
  (1,'[과목 1 · 축제 실전 기획] 1강. 환경분석·타깃 전략 수립','SWOT·PEST 분석, 경쟁 축제 벤치마킹, 전략적 타깃 세분화'),
  (2,'[과목 1 · 축제 실전 기획] 2강. 차별화 콘셉트·예산·일정·안전 시나리오 통합','브랜드 포지셔닝, 통합 예산 배분, 리스크 시나리오 설계'),
  (3,'[과목 1 · 축제 실전 기획] 3강. 종합 기획서 작성 실습','관계기관 제출용 종합 기획서 완성, 발표 자료 구성 (산출물: 종합 기획서)'),
  (4,'[과목 2 · 통합 마케팅 및 홍보] 4강. 브랜드 포지셔닝 및 고객여정 기반 채널 전략','축제 브랜드 아이덴티티 설계, 터치포인트별 채널 믹스 전략'),
  (5,'[과목 2 · 통합 마케팅 및 홍보] 5강. KPI·예산 배분 및 성과 측정 체계','마케팅 ROI 산정, 채널별 예산 배분, 실시간 성과 모니터링'),
  (6,'[과목 2 · 통합 마케팅 및 홍보] 6강. 통합 마케팅 플랜 작성 실습','KPI 포함 통합 마케팅 플랜 완성, 예산표·일정표 통합 작성 (산출물: 통합 마케팅 플랜)'),
  (7,'[과목 3 · 축제 관리 및 평가] 7강. 운영조직 표준화 및 안전·보험·인허가','조직 표준 매뉴얼 작성, 행사 보험·인허가 실무, 안전관리 계획 수립'),
  (8,'[과목 3 · 축제 관리 및 평가] 8강. 정산·증빙 관리 및 성과지표 설계','예산 정산 체계, 증빙 관리 프로세스, KPI 기반 성과 측정 체계 구축'),
  (9,'[과목 3 · 축제 관리 및 평가] 9강. 운영·평가 보고서 작성 실습','관계기관 제출용 사후 보고서 완성, 개선안 도출 및 차기 기획 연계 (산출물: 운영·평가 보고서)')
) as v(idx, title, description)
where not exists (select 1 from public.course_contents cc where cc.course_id = c.id);