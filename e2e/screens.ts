/**
 * 납품 전 전수 점검 대상 화면 목록 (공유 소스).
 * 스모크 테스트(e2e/smoke-26-screens.spec.ts)와 점검 리포트 생성기
 * (scripts/pre-delivery-audit.mjs)가 동일한 목록을 사용한다.
 */
export type Screen = { name: string; path: string; auth: boolean };

/** 공개(비로그인) 화면 */
export const PUBLIC_SCREENS: Screen[] = [
  { name: "스토어 홈", path: "/", auth: false },
  { name: "강의 카탈로그(스토어)", path: "/store/courses", auth: false },
  { name: "도서 스토어", path: "/store/books", auth: false },
  { name: "구독 상품", path: "/store/subscriptions", auth: false },
  { name: "클래스", path: "/store/classes", auth: false },
  { name: "커뮤니티(공개)", path: "/community", auth: false },
  { name: "로그인", path: "/auth", auth: false },
];

/** 로그인 후 접근하는 화면 */
export const AUTH_SCREENS: Screen[] = [
  { name: "대시보드 리다이렉트", path: "/dashboard", auth: true },
  { name: "학생 대시보드", path: "/student", auth: true },
  { name: "내 강의", path: "/dashboard/courses", auth: true },
  { name: "과제", path: "/dashboard/assignments", auth: true },
  { name: "성취/뱃지", path: "/dashboard/achievements", auth: true },
  { name: "강의 카탈로그", path: "/catalog", auth: true },
  { name: "마이페이지", path: "/mypage", auth: true },
  { name: "주문 내역", path: "/my/orders", auth: true },
  { name: "포인트", path: "/my/points", auth: true },
  { name: "공지사항", path: "/student/announcements", auth: true },
  { name: "자료실", path: "/student/board", auth: true },
  { name: "학습 커뮤니티", path: "/student/community", auth: true },
  { name: "학습 노트", path: "/student/notes", auth: true },
  { name: "마이크로 러닝", path: "/student/micro-learning", auth: true },
  { name: "자기주도학습", path: "/student/self-learning", auth: true },
  { name: "수료증", path: "/student/certificates", auth: true },
  { name: "설문", path: "/student/surveys", auth: true },
  { name: "첨삭 목록", path: "/student/corrections", auth: true },
  { name: "장바구니", path: "/cart", auth: true },
];

export const SCREENS: Screen[] = [...PUBLIC_SCREENS, ...AUTH_SCREENS];

/** 무시해도 되는 콘솔 노이즈 (개발 모드 경고, 로컬 전용 CORS 등) */
export const IGNORED_CONSOLE = [
  "Download the React DevTools",
  "ResizeObserver loop",
  "favicon",
  "net::ERR_",
  "Failed to load resource",
  "third-party cookie",
  "chrome-extension",
  // React 개발 모드 경고 (프로덕션 번들에는 존재하지 않음)
  "Warning:",
  "validateDOMNesting",
  "React Router Future Flag",
  // 로컬 origin 에서만 발생하는 분석/로깅 CORS 노이즈
  "blocked by CORS policy",
  "traffic_logs",
];

/** 리포트에서 무시하는 네트워크 노이즈 (분석/로깅, 인증 전 401 등) */
export const IGNORED_REQUESTS = [
  "/rest/v1/traffic_logs",
  "/auth/v1/token",
  "google-analytics",
  "googletagmanager",
];
