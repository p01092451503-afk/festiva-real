import { Info, Layers, Shield, Package, KeyRound, Database, FileSearch, ShieldCheck, Smartphone, RefreshCw, CheckCircle2, XCircle, AlertCircle, Trash2 } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";

/**
 * 시스템 정보 페이지
 * - 기술 스택 소개 (Frontend, Backend, Infrastructure)
 * - 보안 백서 요약 (인증 및 접근 제어, 데이터 보호, 감사 및 모니터링)
 *
 * 고객사 보안 담당자/감사자가 확인할 수 있는 시스템 신뢰도 및 보안 검토 자료입니다.
 */
export default function AdminSystemInfo() {
  const { isAdmin, isSuperAdmin } = useUserRole();

  // 추가 안전장치: admin/super_admin 권한이 없는 경우(학생/강사) 즉시 리다이렉트.
  // role switcher로 student 모드 전환 시에도 노출되지 않도록 localStorage 활성 역할도 검사한다.
  const activeRole = (() => {
    try {
      return typeof window !== "undefined" ? localStorage.getItem("nf-active-role") : null;
    } catch {
      return null;
    }
  })();

  if (!isAdmin && !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  if (activeRole && activeRole !== "admin") {
    const target = activeRole === "teacher" ? "/teacher" : "/student";
    return <Navigate to={target} replace />;
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <header>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <Info className="h-6 w-6" aria-hidden />
            시스템 정보
          </h1>
          <p className="text-muted-foreground mt-1">
           본 플랫폼의 기술 스택, 보안 정책을 안내합니다. 고객사의 보안 검토 자료로 활용할 수 있습니다.
          </p>
        </header>

        <Tabs defaultValue="stack" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-2xl">
            <TabsTrigger value="stack">
              <Layers className="h-4 w-4 mr-2" aria-hidden />
              기술 스택
            </TabsTrigger>
            <TabsTrigger value="security">
              <Shield className="h-4 w-4 mr-2" aria-hidden />
              보안 백서
            </TabsTrigger>
            <TabsTrigger value="pwa">
              <Smartphone className="h-4 w-4 mr-2" aria-hidden />
              PWA 상태
            </TabsTrigger>
          </TabsList>

          {/* 기술 스택 */}
          <TabsContent value="stack" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>프론트엔드 (Frontend)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <StackRow name="React 18" desc="Meta(Facebook)에서 개발한 글로벌 표준 UI 라이브러리. 전 세계 상위 10만 웹사이트의 40% 이상이 채택." />
                <StackRow name="TypeScript 5" desc="Microsoft 개발. 정적 타입 검사로 런타임 오류를 사전 방지하는 엔터프라이즈급 언어." />
                <StackRow name="Vite 5" desc="차세대 번들러. 빠른 빌드와 코드 분할(Code Splitting)로 초기 로딩 최적화." />
                <StackRow name="Tailwind CSS v3" desc="유틸리티 우선 CSS 프레임워크. 디자인 시스템(시맨틱 토큰) 기반 일관된 UI 구현." />
                <StackRow name="shadcn/ui · Radix UI" desc="WAI-ARIA 준수 접근성 컴포넌트 라이브러리. 키보드 내비게이션·스크린리더 완벽 대응." />
                <StackRow name="React Query (TanStack)" desc="서버 상태 관리 라이브러리. 5분 캐싱/15분 메모리 보존으로 9천명 동시접속 부하 분산." />
                <StackRow name="React Router v6" desc="선언적 클라이언트 라우팅. 코드 스플리팅 기반 페이지 단위 lazy loading 지원." />
                <StackRow name="i18next" desc="국제 표준 다국어(i18n) 라이브러리. 한국어/영어 동시 운영." />
                <StackRow name="tldraw 캔버스" desc="영어 첨삭(Correction) 전용 드로잉 엔진. 커스텀 편집 툴바(위치 이동 가능)·다중 페이지 첨삭 지원." />
                <StackRow name="Rich Text Editor" desc="커뮤니티·게시판 글쓰기용 서식 편집기. 이미지 삽입 및 안전한 HTML 렌더링." />
                <StackRow name="tus 리줌 업로드" desc="동영상 CDN 직접 업로드(tus-js-client). 대용량 파일 중단 후 이어올리기 지원." />
                <StackRow name="PWA (Progressive Web App)" desc="Service Worker 기반 오프라인 지원. 모바일 홈화면 설치 및 네이티브 앱 수준 UX 제공." />
              </CardContent>
            </Card>


            <Card>
              <CardHeader>
                <CardTitle>백엔드 (Backend)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <StackRow name="PostgreSQL 15" desc="오픈소스 관계형 DB의 표준. Apple, Instagram, Reddit 등 대규모 서비스에서 검증." />
                <StackRow name="Row Level Security (RLS)" desc="DB 레벨 행 단위 접근 제어. 애플리케이션 코드 우회 공격 차단, 멀티테넌시 데이터 격리." />
                <StackRow name="Edge Functions (Deno)" desc="서버리스 함수 런타임. 결제 검증, 동영상 토큰 발급, 다국어 자동 번역 등 보안 민감 로직 격리." />
                <StackRow name="JWT 기반 인증" desc="업계 표준(RFC 7519) 토큰 인증. HTTPS 전구간 암호화, refresh token 회전(rotation)." />
                <StackRow name="Realtime (WebSocket)" desc="PostgreSQL Replication 기반 실시간 데이터 동기화. 알림·게시판 즉시 반영." />
                <StackRow name="Object Storage" desc="S3 호환 파일 저장소. 과제 첨부파일·아바타·자료실 파일 안전 보관 및 CDN 자동 연동." />
                <StackRow name="Database Migrations" desc="버전 관리되는 SQL 마이그레이션. 스키마 변경 이력 추적 및 롤백 가능." />
                <StackRow name="Security Definer RPC" desc="정답 채점·오픈알림 신청자 집계 등 민감 연산을 서버 함수로 격리. 원본 데이터 비노출." />
                <StackRow name="OAuth 2.0 서버" desc="외부 시스템 연동용 인증 서버 및 Open API(회원·주문·강의·진도) 제공." />

              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>인프라 및 외부 서비스</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <StackRow name="Cloudflare CDN" desc="글로벌 CDN. DDoS 방어 및 정적 자산 전 세계 엣지 캐싱." />
                <StackRow name="Global CDN (동영상)" desc="고성능 동영상 스트리밍 CDN. 9천명 동시접속·6GB+ 라이브러리 대응, 전 세계 엣지 노드 배포." />
                <StackRow name="Kollus VOD" desc="엔터프라이즈 동영상 플랫폼 연동. JWT 서명 토큰 기반 iframe 임베드, 무단 다운로드 방지." />
                <StackRow name="Google Gemini API" desc="다국어 자동 번역 엔진. 강의·차시·평가 콘텐츠 한↔영 실시간 변환." />
                <StackRow name="Web Push (FCM/APNs)" desc="표준 웹 푸시 프로토콜. 학습 알림·과제 마감·공지 실시간 전달." />
                <StackRow name="SMTP 이메일" desc="비밀번호 재설정·계정 인증 메일. 커스텀 도메인 및 SPF/DKIM 인증 지원." />
                <StackRow name="Toss Payments" desc="국내 PG 표준 결제 연동. PCI-DSS 인증 환경. 결제 완료 시 알림톡 발송 이력 자동 기록." />
                <StackRow name="Bunny Stream (직접 업로드)" desc="관리자 화면에서 동영상을 CDN으로 바로 업로드. 서명 토큰 재생, 업로드 진행률·이어올리기 지원." />
                <StackRow name="Daily (화상 강의)" desc="실시간 화상 수업 룸 생성 및 참가 토큰 발급. 세션 채팅 패널 연동." />

              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>모니터링 및 운영</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <StackRow name="트래픽 모니터링" desc="실시간 동시접속자/페이지뷰 집계. 10초 배치 로그로 DB 부하 최소화." />
                <StackRow name="Error Tracking" desc="프론트엔드/엣지 함수 오류 자동 수집 및 스택 트레이스 분석." />
                <StackRow name="감사 로그(Audit Log)" desc="로그인·권한 변경·민감 데이터 접근 이력 기록. 컴플라이언스 대응." />
                <StackRow name="자동 백업" desc="PostgreSQL Point-in-Time Recovery (PITR) 7일 보관. 데이터 손실 방지." />
                <StackRow name="배포 전 체크리스트" desc="환경변수·마이그레이션 적용·롤백 가능성·주요 API 응답을 관리자 화면(배포 점검)에서 실시간 검사." />
                <StackRow name="E2E 스모크 테스트" desc="Playwright로 주요 26개 화면을 자동 순회. 배포 전 실패 시 배포 차단." />
                <StackRow name="납품 전 전수 점검 리포트" desc="화면 목록·API 4xx/5xx·런타임 오류를 자동 요약해 문서(Markdown/Excel)로 생성." />
                <StackRow name="접근 제어 자동 테스트" desc="역할별 라우트 접근 권한을 단위 테스트로 검증해 권한 회귀를 방지." />
              </CardContent>
            </Card>


            <p className="text-sm text-muted-foreground">
              ※ 모든 구성 요소는 글로벌 표준 오픈소스 또는 검증된 상용 서비스로, 특정 벤더에 종속되지 않습니다.
            </p>

          </TabsContent>

          {/* 보안 백서 */}
          <TabsContent value="security" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" aria-hidden /> 다중 계층 보안 모델
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm leading-relaxed">
                <p>본 시스템은 <strong>4중 보안 계층</strong>을 적용합니다.</p>
                <ol className="list-decimal pl-5 space-y-1">
                  <li><strong>전송 계층:</strong> 모든 통신 HTTPS/TLS 1.3 암호화</li>
                  <li><strong>인증 계층:</strong> JWT 토큰 기반 사용자 인증, 세션 만료 관리</li>
                  <li><strong>권한 계층:</strong> 5단계 역할 기반 접근 제어(RBAC) — Super Admin / Admin / 지점 중간관리자(Branch Admin) / 강사(Teacher) / 학습자(Student). 역할 전환(Role Switcher) 시에도 활성 역할 기준으로 화면 접근을 재검증</li>
                  <li><strong>데이터 계층:</strong> PostgreSQL Row Level Security (RLS) — DB 레벨에서 행 단위 접근 차단</li>
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5" aria-hidden /> 인증 및 접근 제어
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed space-y-4">
                <SecurityRow
                  label="다중 역할 권한 모델"
                  desc="Super Admin · Admin · 지점 중간관리자 · 강사 · 학습자 5단계 역할 분리. 별도 user_roles 테이블에 저장하여 권한 상승 공격(Privilege Escalation) 차단. 지점 관리자는 소속 지점 데이터만 접근."
                />
                <SecurityRow
                  label="메뉴 노출 제어"
                  desc="시스템 설정의 사이드바 숨김 설정과 기능 모듈 토글로 역할별 메뉴 노출을 제어. 숨김 메뉴는 직접 URL 접근 시에도 권한 검사로 차단."
                />

                <SecurityRow
                  label="JWT 토큰 인증"
                  desc="RFC 7519 표준. Access Token 1시간 / Refresh Token 7일, 자동 회전(rotation)으로 탈취 위험 최소화."
                />
                <SecurityRow
                  label="이메일 인증"
                  desc="신규 가입 시 이메일 검증 필수. 관리자 일괄 등록 시에만 엣지 함수로 우회(서버 검증된 안전 경로)."
                />
                <SecurityRow
                  label="비밀번호 정책"
                  desc="최소 8자 이상, bcrypt 단방향 해시 저장. 평문 비밀번호 DB 미저장."
                />
                <SecurityRow
                  label="세션 관리"
                  desc="HttpOnly · Secure · SameSite 쿠키 적용. XSS · CSRF 공격 방어."
                />
                <details className="rounded border border-border/60 bg-muted/30 p-3">
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground">인증 흐름 다이어그램 보기</summary>
                  <pre className="bg-muted/50 p-4 rounded text-xs overflow-x-auto whitespace-pre mt-2">
{`[사용자] → 이메일/비밀번호 입력
    ↓
[클라이언트] → HTTPS 암호화 전송
    ↓
[Auth Service] → bcrypt 해시 검증
    ↓
[JWT 발급] → access_token (1h) + refresh_token (자동 갱신)
    ↓
[모든 API 요청] → JWT 검증 → RLS 정책 적용 → 데이터 반환`}
                  </pre>
                </details>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" aria-hidden /> 데이터 보호
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-4">
                <SecurityRow
                  label="Row Level Security (RLS)"
                  desc="모든 테이블에 RLS 정책 적용. 사용자는 본인 데이터만 조회 · 수정 가능, 관리자도 정책 함수(SECURITY DEFINER) 통해서만 접근."
                />
                <SecurityRow
                  label="전송 구간 암호화"
                  desc="TLS 1.3 / HTTPS 강제. HSTS 적용으로 다운그레이드 공격 차단."
                />
                <SecurityRow
                  label="저장 데이터 암호화"
                  desc="DB 파일 · 백업 AES-256 암호화. 디스크 분실 시에도 데이터 보호."
                />
                <SecurityRow
                  label="민감 정보 분리"
                  desc="API 키 · 토큰은 Edge Function 환경 변수로 격리. 클라이언트 코드에 노출 없음."
                />
                <SecurityRow
                  label="평가 무결성 보호"
                  desc="응시 중인 학습자에게 정답 · 해설이 클라이언트에 절대 노출되지 않으며, 채점은 서버 측 RPC 함수에서만 수행. 브라우저 개발자 도구로도 정답 확인 불가."
                />
                <SecurityRow
                  label="동영상 무단접근 방지"
                  desc="Kollus · Bunny Stream 연동 JWT 서명 토큰 기반 임베드. 직접 URL 접근 차단, 시청 권한 검증 후에만 재생. 토큰은 짧은 만료 시간을 가지며 Edge Function에서만 발급."
                />
                <SecurityRow
                  label="첨삭 · 과제 파일 보호"
                  desc="에세이 이미지·첨삭 결과·과제 첨부는 비공개 버킷에 저장하고, 제출자와 담당 강사·관리자만 접근 가능한 서명 URL로만 제공."
                />
                <SecurityRow
                  label="개인정보 취급 점검"
                  desc="개인정보 보관 항목과 접근 경로를 관리자 화면에서 점검하고, 회원 탈퇴 시 학습 데이터 연쇄 삭제 · 운영 데이터 비식별 처리."
                />

                <details className="rounded border border-border/60 bg-muted/30 p-3">
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground">RLS 정책 예시 보기</summary>
                  <pre className="bg-muted/50 p-4 rounded text-xs overflow-x-auto mt-2">
{`-- 학습자는 자신의 학습 진도만 조회 가능
CREATE POLICY "Users view own progress"
ON learning_progress FOR SELECT
USING (auth.uid() = user_id);

-- 관리자는 모든 데이터 조회 가능
CREATE POLICY "Admins view all"
ON learning_progress FOR SELECT
USING (has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'super_admin'));`}
                  </pre>
                </details>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSearch className="h-5 w-5" aria-hidden /> 감사 및 모니터링
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-4">
                <SecurityRow
                  label="접속 로그 기록"
                  desc="모든 로그인/로그아웃, 출석, 트래픽이 user_sessions · attendance 테이블에 기록되어 감사 가능."
                />
                <SecurityRow
                  label="실시간 모니터링"
                  desc="관리자 통계 대시보드(/admin/traffic)에서 동시접속자, 페이지별 트래픽, 이상 접근을 실시간 확인."
                />
                <SecurityRow
                  label="콘텐츠 보호 레이어"
                  desc="강의 페이지에서 우클릭 · 드래그 · 개발자도구 단축키 · 인쇄 차단. PrintScreen 키 감지 시 경고."
                />
                <SecurityRow
                  label="발송 이력 보관"
                  desc="알림톡 · 이메일 · 푸시 등 모든 발송 건을 message_logs에 기록해 수신자 · 시각 · 결과를 추적."
                />
                <SecurityRow
                  label="배포 안전성 점검"
                  desc="배포 전 체크리스트 화면에서 환경변수 · 스키마 반영 · 주요 API 응답을 검사하고, E2E 스모크 테스트 실패 시 배포를 차단."
                />

              </CardContent>
            </Card>
          </TabsContent>

          {/* PWA 상태 */}
          <TabsContent value="pwa" className="space-y-4 mt-6">
            <PwaStatusCard />
          </TabsContent>

        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function StackRow({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <span className="font-medium whitespace-nowrap min-w-[180px]">{name}</span>
      <span className="text-sm text-muted-foreground">{desc}</span>
    </div>
  );
}

function SecurityRow({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 border-b border-border/60 pb-3 last:border-0 last:pb-0">
      <span className="font-medium whitespace-nowrap min-w-[180px]">{label}</span>
      <span className="text-sm text-muted-foreground leading-relaxed">{desc}</span>
    </div>
  );
}

// ============================================================
// PWA Status — runtime diagnostics (install state, SW, cache,
// storage quota). Renders live values from browser APIs so admins
// can self-diagnose Service Worker / cache issues in production.
// ============================================================

type PwaState = {
  isStandalone: boolean;
  isIframe: boolean;
  online: boolean;
  swRegistered: boolean;
  swScope: string | null;
  swState: string | null;
  cacheCount: number;
  cacheNames: string[];
  storageUsed: number | null;
  storageQuota: number | null;
  iosBannerDismissed: boolean;
  lastChecked: Date;
};

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

async function readPwaState(): Promise<PwaState> {
  const isStandalone =
    (typeof window !== "undefined" &&
      window.matchMedia?.("(display-mode: standalone)").matches) ||
    (typeof navigator !== "undefined" &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true);

  let isIframe = false;
  try {
    isIframe = window.self !== window.top;
  } catch {
    isIframe = true;
  }

  let swRegistered = false;
  let swScope: string | null = null;
  let swState: string | null = null;
  if ("serviceWorker" in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (regs.length > 0) {
        swRegistered = true;
        swScope = regs[0].scope;
        const w = regs[0].active || regs[0].installing || regs[0].waiting;
        swState = w?.state ?? null;
      }
    } catch {
      // ignore
    }
  }

  let cacheNames: string[] = [];
  if ("caches" in window) {
    try {
      cacheNames = await caches.keys();
    } catch {
      // ignore
    }
  }

  let storageUsed: number | null = null;
  let storageQuota: number | null = null;
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const est = await navigator.storage.estimate();
      storageUsed = est.usage ?? null;
      storageQuota = est.quota ?? null;
    } catch {
      // ignore
    }
  }

  let iosBannerDismissed = false;
  try {
    iosBannerDismissed = !!localStorage.getItem("pwa-install-banner-dismissed-at");
  } catch {
    // ignore
  }

  return {
    isStandalone: !!isStandalone,
    isIframe,
    online: navigator.onLine,
    swRegistered,
    swScope,
    swState,
    cacheCount: cacheNames.length,
    cacheNames,
    storageUsed,
    storageQuota,
    iosBannerDismissed,
    lastChecked: new Date(),
  };
}

function PwaStatusCard() {
  const [state, setState] = useState<PwaState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setState(await readPwaState());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const checkUpdate = async () => {
    setBusy("update");
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.update()));
      }
      // Bump version.json fetch to surface new build banner if any.
      await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" }).catch(() => null);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const clearCaches = async () => {
    if (!confirm("브라우저 캐시를 모두 삭제하시겠습니까? 다음 페이지 로드는 느려질 수 있습니다.")) return;
    setBusy("cache");
    try {
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const unregisterSW = async () => {
    if (!confirm("Service Worker 등록을 해제하시겠습니까? 페이지 새로고침이 필요합니다.")) return;
    setBusy("sw");
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  if (!state) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          PWA 상태를 확인하는 중…
        </CardContent>
      </Card>
    );
  }

  const usagePct =
    state.storageUsed != null && state.storageQuota
      ? (state.storageUsed / state.storageQuota) * 100
      : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" aria-hidden /> PWA 상태
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={refresh} className="rounded-full">
          <RefreshCw className="h-4 w-4 mr-1" aria-hidden />
          새로고침
        </Button>
      </CardHeader>
      <CardContent className="space-y-0">
        {state.isIframe && (
          <div className="mb-4 flex items-start gap-2 rounded border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
            <span>
              현재 미리보기(iframe) 환경입니다. PWA Service Worker는 배포된 도메인에서만 동작합니다.
            </span>
          </div>
        )}

        <PwaRow
          icon={state.isStandalone ? "ok" : "off"}
          label="설치 여부"
          value={state.isStandalone ? "설치됨 (Standalone 모드)" : "브라우저에서 실행 중 (미설치)"}
        />
        <PwaRow
          icon={state.online ? "ok" : "warn"}
          label="네트워크 상태"
          value={state.online ? "온라인" : "오프라인"}
        />
        <PwaRow
          icon={state.swRegistered ? "ok" : "off"}
          label="Service Worker"
          value={
            state.swRegistered
              ? `등록됨 (${state.swState ?? "active"})`
              : "미등록"
          }
        />
        {state.swScope && (
          <PwaRow label="SW Scope" value={<code className="text-xs">{state.swScope}</code>} />
        )}
        <PwaRow
          label="마지막 업데이트 확인"
          value={state.lastChecked.toLocaleString("ko-KR")}
        />
        <PwaRow
          label="iOS 설치 안내 배너"
          value={state.iosBannerDismissed ? "해제됨 (사용자가 닫음)" : "표시 가능"}
        />
        <PwaRow
          label="오프라인 캐시"
          value={
            state.cacheCount > 0
              ? `${state.cacheCount}개 캐시 저장소`
              : "캐시 없음"
          }
        />
        <PwaRow
          label="브라우저 저장소 사용량"
          value={
            <span className="inline-flex items-center gap-2">
              <Database className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              {formatBytes(state.storageUsed)} / {formatBytes(state.storageQuota)}
              {usagePct != null && (
                <span className="text-xs text-muted-foreground">
                  ({usagePct.toFixed(2)}% 사용)
                </span>
              )}
            </span>
          }
        />

        <div className="flex flex-wrap gap-2 pt-4 mt-2 border-t border-border/60">
          <Button
            variant="outline"
            size="sm"
            onClick={checkUpdate}
            disabled={busy !== null}
            className="rounded-full"
          >
            <RefreshCw className="h-4 w-4 mr-1" aria-hidden />
            업데이트 확인
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearCaches}
            disabled={busy !== null || state.cacheCount === 0}
            className="rounded-full"
          >
            <Trash2 className="h-4 w-4 mr-1" aria-hidden />
            캐시 삭제
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={unregisterSW}
            disabled={busy !== null || !state.swRegistered}
            className="rounded-full"
          >
            <XCircle className="h-4 w-4 mr-1" aria-hidden />
            SW 등록 해제
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PwaRow({
  icon,
  label,
  value,
}: {
  icon?: "ok" | "off" | "warn";
  label: string;
  value: React.ReactNode;
}) {
  const Icon =
    icon === "ok" ? CheckCircle2 : icon === "warn" ? AlertCircle : icon === "off" ? XCircle : null;
  const iconColor =
    icon === "ok"
      ? "text-emerald-600"
      : icon === "warn"
      ? "text-amber-600"
      : "text-muted-foreground";
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 border-b border-border/60 py-3 last:border-0">
      <span className="font-medium whitespace-nowrap min-w-[200px] flex items-center gap-2">
        {Icon && <Icon className={`h-4 w-4 ${iconColor}`} aria-hidden />}
        {label}
      </span>
      <span className="text-sm text-muted-foreground">{value}</span>
    </div>
  );
}