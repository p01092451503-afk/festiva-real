import { test, expect, type Page } from "@playwright/test";

/**
 * 배포 전 E2E 스모크 테스트 — 주요 26개 화면 자동 순회
 *
 * 각 화면에 대해 다음을 검증한다.
 *  1. 라우트가 렌더링되고 앱 셸(#root)에 실제 콘텐츠가 존재한다.
 *  2. React 에러 바운더리 / "Something went wrong" 화면이 뜨지 않는다.
 *  3. 404(NotFound) 화면으로 빠지지 않는다.
 *  4. 치명적인 브라우저 콘솔 에러가 없다.
 *
 * 실행: `npm run test:e2e:smoke`
 */

const DEMO_EMAIL = process.env.E2E_EMAIL ?? "test@test.co.kr";
const DEMO_PASSWORD = process.env.E2E_PASSWORD ?? "test1234";

type Screen = { name: string; path: string; auth: boolean };

/** 공개(비로그인) 화면 */
const PUBLIC_SCREENS: Screen[] = [
  { name: "스토어 홈", path: "/", auth: false },
  { name: "강의 카탈로그(스토어)", path: "/store/courses", auth: false },
  { name: "도서 스토어", path: "/store/books", auth: false },
  { name: "구독 상품", path: "/store/subscriptions", auth: false },
  { name: "클래스", path: "/store/classes", auth: false },
  { name: "커뮤니티(공개)", path: "/community", auth: false },
  { name: "로그인", path: "/auth", auth: false },
];

/** 로그인 후 접근하는 화면 */
const AUTH_SCREENS: Screen[] = [
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

const SCREENS: Screen[] = [...PUBLIC_SCREENS, ...AUTH_SCREENS];

/** 무시해도 되는 콘솔 노이즈 (외부 스크립트, 리소스 404 등) */
const IGNORED_CONSOLE = [
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

function attachConsoleCollector(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (IGNORED_CONSOLE.some((ignored) => text.includes(ignored))) return;
    errors.push(text);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

async function login(page: Page) {
  await page.goto("/auth");
  await page.waitForLoadState("domcontentloaded");

  const email = page.locator('input[type="email"]').first();
  const password = page.locator('input[type="password"]').first();
  await email.waitFor({ state: "visible", timeout: 15_000 });

  await email.fill(DEMO_EMAIL);
  await password.fill(DEMO_PASSWORD);
  await page.locator('button[type="submit"]').first().click();

  // 로그인 성공 시 /auth 를 벗어난다.
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 30_000 });
}

async function assertScreenHealthy(page: Page, screen: Screen, errors: string[]) {
  await page.goto(screen.path);
  await page.waitForLoadState("domcontentloaded");
  const root = page.locator("#root");
  await expect(root, `${screen.name}: #root 렌더 실패`).toBeAttached();

  // 앱 셸이 실제 콘텐츠를 그릴 때까지 폴링 (networkidle 은 realtime 연결 때문에 불안정).
  await expect
    .poll(async () => (await page.locator("#root").innerText()).trim().length, {
      timeout: 30_000,
      message: `${screen.name}: 화면이 비어 있음`,
    })
    .toBeGreaterThan(0);

  // 데이터 페칭/렌더 안정화 대기
  await page.waitForTimeout(800);

  const bodyText = (await page.locator("body").innerText()).trim();

  // 에러 바운더리 / 404 감지
  const crashed = /Something went wrong|Application error|Unexpected Application Error/i.test(
    bodyText,
  );
  expect(crashed, `${screen.name}: 에러 바운더리 노출\n${bodyText.slice(0, 400)}`).toBe(false);

  const notFound = /404/.test(bodyText) && /Oops|not exist|찾을 수 없/i.test(bodyText);
  expect(notFound, `${screen.name}: 404 화면으로 이동함`).toBe(false);

  expect(errors, `${screen.name}: 콘솔 에러\n${errors.join("\n")}`).toEqual([]);
  errors.length = 0;
}

test.describe("배포 전 스모크 — 주요 26개 화면", () => {
  test(`공개 화면 ${PUBLIC_SCREENS.length}개 순회`, async ({ page }) => {
    test.setTimeout(180_000);
    const errors = attachConsoleCollector(page);
    for (const screen of PUBLIC_SCREENS) {
      await test.step(`${screen.name} (${screen.path})`, async () => {
        await assertScreenHealthy(page, screen, errors);
      });
    }
  });

  test(`로그인 화면 ${AUTH_SCREENS.length}개 순회`, async ({ page }) => {
    test.setTimeout(420_000);
    const errors = attachConsoleCollector(page);
    await login(page);
    errors.length = 0;

    for (const screen of AUTH_SCREENS) {
      await test.step(`${screen.name} (${screen.path})`, async () => {
        await assertScreenHealthy(page, screen, errors);
      });
    }
  });

  test("순회 대상은 26개 화면이어야 한다", async () => {
    expect(SCREENS.length).toBe(26);
  });
});
