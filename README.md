# Welcome to your Lovable project

TODO: Document your project here

## 배포 전 E2E 스모크 테스트

주요 26개 화면(공개 7 + 로그인 19)을 Playwright로 자동 순회하며 렌더 실패, 에러 바운더리, 404, 콘솔 에러를 검사합니다.

```bash
npm run test:e2e:smoke      # 로컬 (Vite 자동 기동)
E2E_BASE_URL=https://webheads-class.lovable.app npm run test:e2e:smoke   # 배포본 대상
```

- 스펙: `e2e/smoke-26-screens.spec.ts`, 설정: `playwright.smoke.config.ts`
- 계정 지정: `E2E_EMAIL`, `E2E_PASSWORD` (기본 데모 계정 사용)
- 배포 전 자동 실행: `predeploy` 스크립트 + GitHub Actions `.github/workflows/e2e-smoke.yml` (push/PR 시 실행, 실패 시 배포 차단)
