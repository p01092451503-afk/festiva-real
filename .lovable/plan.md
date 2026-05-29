# 유료 강의 개설 기능 업그레이드

첨부 이미지(기본정보·운영정보·강의소개)의 모든 항목을 기존 `AdminCourses` 강의 관리에 통합합니다. 결제·평가 등 기존 도메인은 그대로 두고, 강의 메타데이터를 확장해 단과/패키지 판매가 가능하도록 만듭니다.

## 1. DB 스키마 확장

기존 `courses` 테이블에 컬럼 추가 + 신규 테이블 2개.

**`courses` 추가 컬럼**
- `course_type` text — `'single' | 'package'` (단과/패키지), 기본 `'single'`
- `base_category` text — 기본 분류 (예: `'정규 교육과정'`)
- `installment_enabled` bool, `installment_months` int — 무이자 할부
- `retake_discount_enabled` bool, `retake_discount_percent` int, `retake_allow_coupon_stack` bool
- `suspension_enabled` bool — 휴강 기능
- `is_sequential` (이미 존재) 활용 = 순차학습
- `visibility` text — `'shown' | 'hidden'`
- `visibility_start_at`, `visibility_end_at` timestamptz — 표출 기간
- `keywords` text[] — 키워드 설정
- `always_recruiting` bool — 상시모집 노출
- `period_mode` bool — 기간제 운영
- `auto_start_grace_days` int — 학습자동시작 유예 (기본 30)
- `daily_learning_limit_min` int — 1일 학습제한(분), null=안함
- `attachment_url` text — 첨부파일(교재) URL
- `intro_video_url` text, `intro_video_provider` text — 소개 영상 (CDN/youtube/vimeo)
- `support_options` text[] — 신규/인기/최다판매 뱃지
- `short_intro_html` text — 간략 소개(HTML)
- `detail_intro_html` text — 강의 소개(HTML)
- `seo_title`, `seo_description`, `seo_keywords` text — SEO 정보

**신규 `course_pricing_tiers`** (단과 강의의 다중 가격행)
- `course_id`, `duration_days`, `list_price`, `sale_price`, `points`, `display_name`, `sort_order`
- RLS: 공개 SELECT(published 강의), admin 전체

**신규 `course_package_items`** (패키지 = 단과 강의 묶음)
- `package_course_id`, `child_course_id`, `sort_order`
- RLS 동일

각 테이블 `GRANT SELECT TO anon, authenticated` + admin RPC 권한.

## 2. UI: `CourseEditDialog`(또는 신규 풀스크린 페이지)

기존 `AdminCourses.tsx`의 편집 다이얼로그를 탭 구성으로 재설계:

```text
[기본정보] [차시관리] [강사] [수료기준] [교재] [모의고사] [설문] [수강생관리] [자료실] [QnA]
```

**기본정보 탭** — 첨부 이미지 1·2·3의 모든 필드를 그대로 구현:
- 기본 분류 (2단계 셀렉트)
- 강의구분: 단과/패키지 라디오 (패키지 선택 시 하위 강의 선택 UI 노출)
- 강좌명
- 판매가격: 5행 그리드 (수강기간/정가/가격/포인트/표출명) — 행 추가/삭제
- 무이자 할부 토글 + 개월수
- 재수강 할인 토글 + % + 쿠폰중복허용
- 휴강 기능 토글
- 차시 표출(자동/수동) + 순차학습
- 표출 여부 + 기간 datetime
- 키워드 설정 (태그 입력)
- 운영정보 섹션: 상시모집 / 기간제 / 학습자동시작 유예 / 인원제한 / 1일 학습제한
- 강의소개 섹션: 강좌 이미지 업로드, 소개 영상 URL, 첨부파일(교재), 지원옵션 체크박스, 간략소개 textarea, 강의소개 RichTextEditor
- SEO 정보 섹션

나머지 탭은 기존 페이지/컴포넌트(`AdminLearning`, `AdminAssessmentsStatus`, `AdminEnrollments` 등)로 라우팅하거나 임베드.

## 3. Storefront 반영

- 메인 강의 카드: `sale_price`가 있으면 할인율 + 정가 strikethrough 표시 (이미 일부 존재 시 확장)
- 강의 상세 페이지: 다중 가격 옵션이 있으면 라디오 선택 후 장바구니/결제
- 패키지 강의: 포함된 단과 강의 목록 노출

## 4. 안전 장치

- 기존 `price`/`sale_price` 컬럼은 유지하고 `course_pricing_tiers`의 첫 행과 동기화 트리거 작성 → 기존 결제/주문 로직 무중단
- 마이그레이션 후 권한별 접근 (학생: 공개강의만 SELECT, 관리자: 전체)

## 5. 단계

1. 마이그레이션 (스키마 + RLS + 트리거)
2. 강의 편집 UI 재구성 (기본정보 탭 풀구현, 나머지 탭은 기존 링크)
3. Storefront 카드/상세에 다중 가격·패키지 노출
4. 한국어/영어 i18n 키 추가

## 기술 세부

- 가격 그리드는 `useFieldArray` 패턴(직접 state)로 5행 고정 + "행 추가" 버튼으로 확장
- 패키지 하위 강의 선택은 `Command`(shadcn) 멀티셀렉트
- 키워드는 `Badge` + Enter 입력
- RichText는 기존 `RichTextEditor` 컴포넌트 재사용
- 이미지/첨부 업로드는 기존 `course-thumbnails`, 신규 `course-attachments` 스토리지 버킷
