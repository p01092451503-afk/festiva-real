/**
 * 납품 전 전수 점검 리포트 생성기
 *
 * 주요 화면을 자동 순회하며 아래 3가지를 수집해 요약 리포트를 만든다.
 *   1) 화면 목록 — 렌더 성공 여부, 로딩 시간, 에러 바운더리/404 여부
 *   2) API 4xx/5xx — 화면별 실패 응답(상태코드, 엔드포인트)
 *   3) 런타임 오류 — 콘솔 에러 및 처리되지 않은 예외
 *
 * 실행:
 *   npm run audit:report
 *   E2E_BASE_URL=https://webheads-class.lovable.app npm run audit:report
 *
 * 산출물: reports/pre-delivery-audit-<타임스탬프>.{md,xlsx,json}
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { SCREENS, IGNORED_CONSOLE, IGNORED_REQUESTS } from "../e2e/screens.ts";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8080";
const EMAIL = process.env.E2E_EMAIL ?? "test@test.co.kr";
const PASSWORD = process.env.E2E_PASSWORD ?? "test1234";
const EXECUTABLE = process.env.E2E_CHROMIUM_PATH || undefined;
const OUT_DIR = resolve(process.cwd(), "reports");

const ignored = (text, list) => list.some((entry) => text.includes(entry));
const shortUrl = (url) => url.replace(/^https?:\/\/[^/]+/, "").split("?")[0];

async function run() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: EXECUTABLE });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  let current = { name: "부팅", path: "-" };
  const runtimeErrors = [];
  const apiFailures = [];

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const message = msg.text();
    if (ignored(message, IGNORED_CONSOLE)) return;
    runtimeErrors.push({ screen: current.name, path: current.path, type: "console.error", message });
  });
  page.on("pageerror", (err) => {
    runtimeErrors.push({
      screen: current.name,
      path: current.path,
      type: "uncaught",
      message: err.message,
    });
  });
  page.on("response", (res) => {
    const status = res.status();
    if (status < 400) return;
    const url = res.url();
    if (ignored(url, IGNORED_REQUESTS)) return;
    apiFailures.push({
      screen: current.name,
      path: current.path,
      status,
      kind: status >= 500 ? "5xx" : "4xx",
      method: res.request().method(),
      endpoint: shortUrl(url),
    });
  });

  // 로그인
  let loginOk = false;
  try {
    await page.goto(`${BASE_URL}/auth`, { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"]').first().fill(EMAIL);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 30_000 });
    loginOk = true;
  } catch {
    loginOk = false;
  }
  runtimeErrors.length = 0;
  apiFailures.length = 0;

  const screens = [];
  for (const screen of SCREENS) {
    current = screen;
    const errorsBefore = runtimeErrors.length;
    const apiBefore = apiFailures.length;
    const started = Date.now();
    let rendered = false;
    let crashed = false;
    let notFound = false;
    let note = "";

    try {
      await page.goto(`${BASE_URL}${screen.path}`, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        const text = (await page.locator("#root").innerText().catch(() => "")).trim();
        if (text.length > 0) {
          rendered = true;
          break;
        }
        await page.waitForTimeout(300);
      }
      await page.waitForTimeout(800);
      const body = (await page.locator("body").innerText()).trim();
      crashed = /Something went wrong|Application error|Unexpected Application Error/i.test(body);
      notFound = /404/.test(body) && /Oops|not exist|찾을 수 없/i.test(body);
    } catch (err) {
      note = err instanceof Error ? err.message.split("\n")[0] : String(err);
    }

    const loadMs = Date.now() - started;
    const errorCount = runtimeErrors.length - errorsBefore;
    const apiCount = apiFailures.length - apiBefore;
    const ok = rendered && !crashed && !notFound && errorCount === 0 && apiCount === 0;

    screens.push({
      name: screen.name,
      path: screen.path,
      auth: screen.auth ? "로그인" : "공개",
      status: ok ? "정상" : "확인필요",
      rendered: rendered ? "O" : "X",
      crashed: crashed ? "O" : "-",
      notFound: notFound ? "O" : "-",
      apiFailures: apiCount,
      runtimeErrors: errorCount,
      loadMs,
      note,
    });
    process.stdout.write(`${ok ? "✓" : "✗"} ${screen.name} (${screen.path}) ${loadMs}ms\n`);
  }

  await browser.close();

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const summary = {
    생성시각: new Date().toISOString(),
    대상: BASE_URL,
    로그인계정: EMAIL,
    로그인성공: loginOk ? "성공" : "실패",
    점검화면수: screens.length,
    정상화면: screens.filter((s) => s.status === "정상").length,
    확인필요화면: screens.filter((s) => s.status !== "정상").length,
    "API 4xx": apiFailures.filter((f) => f.kind === "4xx").length,
    "API 5xx": apiFailures.filter((f) => f.kind === "5xx").length,
    런타임오류: runtimeErrors.length,
  };

  // JSON
  const json = { summary, screens, apiFailures, runtimeErrors };
  const base = resolve(OUT_DIR, `pre-delivery-audit-${stamp}`);
  writeFileSync(`${base}.json`, JSON.stringify(json, null, 2), "utf8");

  // Markdown
  const table = (headers, rows) =>
    [
      `| ${headers.join(" | ")} |`,
      `| ${headers.map(() => "---").join(" | ")} |`,
      ...rows.map((r) => `| ${r.join(" | ")} |`),
    ].join("\n");

  const md = [
    `# 납품 전 전수 점검 리포트`,
    "",
    Object.entries(summary)
      .map(([k, v]) => `- **${k}**: ${v}`)
      .join("\n"),
    "",
    `## 1. 화면 점검 결과 (${screens.length}개)`,
    "",
    table(
      ["화면", "경로", "접근", "결과", "렌더", "에러화면", "404", "API오류", "런타임오류", "로딩(ms)"],
      screens.map((s) => [
        s.name,
        `\`${s.path}\``,
        s.auth,
        s.status,
        s.rendered,
        s.crashed,
        s.notFound,
        s.apiFailures,
        s.runtimeErrors,
        s.loadMs,
      ]),
    ),
    "",
    `## 2. API 4xx/5xx (${apiFailures.length}건)`,
    "",
    apiFailures.length
      ? table(
          ["화면", "구분", "상태", "메서드", "엔드포인트"],
          apiFailures.map((f) => [f.screen, f.kind, f.status, f.method, `\`${f.endpoint}\``]),
        )
      : "실패 응답 없음.",
    "",
    `## 3. 런타임 오류 (${runtimeErrors.length}건)`,
    "",
    runtimeErrors.length
      ? table(
          ["화면", "유형", "메시지"],
          runtimeErrors.map((e) => [e.screen, e.type, e.message.replace(/\|/g, "/").slice(0, 300)]),
        )
      : "런타임 오류 없음.",
    "",
  ].join("\n");
  writeFileSync(`${base}.md`, md, "utf8");

  // XLSX
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(Object.entries(summary).map(([항목, 값]) => ({ 항목, 값 }))),
    "요약",
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(screens), "화면목록");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(apiFailures.length ? apiFailures : [{ 결과: "실패 응답 없음" }]),
    "API오류",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(runtimeErrors.length ? runtimeErrors : [{ 결과: "런타임 오류 없음" }]),
    "런타임오류",
  );
  XLSX.writeFile(wb, `${base}.xlsx`);

  console.log(`\n리포트 생성 완료:\n  ${base}.md\n  ${base}.xlsx\n  ${base}.json`);
  const failed = summary.확인필요화면 > 0;
  if (failed && process.env.AUDIT_STRICT === "1") process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
