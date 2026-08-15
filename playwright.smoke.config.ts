import { defineConfig, devices } from "@playwright/test";

/**
 * 배포 전 스모크 테스트 전용 설정.
 * 기존 playwright.config.ts(에이전트 전용)와 독립적으로 동작한다.
 */
const PORT = Number(process.env.E2E_PORT ?? 8080);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /smoke-.*\.spec\.ts/,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    viewport: { width: 1280, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // 샌드박스/CI 이미지에 설치된 Chromium 경로를 직접 지정할 수 있다.
        launchOptions: process.env.E2E_CHROMIUM_PATH
          ? { executablePath: process.env.E2E_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx vite --port ${PORT} --strictPort`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
