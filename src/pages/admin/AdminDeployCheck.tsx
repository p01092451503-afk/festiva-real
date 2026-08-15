import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Rocket,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  KeyRound,
  Database,
  History,
  Activity,
} from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";

/**
 * 배포 전 최종 체크리스트
 * - 환경변수: 프론트엔드 빌드에 주입된 필수 환경변수 존재/형식 확인
 * - 마이그레이션: 저장소 마이그레이션 파일과 실제 DB 스키마(주요 테이블) 접근 확인
 * - 롤백 가능성: 롤백 절차 및 위험 요소 점검
 * - 주요 API 호출: 핵심 테이블/엣지 함수 실호출 응답 확인
 */

type CheckStatus = "pass" | "warn" | "fail" | "pending";

interface CheckResult {
  id: string;
  label: string;
  detail: string;
  status: CheckStatus;
  durationMs?: number;
}

/** 저장소에 포함된 마이그레이션 파일 목록 (빌드 타임에 수집) */
const migrationFiles = Object.keys(
  import.meta.glob("/supabase/migrations/*.sql", { query: "?raw", eager: false })
).sort();

/** 배포 전 반드시 응답해야 하는 주요 테이블 */
const CRITICAL_TABLES = [
  "profiles",
  "user_roles",
  "courses",
  "enrollments",
  "orders",
  "lesson_progress",
] as const;

/** 배포 전 확인할 주요 엣지 함수 (OPTIONS/POST 헬스 체크) */
const CRITICAL_FUNCTIONS = ["ai-study-plan", "create-user"] as const;

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "pass") return <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />;
  if (status === "warn") return <AlertTriangle className="h-4 w-4 text-muted-foreground" aria-hidden />;
  if (status === "fail") return <XCircle className="h-4 w-4 text-destructive" aria-hidden />;
  return <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" aria-hidden />;
}

function StatusBadge({ status }: { status: CheckStatus }) {
  const map: Record<CheckStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pass: { label: "정상", variant: "default" },
    warn: { label: "확인 필요", variant: "secondary" },
    fail: { label: "실패", variant: "destructive" },
    pending: { label: "검사 중", variant: "outline" },
  };
  const cfg = map[status];
  return <Badge variant={cfg.variant} className="whitespace-nowrap">{cfg.label}</Badge>;
}

function CheckRow({ result }: { result: CheckResult }) {
  return (
    <li className="flex items-start gap-3 py-3 border-b-2 border-border/80 last:border-b-0 min-w-0">
      <span className="mt-0.5 shrink-0">
        <StatusIcon status={result.status} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{result.label}</p>
        <p className="text-sm text-muted-foreground break-words">{result.detail}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {typeof result.durationMs === "number" && (
          <span className="text-xs text-muted-foreground tabular-nums">{result.durationMs}ms</span>
        )}
        <StatusBadge status={result.status} />
      </div>
    </li>
  );
}

function SummaryCard({ title, results, icon: Icon }: { title: string; results: CheckResult[]; icon: React.ElementType }) {
  const fail = results.filter((r) => r.status === "fail").length;
  const warn = results.filter((r) => r.status === "warn").length;
  const pending = results.filter((r) => r.status === "pending").length;
  const status: CheckStatus = fail ? "fail" : pending ? "pending" : warn ? "warn" : "pass";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
            <span className="text-sm font-medium truncate">{title}</span>
          </div>
          <StatusBadge status={status} />
        </div>
        <p className="text-2xl font-semibold mt-3 tabular-nums">
          {results.filter((r) => r.status === "pass").length}
          <span className="text-base text-muted-foreground"> / {results.length}</span>
        </p>
      </CardContent>
    </Card>
  );
}

export default function AdminDeployCheck() {
  const { isAdmin, isSuperAdmin } = useUserRole();
  const [running, setRunning] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null);
  const [dbChecks, setDbChecks] = useState<CheckResult[]>([]);
  const [apiChecks, setApiChecks] = useState<CheckResult[]>([]);

  const activeRole = (() => {
    try {
      return typeof window !== "undefined" ? localStorage.getItem("nf-active-role") : null;
    } catch {
      return null;
    }
  })();

  /** 환경변수 점검 — 빌드에 주입된 값만 검사 (비밀키는 노출하지 않음) */
  const envChecks: CheckResult[] = useMemo(() => {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;
    const mask = (v?: string) => (v ? `${v.slice(0, 6)}…${v.slice(-4)} (${v.length}자)` : "미설정");

    return [
      {
        id: "env-url",
        label: "백엔드 API 주소 (VITE_SUPABASE_URL)",
        detail: url ? `${url}` : "값이 없습니다. 배포 환경 변수 설정을 확인하세요.",
        status: url && /^https:\/\//.test(url) ? "pass" : "fail",
      },
      {
        id: "env-key",
        label: "공개 API 키 (VITE_SUPABASE_PUBLISHABLE_KEY)",
        detail: key ? `설정됨 · ${mask(key)}` : "값이 없습니다. 클라이언트가 백엔드에 접속할 수 없습니다.",
        status: key && key.length > 40 ? "pass" : "fail",
      },
      {
        id: "env-project",
        label: "프로젝트 식별자 (VITE_SUPABASE_PROJECT_ID)",
        detail: projectId ? "설정됨" : "값이 없습니다. 일부 기능에서 참조할 수 있습니다.",
        status: projectId ? "pass" : "warn",
      },
      {
        id: "env-mode",
        label: "빌드 모드",
        detail: import.meta.env.PROD
          ? "production 빌드입니다. 개발용 로그/디버그 코드가 제외됩니다."
          : "development 빌드입니다. 실제 배포본에서 다시 확인하세요.",
        status: import.meta.env.PROD ? "pass" : "warn",
      },
      {
        id: "env-https",
        label: "HTTPS 서빙",
        detail:
          typeof window !== "undefined"
            ? `${window.location.protocol}//${window.location.host}`
            : "확인 불가",
        status:
          typeof window !== "undefined" &&
          (window.location.protocol === "https:" || window.location.hostname === "localhost")
            ? "pass"
            : "fail",
      },
    ];
  }, []);

  /** 롤백 가능성 점검 — 저장소 이력 기반 정적 점검 */
  const rollbackChecks: CheckResult[] = useMemo(() => {
    const latest = migrationFiles[migrationFiles.length - 1]?.split("/").pop() ?? "없음";
    const stamp = latest.slice(0, 14);
    const readable =
      stamp.length === 14
        ? `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)} ${stamp.slice(8, 10)}:${stamp.slice(10, 12)}`
        : "알 수 없음";
    return [
      {
        id: "rb-history",
        label: "마이그레이션 이력 보존",
        detail: `${migrationFiles.length}개의 마이그레이션 파일이 저장소에 기록되어 있어 변경 이력 추적이 가능합니다.`,
        status: migrationFiles.length > 0 ? "pass" : "fail",
      },
      {
        id: "rb-latest",
        label: "최근 스키마 변경 시점",
        detail: `${readable} (${latest})`,
        status: "pass",
      },
      {
        id: "rb-frontend",
        label: "프론트엔드 롤백",
        detail: "배포 이력에서 이전 버전으로 재배포하면 즉시 롤백됩니다. 소요 시간 약 1분.",
        status: "pass",
      },
      {
        id: "rb-db",
        label: "데이터베이스 롤백",
        detail:
          "컬럼/테이블 삭제(DROP)는 자동 롤백이 불가능합니다. 이번 배포에 파괴적 변경이 포함됐다면 사전 백업 후 진행하세요.",
        status: "warn",
      },
      {
        id: "rb-backup",
        label: "배포 직전 백업",
        detail: "배포 시작 전 데이터베이스 스냅샷을 확보했는지 담당자가 확인해야 합니다.",
        status: "warn",
      },
    ];
  }, []);

  const runLiveChecks = useCallback(async () => {
    setRunning(true);
    setDbChecks(
      CRITICAL_TABLES.map((t) => ({ id: `db-${t}`, label: `${t} 테이블`, detail: "조회 중…", status: "pending" }))
    );
    setApiChecks([]);

    // 마이그레이션 적용 여부 = 주요 테이블 실제 응답 확인
    const dbResults: CheckResult[] = [];
    for (const table of CRITICAL_TABLES) {
      const started = performance.now();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from(table).select("*", { count: "exact", head: true }).limit(1);
      const durationMs = Math.round(performance.now() - started);
      dbResults.push({
        id: `db-${table}`,
        label: `${table} 테이블`,
        detail: error
          ? `응답 오류: ${error.message}`
          : "스키마가 적용되어 있으며 정상 응답합니다.",
        status: error ? (error.message.includes("permission") ? "warn" : "fail") : "pass",
        durationMs,
      });
      setDbChecks([...dbResults]);
    }

    // 주요 API 호출 — 인증 세션 + 엣지 함수 응답
    const apiResults: CheckResult[] = [];
    const sessionStart = performance.now();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    apiResults.push({
      id: "api-session",
      label: "인증 세션 조회 (auth.getSession)",
      detail: sessionError
        ? `오류: ${sessionError.message}`
        : sessionData.session
          ? "로그인 세션이 정상적으로 유지되고 있습니다."
          : "세션이 없습니다. 로그인 상태에서 다시 확인하세요.",
      status: sessionError ? "fail" : sessionData.session ? "pass" : "warn",
      durationMs: Math.round(performance.now() - sessionStart),
    });
    setApiChecks([...apiResults]);

    const baseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    for (const fn of CRITICAL_FUNCTIONS) {
      const started = performance.now();
      let status: CheckStatus = "fail";
      let detail = "응답 없음";
      try {
        const res = await fetch(`${baseUrl}/functions/v1/${fn}`, { method: "OPTIONS" });
        detail = `HTTP ${res.status} · 함수가 배포되어 있습니다.`;
        status = res.status < 500 ? "pass" : "fail";
        if (res.status === 404) {
          detail = "HTTP 404 · 함수가 배포되지 않았습니다.";
          status = "fail";
        }
      } catch (e) {
        detail = `호출 실패: ${e instanceof Error ? e.message : String(e)}`;
      }
      apiResults.push({
        id: `api-${fn}`,
        label: `엣지 함수 ${fn}`,
        detail,
        status,
        durationMs: Math.round(performance.now() - started),
      });
      setApiChecks([...apiResults]);
    }

    setLastRunAt(new Date());
    setRunning(false);
  }, []);

  useEffect(() => {
    if (isAdmin || isSuperAdmin) void runLiveChecks();
  }, [isAdmin, isSuperAdmin, runLiveChecks]);

  if (!isAdmin && !isSuperAdmin) return <Navigate to="/dashboard" replace />;
  if (activeRole && activeRole !== "admin") {
    return <Navigate to={activeRole === "teacher" ? "/teacher" : "/student"} replace />;
  }

  const allResults = [...envChecks, ...dbChecks, ...rollbackChecks, ...apiChecks];
  const failCount = allResults.filter((r) => r.status === "fail").length;
  const warnCount = allResults.filter((r) => r.status === "warn").length;

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
              <Rocket className="h-6 w-6" aria-hidden />
              배포 전 최종 체크리스트
            </h1>
            <p className="text-muted-foreground mt-1">
              환경변수, 마이그레이션 적용 여부, 롤백 가능성, 주요 API 호출을 한 화면에서 점검합니다.
            </p>
          </div>
          <Button onClick={() => void runLiveChecks()} disabled={running} className="shrink-0">
            <RefreshCw className={`h-4 w-4 mr-2 ${running ? "animate-spin" : ""}`} aria-hidden />
            다시 검사
          </Button>
        </header>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-3">
              {failCount > 0 ? (
                <Badge variant="destructive">배포 보류 권장 · 실패 {failCount}건</Badge>
              ) : warnCount > 0 ? (
                <Badge variant="secondary">확인 필요 {warnCount}건</Badge>
              ) : (
                <Badge>모든 항목 정상 · 배포 가능</Badge>
              )}
              <span className="text-sm text-muted-foreground">
                총 {allResults.length}개 항목
                {lastRunAt && ` · 마지막 검사 ${lastRunAt.toLocaleString("ko-KR")}`}
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title="환경변수" results={envChecks} icon={KeyRound} />
          <SummaryCard title="마이그레이션" results={dbChecks} icon={Database} />
          <SummaryCard title="롤백 가능성" results={rollbackChecks} icon={History} />
          <SummaryCard title="주요 API" results={apiChecks} icon={Activity} />
        </div>

        <Tabs defaultValue="env" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 max-w-3xl">
            <TabsTrigger value="env">환경변수</TabsTrigger>
            <TabsTrigger value="migration">마이그레이션</TabsTrigger>
            <TabsTrigger value="rollback">롤백</TabsTrigger>
            <TabsTrigger value="api">주요 API</TabsTrigger>
          </TabsList>

          <TabsContent value="env" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">환경변수 점검</CardTitle>
              </CardHeader>
              <CardContent>
                <ul>{envChecks.map((r) => <CheckRow key={r.id} result={r} />)}</ul>
                <p className="text-xs text-muted-foreground mt-4">
                  비밀키(서비스 키 등)는 서버에서만 사용되며 이 화면에 표시되지 않습니다.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="migration" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  마이그레이션 적용 여부 · 파일 {migrationFiles.length}개
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul>
                  {dbChecks.length === 0 ? (
                    <li className="py-3 text-sm text-muted-foreground">검사 준비 중…</li>
                  ) : (
                    dbChecks.map((r) => <CheckRow key={r.id} result={r} />)
                  )}
                </ul>
                <p className="text-xs text-muted-foreground mt-4">
                  주요 테이블에 실제 조회 요청을 보내 스키마 반영 여부를 확인합니다. 권한 오류는 스키마는 존재하지만
                  접근 정책 확인이 필요한 상태입니다.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rollback" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">롤백 가능성 점검</CardTitle>
              </CardHeader>
              <CardContent>
                <ul>{rollbackChecks.map((r) => <CheckRow key={r.id} result={r} />)}</ul>
                <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                  <p>1. 프론트엔드: 배포 이력에서 직전 버전 재배포</p>
                  <p>2. 백엔드: 역방향 마이그레이션 작성 후 적용</p>
                  <p>3. 데이터: 배포 직전 스냅샷에서 복구</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">주요 API 호출 점검</CardTitle>
              </CardHeader>
              <CardContent>
                <ul>
                  {apiChecks.length === 0 ? (
                    <li className="py-3 text-sm text-muted-foreground">검사 준비 중…</li>
                  ) : (
                    apiChecks.map((r) => <CheckRow key={r.id} result={r} />)
                  )}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
