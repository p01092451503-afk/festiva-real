import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Layers,
  Users,
  ClipboardCheck,
  BarChart3,
  Building2,
  ShieldCheck,
  Activity,
  TrendingUp,
  Trophy,
  AlertTriangle,
  GraduationCap,
  Clock,
  ArrowRight,
} from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useBranchAdmin, BranchCapability } from "@/hooks/useBranchAdmin";
import { supabase } from "@/integrations/supabase/client";
import { RichStatCard } from "@/components/admin/stats/RichStatCard";

const BranchAdminDashboard = () => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const { branches, branchIds, capabilitiesForBranch, isLoading } = useBranchAdmin();

  // Resolve all department ids belonging to managed branches (branch + child teams)
  const { data: deptIds = [] } = useQuery({
    queryKey: ["branch-admin-dash-deptids", branchIds],
    enabled: branchIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("departments")
        .select("id")
        .or(
          `id.in.(${branchIds.join(",")}),parent_department_id.in.(${branchIds.join(",")})`,
        );
      return (data ?? []).map((d: any) => d.id as string);
    },
  });

  // Aggregated insights — staff, enrollments, sessions, mandatory courses
  const { data: insights } = useQuery({
    queryKey: ["branch-admin-dash-insights", deptIds],
    enabled: deptIds.length > 0,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const since30 = new Date();
      since30.setDate(since30.getDate() - 30);
      const since7 = new Date();
      since7.setDate(since7.getDate() - 7);
      const today = new Date().toISOString().slice(0, 10);

      // 1. Staff in scope
      const { data: staffRows } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("department_id", deptIds);
      const staff = staffRows ?? [];
      const userIds = staff.map((s: any) => s.user_id);

      if (userIds.length === 0) {
        return {
          staff,
          tracksCount: 0,
          enrollments: [] as any[],
          activeIds: new Set<string>(),
          dailyActive: [] as number[],
          mandatoryAtRisk: 0,
        };
      }

      // 2. Tracks targeted at branches
      const { count: tracksCount } = await supabase
        .from("learning_tracks")
        .select("id", { count: "exact", head: true })
        .eq("target_scope", "targeted")
        .overlaps("target_branch_ids", branchIds);

      // 3. Enrollments (with course meta to compute mandatory at-risk)
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("user_id, course_id, progress, enrolled_at, completed_at, status")
        .in("user_id", userIds);

      const courseIds = Array.from(
        new Set((enrollments ?? []).map((e: any) => e.course_id).filter(Boolean)),
      ) as string[];
      let courseMap = new Map<string, { mandatory: boolean; deadline: string | null }>();
      if (courseIds.length > 0) {
        const { data: courses } = await supabase
          .from("courses")
          .select("id, is_mandatory, deadline")
          .in("id", courseIds);
        (courses ?? []).forEach((c: any) =>
          courseMap.set(c.id, { mandatory: !!c.is_mandatory, deadline: c.deadline ?? null }),
        );
      }
      const mandatoryAtRisk = (enrollments ?? []).filter((e: any) => {
        const c = courseMap.get(e.course_id);
        return c?.mandatory && c.deadline && c.deadline < today && !e.completed_at;
      }).length;

      // 4. Sessions over the last 30 days for daily active sparkline + active 7d set
      const { data: sessions } = await supabase
        .from("user_sessions")
        .select("user_id, login_at")
        .in("user_id", userIds)
        .gte("login_at", since30.toISOString());

      // Daily active counts across last 14 days for sparkline
      const sparkDays = 14;
      const dailyMap = new Map<string, Set<string>>();
      for (let i = sparkDays - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dailyMap.set(d.toISOString().slice(0, 10), new Set());
      }
      const activeIds = new Set<string>();
      (sessions ?? []).forEach((s: any) => {
        const day = String(s.login_at).slice(0, 10);
        dailyMap.get(day)?.add(s.user_id);
        if (new Date(s.login_at) >= since7) activeIds.add(s.user_id);
      });
      const dailyActive = Array.from(dailyMap.values()).map((set) => set.size);

      return {
        staff,
        tracksCount: tracksCount ?? 0,
        enrollments: enrollments ?? [],
        activeIds,
        dailyActive,
        mandatoryAtRisk,
      };
    },
  });

  // Derived metrics
  const metrics = useMemo(() => {
    if (!insights) {
      return {
        totalStaff: 0,
        activeStaff: 0,
        activeRate: 0,
        avgProgress: 0,
        completionRate: 0,
        completedCount: 0,
        totalEnroll: 0,
        newEnroll7d: 0,
        completed7d: 0,
        atRisk: 0,
        tracksCount: 0,
        dailyActive: [] as number[],
      };
    }
    const since7 = new Date();
    since7.setDate(since7.getDate() - 7);
    const since7Iso = since7.toISOString();
    const totalStaff = insights.staff.length;
    const activeStaff = insights.activeIds.size;
    const totalEnroll = insights.enrollments.length;
    const completed = insights.enrollments.filter((e: any) => !!e.completed_at);
    const completedCount = completed.length;
    const completionRate =
      totalEnroll === 0 ? 0 : Math.round((completedCount / totalEnroll) * 100);
    const avgProgress =
      totalEnroll === 0
        ? 0
        : Math.round(
            insights.enrollments.reduce(
              (s: number, e: any) => s + Number(e.progress ?? 0),
              0,
            ) / totalEnroll,
          );
    const newEnroll7d = insights.enrollments.filter(
      (e: any) => e.enrolled_at && e.enrolled_at >= since7Iso,
    ).length;
    const completed7d = completed.filter(
      (e: any) => e.completed_at && e.completed_at >= since7Iso,
    ).length;

    return {
      totalStaff,
      activeStaff,
      activeRate: totalStaff === 0 ? 0 : Math.round((activeStaff / totalStaff) * 100),
      avgProgress,
      completionRate,
      completedCount,
      totalEnroll,
      newEnroll7d,
      completed7d,
      atRisk: insights.mandatoryAtRisk,
      tracksCount: insights.tracksCount,
      dailyActive: insights.dailyActive,
    };
  }, [insights]);

  // Top performers (avg progress per user)
  const learners = useMemo(() => {
    if (!insights) return [] as { id: string; name: string; progress: number; completed: number; total: number }[];
    const byUser = new Map<string, { sum: number; n: number; completed: number }>();
    insights.enrollments.forEach((e: any) => {
      const cur = byUser.get(e.user_id) || { sum: 0, n: 0, completed: 0 };
      cur.sum += Number(e.progress ?? 0);
      cur.n += 1;
      if (e.completed_at) cur.completed += 1;
      byUser.set(e.user_id, cur);
    });
    return insights.staff
      .map((s: any) => {
        const v = byUser.get(s.user_id);
        return {
          id: s.user_id,
          name: s.full_name || s.email || "—",
          progress: v ? Math.round(v.sum / v.n) : 0,
          completed: v?.completed ?? 0,
          total: v?.n ?? 0,
        };
      })
      .filter((u) => u.total > 0)
      .sort((a, b) => b.progress - a.progress);
  }, [insights]);

  const topLearners = learners.slice(0, 5);
  const atRiskLearners = [...learners]
    .filter((u) => u.progress < 50)
    .sort((a, b) => a.progress - b.progress)
    .slice(0, 5);

  const capabilityLabels: Record<BranchCapability, string> = {
    track_manage: t("branchAdminCap.track_manage", "트랙 관리"),
    staff_manage: t("branchAdminCap.staff_manage", "회원 관리"),
    track_assign: t("branchAdminCap.track_assign", "트랙 배정"),
    stats_view: t("branchAdminCap.stats_view", "통계 조회"),
  };

  const quickLinks: {
    href: string;
    icon: typeof Layers;
    label: string;
    cap: BranchCapability;
    desc: string;
  }[] = [
    {
      href: "/branch-admin/tracks",
      icon: Layers,
      label: t("nav.branchAdminTracks", "지점 트랙 관리"),
      cap: "track_manage",
      desc: t("branchAdminDash.linkDesc.tracks", "지점 전용 트랙을 만들고 관리합니다."),
    },
    {
      href: "/branch-admin/staff",
      icon: Users,
      label: t("nav.branchAdminStaff", "지점 회원 관리"),
      cap: "staff_manage",
      desc: t("branchAdminDash.linkDesc.staff", "회원 정보와 소속을 관리합니다."),
    },
    {
      href: "/branch-admin/assignments",
      icon: ClipboardCheck,
      label: t("nav.branchAdminAssign", "트랙 배정"),
      cap: "track_assign",
      desc: t("branchAdminDash.linkDesc.assign", "회원에게 트랙과 강의를 배정합니다."),
    },
    {
      href: "/branch-admin/stats",
      icon: BarChart3,
      label: t("nav.branchAdminStats", "지점 학습 통계"),
      cap: "stats_view",
      desc: t("branchAdminDash.linkDesc.stats", "지점 학습 현황을 시각화로 확인합니다."),
    },
  ];

  return (
    <DashboardLayout role="branch_admin">
      <div className="min-w-0 space-y-6 p-4 sm:p-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-semibold">
              <ShieldCheck className="h-6 w-6 text-primary" />
              {t("branchAdminDash.title", "지점 관리자 대시보드")}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t(
                "branchAdminDash.subtitle",
                "담당 지점의 학습 현황과 핵심 지표를 한눈에 확인하세요.",
              )}
            </p>
          </div>
          {branches.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              <span className="tabular-nums">
                {t("branchAdminDash.managing", "담당")} {branches.length}{" "}
                {t("common.branches", "지점")}
              </span>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="text-muted-foreground">{t("common.loading", "불러오는 중...")}</div>
        ) : branches.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 border-2 border-dashed border-border/60 rounded-lg">
            {t(
              "branchAdminDash.noBranches",
              "할당된 지점이 없습니다. 본사 관리자에게 문의해주세요.",
            )}
          </div>
        ) : (
          <>
            {/* KPI Grid — RichStatCard with sparkline / ring / bar visualization */}
            <section className="space-y-3">
              <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t("branchAdminDash.kpiTitle", "핵심 지표")}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3">
                <RichStatCard
                  label={t("branchAdminDash.kpi.totalStaff", "담당 회원")}
                  value={metrics.totalStaff}
                  sub={`${t("common.people", "명")} · ${branches.length} ${t("common.branches", "지점")}`}
                  icon={Users}
                  tone="indigo"
                  visual="none"
                />
                <RichStatCard
                  label={t("branchAdminDash.kpi.activeStaff", "활성 학습자 (7일)")}
                  value={`${metrics.activeStaff}`}
                  sub={`${metrics.activeRate}% ${t("branchAdminDash.kpi.ofTotal", "참여")}`}
                  icon={Activity}
                  tone="emerald"
                  visual="ring"
                  ringValue={metrics.activeRate}
                />
                <RichStatCard
                  label={t("branchAdminDash.kpi.avgProgress", "평균 진도")}
                  value={`${metrics.avgProgress}%`}
                  sub={`${metrics.totalEnroll.toLocaleString()} ${t("common.cases", "건")}`}
                  icon={TrendingUp}
                  tone="sky"
                  visual="bar"
                  barValue={metrics.avgProgress}
                />
                <RichStatCard
                  label={t("branchAdminDash.kpi.completion", "이수율")}
                  value={`${metrics.completionRate}%`}
                  sub={`${metrics.completedCount}/${metrics.totalEnroll} ${t("common.completed", "완료")}`}
                  icon={Trophy}
                  tone="amber"
                  visual="bar"
                  barValue={metrics.completionRate}
                />
                <RichStatCard
                  label={t("branchAdminDash.kpi.recentActivity", "일별 활성 (14일)")}
                  value={
                    metrics.dailyActive.length > 0
                      ? Math.round(
                          metrics.dailyActive.reduce((a, b) => a + b, 0) /
                            metrics.dailyActive.length,
                        )
                      : 0
                  }
                  sub={t("branchAdminDash.kpi.dailyAvg", "일평균 로그인")}
                  icon={Clock}
                  tone="violet"
                  visual="sparkline"
                  sparklineValues={metrics.dailyActive}
                />
                <RichStatCard
                  label={t("branchAdminDash.kpi.atRisk", "필수강의 기한 초과")}
                  value={metrics.atRisk}
                  sub={t("branchAdminDash.kpi.atRiskSub", "즉시 독려 필요")}
                  icon={AlertTriangle}
                  tone={metrics.atRisk > 0 ? "rose" : "slate"}
                  visual="none"
                  href={metrics.atRisk > 0 ? "/branch-admin/stats" : undefined}
                />
              </div>
            </section>

            {/* Branches with capabilities + 7-day pulse */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-4 py-2 border-b border-border/60 bg-muted/30">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("branchAdminDash.myBranches", "담당 지점")}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {branches.length} {t("common.branches", "지점")}
                  </span>
                </div>
                <div className="divide-y divide-border/60">
                  {branches.map((b) => {
                    const caps = capabilitiesForBranch(b.id);
                    return (
                      <div
                        key={b.id}
                        className="px-4 py-3 flex items-center justify-between gap-3 min-w-0"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 shrink-0">
                            <Building2 className="h-3.5 w-3.5" />
                          </span>
                          <span className="font-semibold text-sm truncate">
                            {isEn ? b.name_en || b.name : b.name}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 justify-end">
                          {caps.length === 0 ? (
                            <span className="text-[10px] text-muted-foreground">
                              {t("branchAdminDash.noCaps", "권한 없음")}
                            </span>
                          ) : (
                            caps.map((c) => (
                              <Badge
                                key={c}
                                variant="secondary"
                                className="text-[10px] py-0 px-1.5"
                              >
                                {capabilityLabels[c]}
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-border/60 bg-muted/20 px-4 py-1.5 text-[10px] text-muted-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {t("branchAdminDash.assignmentScope", "회원 + 트랙 권한 범위")}
                  </span>
                  <span className="tabular-nums">
                    {metrics.tracksCount} {t("branchAdminDash.tracksTargeted", "지정 트랙")}
                  </span>
                </div>
              </div>

              {/* 7-day pulse summary */}
              <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-4 py-2 border-b border-border/60 bg-muted/30">
                  <div className="flex items-center gap-1.5">
                    <Activity className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("branchAdminDash.weeklyPulse", "최근 7일 활동")}
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-border/60">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <GraduationCap className="h-3.5 w-3.5 text-muted-foreground/70" />
                      <span>{t("branchAdminDash.newEnroll7d", "신규 수강")}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-bold text-foreground tabular-nums">
                        {metrics.newEnroll7d.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {t("common.cases", "건")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Trophy className="h-3.5 w-3.5 text-muted-foreground/70" />
                      <span>{t("branchAdminDash.completed7d", "완료")}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-bold text-foreground tabular-nums">
                        {metrics.completed7d.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {t("common.cases", "건")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-3.5 w-3.5 text-muted-foreground/70" />
                      <span>{t("branchAdminDash.activeRate", "참여율")}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-bold text-foreground tabular-nums">
                        {metrics.activeRate}
                      </span>
                      <span className="text-[11px] text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>
                <div className="border-t border-border/60 bg-muted/20 px-4 py-1.5 text-[10px] text-muted-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {t("stats.refreshInterval", "갱신 주기")} 2m
                  </span>
                  <Link
                    to="/branch-admin/stats"
                    className="hover:text-foreground transition-colors flex items-center gap-0.5"
                  >
                    {t("branchAdminDash.viewStats", "전체 통계")}
                    <ArrowRight className="h-2.5 w-2.5" />
                  </Link>
                </div>
              </div>
            </section>

            {/* Top performers + at-risk learners */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <LearnerListCard
                title={t("branchAdminDash.topLearners", "학습 우수자 TOP 5")}
                icon={<Trophy className="h-4 w-4 text-amber-500" />}
                rows={topLearners}
                emptyLabel={t("common.noData", "데이터가 없습니다.")}
                emphasis="emerald"
              />
              <LearnerListCard
                title={t("branchAdminDash.atRiskLearners", "독려 필요 학습자")}
                icon={<AlertTriangle className="h-4 w-4 text-rose-500" />}
                rows={atRiskLearners}
                emptyLabel={t("branchAdminDash.allOnTrack", "모두 정상 진행 중입니다.")}
                emphasis="rose"
              />
            </section>

            {/* Quick actions — colored tone cards */}
            <section className="space-y-3">
              <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t("branchAdminDash.quickActions", "빠른 메뉴")}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {quickLinks.map((link, idx) => {
                  const Icon = link.icon;
                  const enabled = branchIds.some((bid) =>
                    capabilitiesForBranch(bid).includes(link.cap),
                  );
                  const tones = ["indigo", "emerald", "violet", "sky"] as const;
                  const tone = tones[idx % tones.length];
                  return (
                    <Link
                      key={link.href}
                      to={enabled ? link.href : "#"}
                      className={`group relative rounded-xl border border-border bg-card p-4 transition-all ${
                        enabled
                          ? "hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5"
                          : "opacity-50 pointer-events-none"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span
                          className={`inline-flex items-center justify-center h-9 w-9 rounded-lg ${
                            tone === "indigo"
                              ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                              : tone === "emerald"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                              : tone === "violet"
                              ? "bg-violet-500/10 text-violet-600 dark:text-violet-300"
                              : "bg-sky-500/10 text-sky-600 dark:text-sky-300"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <div className="text-sm font-semibold leading-tight">{link.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-1 leading-snug">
                        {link.desc}
                      </div>
                      {!enabled && (
                        <Badge variant="outline" className="text-[10px] mt-2">
                          {t("branchAdminDash.locked", "권한 없음")}
                        </Badge>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

/* ----- Learner mini list card ----- */
const LearnerListCard = ({
  title,
  icon,
  rows,
  emptyLabel,
  emphasis,
}: {
  title: string;
  icon: React.ReactNode;
  rows: { id: string; name: string; progress: number; completed: number; total: number }[];
  emptyLabel: string;
  emphasis: "emerald" | "rose";
}) => {
  const barColor =
    emphasis === "emerald" ? "bg-emerald-500" : "bg-rose-500";
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/60 bg-muted/30">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">{emptyLabel}</p>
      ) : (
        <div className="divide-y divide-border/60">
          {rows.map((r, i) => (
            <div
              key={r.id}
              className="px-4 py-2.5 flex items-center gap-3 min-w-0"
            >
              <span className="w-5 text-center text-xs font-semibold text-muted-foreground tabular-nums shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{r.name}</div>
                <div className="text-[11px] text-muted-foreground truncate tabular-nums">
                  {r.completed}/{r.total} 완료
                </div>
              </div>
              <div className="w-20 sm:w-28 shrink-0">
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${barColor} rounded-full transition-all`}
                    style={{ width: `${Math.min(100, Math.max(0, r.progress))}%` }}
                  />
                </div>
              </div>
              <span className="text-xs font-semibold tabular-nums w-10 text-right shrink-0">
                {r.progress}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BranchAdminDashboard;