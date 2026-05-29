
# 폐쇄형 LMS (Closed LMS) 구현 계획

## 0. 핵심 컨셉
"폐쇄형 LMS"라는 **하나의 기능 모듈(feature module)** 을 새로 만들고, 운영자가 이 모듈을 **ON 하면 결제(스토어프론트) 기능은 자동으로 OFF**, **OFF 하면 결제 기능 다시 ON** 되도록 토글을 묶음.

운영 시나리오:
```
[관리자] CSV 업로드 (이름·휴대폰·강의)
    ↓
[시스템] 계정 자동 생성 + 14일 1회용 토큰 생성
    ↓
[알리고 SMS] 강의 안내 + 로그인 링크/ID·비번 발송  (옵션 택1 또는 둘 다)
    ↓
[수강자] 링크 클릭 → 자동 로그인 → 영상 수강 → 체크리스트 확인
    ↓
[시스템] 완료조건 충족 → 수료증 PDF 자동 발급
    ↓
[관리자] 일괄 PDF 다운 / 과정별 일괄 다운 / 수료명단 출력
```

---

## 1. 기능 모듈 그룹 정의

### 1-1. 신규 모듈 키
`feature_modules` 테이블에 추가:
- `closed_lms` — 폐쇄형 LMS 전체 그룹 (마스터 토글)

### 1-2. 모듈 토글 연동 규칙
운영자 UI(`/admin/settings/modules`)에서:
- `closed_lms = ON`  →  `storefront`, `b2c_sale`, `cart`, `checkout` 자동 OFF (UI에서 강제 비활성)
- `closed_lms = OFF` →  위 모듈들 다시 사용 가능 (자동 ON 하지는 않음, 운영자가 직접 ON)

구현 위치: `useFeatureModules` 훅에서 파생 상태로 계산
```ts
const isStorefrontVisible = isEnabled('storefront') && !isEnabled('closed_lms');
```
→ 사이드바, 라우팅 가드, 스토어 진입점 모두 이 파생값으로 통일

### 1-3. 폐쇄형 LMS 그룹에 묶이는 메뉴
- 수강자 일괄 초대 (`/admin/invitations`)
- 초대 발송 현황 (`/admin/invitations/logs`)
- SMS 설정 (`/admin/settings/sms`)
- 1회용 토큰 관리 (`/admin/invitations/tokens`)

---

## 2. 데이터베이스 설계 (신규 테이블)

### 2-1. `course_invitations` (초대 건별 레코드)
- `recipient_name`, `phone`, `email?`, `course_id`, `branch_id?`
- `delivery_method`: `magic_link` | `credentials` | `both`
- `status`: `pending` | `sent` | `failed` | `consumed` | `expired`
- `sent_at`, `consumed_at`, `expires_at`
- `created_by`(운영자)

### 2-2. `one_time_login_tokens` (1회용 로그인)
- `token` (64자 랜덤, UNIQUE)
- `user_id`, `invitation_id?`, `course_id?`
- `expires_at` (기본 발송 시각 +14일)
- `used_at` (NULL이면 미사용 / 1회 사용 후 잠금)
- `max_uses` 기본 1 (운영자 옵션으로 5회까지 허용 가능)

### 2-3. `sms_logs` (발송 로그)
- `invitation_id`, `provider`(=`aligo`), `to`, `message`,
- `request_payload`(jsonb), `response`(jsonb),
- `status`, `provider_message_id`, `sent_at`

### 2-4. `sms_templates` (메시지 템플릿)
- `key`(`invite_magic_link`, `invite_credentials`, `reminder`)
- `body_template` (치환: `{이름}`, `{강의명}`, `{링크}`, `{아이디}`, `{비번}`, `{만료일}`)

모든 테이블에 RLS — `admin`/`super_admin`/`branch_admin`(자기 지사)만 접근. GRANT 포함.

---

## 3. 신규 페이지/컴포넌트

### 3-1. 수강자 일괄 초대 화면 (`/admin/invitations`)
- 강의 선택(드롭다운)
- CSV/Excel 업로드 (템플릿 다운로드 제공): 이름, 휴대폰, 이메일(선택), 소속(선택)
- 발송 방식 선택 (라디오):
  - (A) 1회용 로그인 링크만
  - (B) ID/임시비번만
  - (C) 둘 다 발송
- 미리보기 → "초대 발송" 버튼

기존 `BulkStaffUploadDialog`를 복제·확장.

### 3-2. 초대 발송 현황 (`/admin/invitations/logs`)
- 발송됨/링크 클릭/수강 시작/수료 완료 단계별 필터
- 행별 액션: 재발송, 토큰 연장, 토큰 폐기

### 3-3. 1회용 로그인 페이지 (`/auth/otl?t=...`, 공개 라우트)
- 토큰 검증 Edge Function 호출 → 세션 발급 → 해당 강의 페이지로 이동
- 만료/사용완료 시 안내 화면

### 3-4. SMS 설정 (`/admin/settings/sms`)
- 알리고 발신번호, API Key, User ID 입력 폼 (UI만)
- 템플릿 편집기 (변수 치환 미리보기)
- **API 연동은 비활성 상태로 보관** (스위치는 두되 "준비 중" 표기)

---

## 4. Edge Functions (신규)

### 4-1. `send-course-invite`
- CSV로부터 받은 수강자 배열을 받아:
  1. 기존 사용자 매칭(전화번호 기준) 또는 신규 생성 (`create-user` 재사용)
  2. `course_invitations` insert
  3. 옵션에 따라 `one_time_login_tokens` 발급 + 임시비번 발급
  4. 메시지 본문 합성 후 `sms_logs` insert (`status: pending`)
  5. **알리고 호출 부분은 TODO 주석 + mock 응답으로 처리** (API 연동 비활성)

### 4-2. `consume-otl-token`
- 토큰 검증 → Supabase Admin API로 1회용 세션 발급 → 응답으로 액세스/리프레시 토큰 반환
- `used_at` 기록 (max_uses 초과 시 거부)

### 4-3. `expire-old-tokens` (cron, 1일 1회)
- `expires_at < now()` 인 토큰을 `expired` 표시

알리고 API 키 secret(`ALIGO_API_KEY`, `ALIGO_USER_ID`, `ALIGO_SENDER`)은 **추후 연동 시점에 추가**, 지금은 자리만 마련.

---

## 5. 기존 기능 재사용 매핑

| 단계 | 재사용 |
|---|---|
| 계정 생성 | `supabase/functions/create-user` 확장 (비번 옵션 출력) |
| 영상 수강 추적 | `useVideoProgress` (80% 자동 완료) 그대로 |
| 체크리스트/수료 조건 | `CompletionCriteriaDialog` 그대로 |
| 수료증 PDF | `lib/certificateGenerator.ts` + `BranchAdminCertificates` 일괄 다운 |
| 수료명단 인쇄 | `CompletionRosterPrint` |
| 사이드바 그룹 토글 | `useFeatureModules` |

---

## 6. 보안 체크리스트

- 1회용 토큰: 64자 cryptographic random, `used_at`/`expires_at` 강제 검증을 Edge Function 안에서만
- 토큰 테이블은 `anon`에 GRANT 없음 (Edge Function의 service_role만 접근)
- `/auth/otl` 라우트는 토큰 형식 검증 후 Edge Function 호출, 클라이언트에서 직접 조회 불가
- 휴대폰 번호 RLS: 운영자만 조회 / 본인 row만 본인 조회 가능
- SMS 발송 Rate Limit: 운영자당 1일 발송 한도 (예: 1,000건) — DB 함수로 체크

---

## 7. 구현 순서 (작업 단위)

1. **DB 마이그레이션** — 위 4개 테이블 + GRANT + RLS + `feature_modules`에 `closed_lms` 추가
2. **모듈 토글 연동** — `useFeatureModules` 파생 로직, 사이드바/라우팅 가드 수정
3. **SMS 설정 화면** + 템플릿 편집기 (UI only)
4. **수강자 일괄 초대 화면** + CSV 파싱 + 미리보기
5. **`send-course-invite` Edge Function** (알리고 호출은 mock)
6. **`consume-otl-token` Edge Function** + `/auth/otl` 페이지
7. **초대 발송 현황 화면** (재발송/토큰 관리)
8. **`expire-old-tokens` cron**
9. QA: 발송→링크 클릭→수강→수료증 자동 발급까지 end-to-end 시나리오 검증

---

## 8. 이 계획에서 의도적으로 제외

- 알리고 실제 API 호출 (구조만 준비, 키 입력란 + mock 응답)
- 카카오 알림톡(추후 확장 여지)
- 결제 모듈 삭제 (숨김/노출 토글만, 코드는 유지)

승인해 주시면 1번(DB 마이그레이션)부터 순서대로 작업 시작하겠습니다.
