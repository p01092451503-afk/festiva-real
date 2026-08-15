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

## 납품 전 전수 점검 리포트

주요 화면을 순회하며 화면 목록 / API 4xx·5xx / 런타임 오류를 수집해 요약 리포트를 자동 생성합니다.

```bash
npm run audit:report        # reports/pre-delivery-audit-<시각>.{md,xlsx,json} 생성
AUDIT_STRICT=1 npm run audit:report   # 이상 발견 시 exit 1 (CI 차단용)
```

점검 대상 화면 목록은 `e2e/screens.ts` 한 곳에서 관리하며 스모크 테스트와 공유합니다.
