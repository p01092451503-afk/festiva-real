import { lazy, Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  Lock,
  Users,
  GraduationCap,
  Trophy,
  TrendingUp,
  Activity,
  AlertTriangle,
  Download,
  ClipboardCheck,
} from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { useBranchAdmin } from "@/hooks/useBranchAdmin";
import { supabase } from "@/integrations/supabase/client";
import { ChartFallback } from "@/components/PageSkeletons";

// Lazy-load chart bundle to keep this page light.
const ChartsPanel = lazy(() => import("@/components/branchAdmin/BranchStatsCharts"));

type RangeKey = "7d" | "30d" | "90d" | "all";

const RANGE_DAYS: Record<RangeKey, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: null,
};

const BranchAdminStats = () => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const { branchIds, branches, hasCapability, isLoading: loadingBA } = useBranchAdmin();
  const canView = branchIds.some((b) => hasCapability("stats_view", b));

  const [range, setRange] = useState<RangeKey>("30d");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const rangeStart = useMemo(() => {
    const d = RANGE_DAYS[range];
    if (d === null) return null;
    const dt = new Date();
    dt.setDate(dt.getDate() - d);
    return dt.toISOString();
  }, [range]);

  const activeBranchIds = useMemo(
    () => (branchFilter === "all" ? branchIds : [branchFilter]),
    [branchFilter, branchIds],
  );

  // 1. Departments (branches + their teams)
  const { data: depts = [] } = useQuery({
    queryKey: ["ba-stats-depts", activeBranchIds],
    enabled: activeBranchIds.length > 0 && canView,
    queryFn: async () => {
      const { data } = await supabase
        .from("departments")
        .select("id, name, name_en, parent_department_id")
        .or(
          `id.in.(${activeBranchIds.join(",")}),parent_department_id.in.(${activeBranchIds.join(",")})`,
        );
      return data ?? [];
    },
  });
  const deptIds = useMemo(() => depts.map((d) => d.id), [depts]);
  const deptNameById = useMemo(() => {
    const m = new Map<string, string>();
    depts.forEach((d) => m.set(d.id, (isEn && d.name_en) ? d.name_en : d.name));
    return m;
  }, [depts, isEn]);

  // 2. Staff in those departments
  const { data: staff = [] } = useQuery({
    queryKey: ["ba-stats-staff", deptIds],
    enabled: deptIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, department_id, team_name, position")
        .in("department_id", deptIds);
      return data ?? [];
    },
  });
  const userIds = useMemo(() => staff.map((s) => s.user_id), [staff]);

  // 3. Enrollments for those staff
  const { data: enrollments = [], isLoading: loadingEnroll } = useQuery({
    queryKey: ["ba-stats-enrollments", userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select("user_id, course_id, progress, enrolled_at, completed_at, status")
        .in("user_id", userIds);
      return data ?? [];
    },
  });

  // 4. Course meta for enrolled courses
  const courseIds = useMemo(
    () => Array.from(new Set(enrollments.map((e) => e.course_id))).filter(Boolean) as string[],
    [enrollments],
  );
  const { data: courses = [] } = useQuery({
    queryKey: ["ba-stats-courses", courseIds],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("id, title, is_mandatory, deadline")
        .in("id", courseIds);
      return data ?? [];
    },
  });
  const courseById = useMemo(() => {
    const m = new Map<string, { title: string; mandatory: boolean; deadline: string | null }>();
    courses.forEach((c: any) =>
      m.set(c.id, { title: c.title, mandatory: !!c.is_mandatory, deadline: c.deadline ?? null }),
    );
    return m;
  }, [courses]);

  // 5. Assessment attempts for staff (within range)
  const { data: attempts = [] } = useQuery({
    queryKey: ["ba-stats-attempts", userIds, rangeStart],
    enabled: userIds.length > 0,
    queryFn: async () => {
      let q = supabase
        .from("assessment_attempts")
        .select("user_id, passed, score, completed_at, started_at")
        .in("user_id", userIds);
      if (rangeStart) q = q.gte("started_at", rangeStart);
      const { data } = await q;
      return data ?? [];
    },
  });

  // 6. Sessions for active-learner / login frequency (within range)
  const { data: sessions = [] } = useQuery({
    queryKey: ["ba-stats-sessions", userIds, rangeStart],
    enabled: userIds.length > 0,
    queryFn: async () => {
      let q = supabase
        .from("user_sessions")
        .select("user_id, login_at")
        .in("user_id", userIds);
      if (rangeStart) q = q.gte("login_at", rangeStart);
      const { data } = await q;
      return data ?? [];
    },
  });

  // ---- Aggregations ----

  // Filter enrollments by range (for "new in period" counts) but keep all for cumulative metrics.
  const enrollmentsInRange = useMemo(() => {
    if (!rangeStart) return enrollments;
    return enrollments.filter((e: any) => e.enrolled_at && e.enrolled_at >= rangeStart);
  }, [enrollments, rangeStart]);

  const completedInRange = useMemo(() => {
    if (!rangeStart) return enrollments.filter((e: any) => !!e.completed_at);
    return enrollments.filter((e: any) => e.completed_at && e.completed_at >= rangeStart);
  }, [enrollments, rangeStart]);

  // Unique active learners = user has at least one session in range.
  const activeLearnerIds = useMemo(() => {
    const s = new Set<string>();
    sessions.forEach((r: any) => s.add(r.user_id));
    return s;
  }, [sessions]);

  const summaryByUser = useMemo(() => {
    const map = new Map<
      string,
      {
        total: number;
        completed: number;
        inProgress: number;
        avgProgress: number;
        attempts: number;
        passed: number;
        avgScore: number | null;
        lastLogin: string | null;
      }
    >();
    for (const u of staff) {
      const rows = enrollments.filter((e: any) => e.user_id === u.user_id);
      const completed = rows.filter((r: any) => !!r.completed_at).length;
      const inProgress = rows.filter(
        (r: any) => !r.completed_at && Number(r.progress ?? 0) > 0,
      ).length;
      const avg =
        rows.length === 0
          ? 0
          : Math.round(
              rows.reduce((s, r: any) => s + Number(r.progress ?? 0), 0) / rows.length,
            );
      const userAttempts = attempts.filter((a: any) => a.user_id === u.user_id);
      const passed = userAttempts.filter((a: any) => a.passed).length;
      const scored = userAttempts.filter((a: any) => a.score != null);
      const avgScore =
        scored.length === 0
          ? null
          : Math.round(
              scored.reduce((s, a: any) => s + Number(a.score), 0) / scored.length,
            );
      const userSessions = sessions
        .filter((s: any) => s.user_id === u.user_id)
        .sort((a: any, b: any) => (a.login_at < b.login_at ? 1 : -1));
      map.set(u.user_id, {
        total: rows.length,
        completed,
        inProgress,
        avgProgress: avg,
        attempts: userAttempts.length,
        passed,
        avgScore,
        lastLogin: userSessions[0]?.login_at ?? null,
      });
    }
    return map;
  }, [staff, enrollments, attempts, sessions]);

  // ---- KPI ----
  const kpi = useMemo(() => {
    const totalStaff = staff.length;
    const activeStaff = activeLearnerIds.size;
    const totalEnroll = enrollments.length;
    const completed = enrollments.filter((e: any) => !!e.completed_at).length;
    const completionRate =
      totalEnroll === 0 ? 0 : Math.round((completed / totalEnroll) * 100);
    const avgProgress =
      totalEnroll === 0
        ? 0
        : Math.round(
            enrollments.reduce((s, e: any) => s + Number(e.progress ?? 0), 0) /
              totalEnroll,
          );
    const passed = attempts.filter((a: any) => a.passed).length;
    const passRate =
      attempts.length === 0 ? 0 : Math.round((passed / attempts.length) * 100);
    const newEnrollInRange = enrollmentsInRange.length;
    const completedRange = completedInRange.length;

    // Mandatory at risk: enrollments for mandatory courses past deadline & not completed
    const today = new Date().toISOString().slice(0, 10);
    const atRisk = enrollments.filter((e: any) => {
      const c = courseById.get(e.course_id);
      return (
        c?.mandatory &&
        c.deadline &&
        c.deadline < today &&
        !e.completed_at
      );
    }).length;

    return {
      totalStaff,
      activeStaff,
      activeRate: totalStaff === 0 ? 0 : Math.round((activeStaff / totalStaff) * 100),
      avgProgress,
      completionRate,
      passRate,
      newEnrollInRange,
      completedRange,
      atRisk,
    };
  }, [staff, enrollments, attempts, activeLearnerIds, enrollmentsInRange, completedInRange, courseById]);

  // ---- Course-level stats ----
  const courseStats = useMemo(() => {
    const grouped = new Map<string, { total: number; completed: number; sumProgress: number }>();
    enrollments.forEach((e: any) => {
      const g = grouped.get(e.course_id) || { total: 0, completed: 0, sumProgress: 0 };
      g.total += 1;
      if (e.completed_at) g.completed += 1;
      g.sumProgress += Number(e.progress ?? 0);
      grouped.set(e.course_id, g);
    });
    return Array.from(grouped.entries())
      .map(([cid, v]) => {
        const c = courseById.get(cid);
        return {
          id: cid,
          title: c?.title ?? "—",
          mandatory: c?.mandatory ?? false,
          enrolled: v.total,
          completed: v.completed,
          completionRate: v.total === 0 ? 0 : Math.round((v.completed / v.total) * 100),
          avgProgress: v.total === 0 ? 0 : Math.round(v.sumProgress / v.total),
        };
      })
      .sort((a, b) => b.enrolled - a.enrolled)
      .slice(0, 10);
  }, [enrollments, courseById]);

  // ---- Department breakdown (branch / team) ----
  const deptStats = useMemo(() => {
    const grouped = new Map<string, { staff: number; sumProgress: number; completed: number; total: number }>();
    staff.forEach((u: any) => {
      const d = u.department_id;
      if (!d) return;
      const g = grouped.get(d) || { staff: 0, sumProgress: 0, completed: 0, total: 0 };
      g.staff += 1;
      const sum = summaryByUser.get(u.user_id);
      if (sum) {
        g.sumProgress += sum.avgProgress;
        g.completed += sum.completed;
        g.total += sum.total;
      }
      grouped.set(d, g);
    });
    return Array.from(grouped.entries())
      .map(([id, v]) => ({
        id,
        name: deptNameById.get(id) ?? "—",
        staff: v.staff,
        avgProgress: v.staff === 0 ? 0 : Math.round(v.sumProgress / v.staff),
        completed: v.completed,
        total: v.total,
      }))
      .sort((a, b) => b.avgProgress - a.avgProgress);
  }, [staff, summaryByUser, deptNameById]);

  // ---- Top / bottom learners ----
  const rankedLearners = useMemo(() => {
    return staff
      .map((s: any) => {
        const sum = summaryByUser.get(s.user_id);
        return {
          user_id: s.user_id,
          name: s.full_name || s.email || "—",
          email: s.email,
          progress: sum?.avgProgress ?? 0,
          completed: sum?.completed ?? 0,
          total: sum?.total ?? 0,
          score: sum?.avgScore,
          lastLogin: sum?.lastLogin,
        };
      })
      .filter((u) => u.total > 0)
      .sort((a, b) => b.progress - a.progress);
  }, [staff, summaryByUser]);

  const top5 = rankedLearners.slice(0, 5);
  const bottom5 = [...rankedLearners].reverse().slice(0, 5);

  // ---- Daily completion trend ----
  const trendDays = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 30;
  const trend = useMemo(() => {
    const buckets = new Map<string, { enrolled: number; completed: number }>();
    for (let i = trendDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      buckets.set(d.toISOString().slice(0, 10), { enrolled: 0, completed: 0 });
    }
    enrollments.forEach((e: any) => {
      if (e.enrolled_at) {
        const k = String(e.enrolled_at).slice(0, 10);
        const b = buckets.get(k);
        if (b) b.enrolled += 1;
      }
      if (e.completed_at) {
        const k = String(e.completed_at).slice(0, 10);
        const b = buckets.get(k);
        if (b) b.completed += 1;
      }
    });
    return Array.from(buckets.entries()).map(([date, v]) => ({
      date: date.slice(5),
      enrolled: v.enrolled,
      completed: v.completed,
    }));
  }, [enrollments, trendDays]);

  // ---- Progress distribution ----
  const distribution = useMemo(() => {
    const buckets = [
      { label: "0%", count: 0 },
      { label: "1-25%", count: 0 },
      { label: "26-50%", count: 0 },
      { label: "51-75%", count: 0 },
      { label: "76-99%", count: 0 },
      { label: "100%", count: 0 },
    ];
    staff.forEach((u: any) => {
      const p = summaryByUser.get(u.user_id)?.avgProgress ?? 0;
      if (p === 0) buckets[0].count += 1;
      else if (p <= 25) buckets[1].count += 1;
      else if (p <= 50) buckets[2].count += 1;
      else if (p <= 75) buckets[3].count += 1;
      else if (p < 100) buckets[4].count += 1;
      else buckets[5].count += 1;
    });
    return buckets;
  }, [staff, summaryByUser]);

  // ---- Filtered staff table ----
  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(
      (s: any) =>
        (s.full_name ?? "").toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q) ||
        (s.team_name ?? "").toLowerCase().includes(q),
    );
  }, [staff, search]);

  // ---- CSV export ----
  const exportCsv = () => {
    const headers = ["이름", "이메일", "소속", "수강", "완료", "진행중", "평균진도(%)", "응시", "합격", "평균점수", "최근로그인"];
    const rows = filteredStaff.map((s: any) => {
      const sum = summaryByUser.get(s.user_id);
      return [
        s.full_name ?? "",
        s.email ?? "",
        deptNameById.get(s.department_id ?? "") ?? "",
        sum?.total ?? 0,
        sum?.completed ?? 0,
        sum?.inProgress ?? 0,
        sum?.avgProgress ?? 0,
        sum?.attempts ?? 0,
        sum?.passed ?? 0,
        sum?.avgScore ?? "",
        sum?.lastLogin ? new Date(sum.lastLogin).toLocaleString() : "",
      ];
    });
    const csv =
      "\uFEFF" +
      [headers, ...rows]
        .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
        .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `branch-stats-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loadingBA) {
    return (
      <DashboardLayout role="branch_admin">
        <div className="p-6 text-muted-foreground">{t("common.loading", "불러오는 중...")}</div>
      </DashboardLayout>
    );
  }
  if (!canView) {
    return (
      <DashboardLayout role="branch_admin">
        <div className="p-6 text-center text-muted-foreground">
          <Lock className="h-12 w-12 mx-auto mb-3 opacity-50" />
          {t("branchAdmin.noStatsPerm", "통계 조회 권한이 없습니다.")}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="branch_admin">
      <div className="min-w-0 space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-semibold">
              <BarChart3 className="h-6 w-6 text-primary" />
              {t("nav.branchAdminStats", "지점 학습 통계")}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t("branchAdminStats.subtitle", "담당 지점 회원의 수강 현황과 평균 진도입니다.")}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {branches.length > 1 && (
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all", "전체")} {t("common.branches", "지점")}</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {isEn && b.name_en ? b.name_en : b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">{t("range.7d", "최근 7일")}</SelectItem>
                <SelectItem value="30d">{t("range.30d", "최근 30일")}</SelectItem>
                <SelectItem value="90d">{t("range.90d", "최근 90일")}</SelectItem>
                <SelectItem value="all">{t("range.all", "전체 기간")}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
              <Download className="h-4 w-4" />
              CSV
            </Button>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3">
          <KpiCard icon={<Users className="h-3.5 w-3.5" />} label={t("branchAdminStats.kpi.totalStaff", "전체 회원")} value={kpi.totalStaff} suffix={t("common.people", "명")} />
          <KpiCard icon={<Activity className="h-3.5 w-3.5" />} label={t("branchAdminStats.kpi.activeStaff", "활성 학습자")} value={kpi.activeStaff} suffix={`(${kpi.activeRate}%)`} accent />
          <KpiCard icon={<GraduationCap className="h-3.5 w-3.5" />} label={t("branchAdminStats.kpi.newEnroll", "신규 수강")} value={kpi.newEnrollInRange} suffix={t("common.cases", "건")} />
          <KpiCard icon={<Trophy className="h-3.5 w-3.5" />} label={t("branchAdminStats.kpi.completedRange", "완료")} value={kpi.completedRange} suffix={t("common.cases", "건")} />
          <KpiCard icon={<TrendingUp className="h-3.5 w-3.5" />} label={t("branchAdminStats.kpi.avgProgress", "평균 진도")} value={`${kpi.avgProgress}%`} />
          <KpiCard icon={<BarChart3 className="h-3.5 w-3.5" />} label={t("branchAdminStats.kpi.completionRate", "이수율")} value={`${kpi.completionRate}%`} />
          <KpiCard icon={<ClipboardCheck className="h-3.5 w-3.5" />} label={t("branchAdminStats.kpi.passRate", "평가 합격률")} value={`${kpi.passRate}%`} />
          <KpiCard icon={<AlertTriangle className="h-3.5 w-3.5" />} label={t("branchAdminStats.kpi.atRisk", "기한 초과")} value={kpi.atRisk} suffix={t("common.cases", "건")} warning={kpi.atRisk > 0} />
        </div>

        {/* Charts */}
        <Suspense fallback={<ChartFallback className="h-[320px]" />}>
          <ChartsPanel trend={trend} distribution={distribution} deptStats={deptStats} />
        </Suspense>

        {/* Course performance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              {t("branchAdminStats.courseStats", "강의별 진행 현황 (상위 10)")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {courseStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {t("common.noData", "데이터가 없습니다.")}
              </p>
            ) : (
              <div className="space-y-3">
                {courseStats.map((c) => (
                  <div key={c.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {c.mandatory && (
                          <Badge variant="destructive" className="text-[10px] py-0 px-1.5 whitespace-nowrap">
                            {t("common.required", "필수")}
                          </Badge>
                        )}
                        <span className="text-sm truncate">{c.title}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs whitespace-nowrap">
                        <span className="text-muted-foreground">
                          {c.completed}/{c.enrolled}
                        </span>
                        <span className="font-medium tabular-nums w-10 text-right">
                          {c.completionRate}%
                        </span>
                      </div>
                    </div>
                    <Progress value={c.completionRate} className="h-1.5" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top & Bottom learners */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RankCard
            title={t("branchAdminStats.topLearners", "학습 우수자 TOP 5")}
            icon={<Trophy className="h-4 w-4 text-amber-500" />}
            rows={top5}
            emptyLabel={t("common.noData", "데이터가 없습니다.")}
          />
          <RankCard
            title={t("branchAdminStats.bottomLearners", "독려 필요 학습자 5")}
            icon={<AlertTriangle className="h-4 w-4 text-rose-500" />}
            rows={bottom5}
            emptyLabel={t("common.noData", "데이터가 없습니다.")}
          />
        </div>

        {/* Detailed staff table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                {t("branchAdminStats.staffDetail", "회원별 상세")} ({filteredStaff.length})
              </CardTitle>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("common.search", "검색")}
                className="h-8 w-full sm:w-56"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingEnroll ? (
              <div className="p-6 text-sm text-muted-foreground text-center">
                {t("common.loading", "불러오는 중...")}
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground text-center">
                {t("branchAdminStats.empty", "회원이 없습니다")}
              </div>
            ) : (
              <div className="border-t border-border">
                {filteredStaff.map((s: any) => {
                  const sum = summaryByUser.get(s.user_id);
                  return (
                    <div
                      key={s.user_id}
                      className="px-4 py-3 border-b-2 border-border/80 last:border-b-0 grid grid-cols-1 md:grid-cols-[1.5fr_1fr_2fr] gap-3 items-center"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{s.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground truncate">{s.email}</div>
                      </div>
                      <div className="text-xs text-muted-foreground min-w-0">
                        <span className="truncate block">
                          {deptNameById.get(s.department_id) ?? "—"}
                          {s.team_name ? ` · ${s.team_name}` : ""}
                        </span>
                        {sum?.lastLogin && (
                          <span className="text-[11px] opacity-70">
                            {new Date(sum.lastLogin).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                            <span>
                              {sum?.completed ?? 0}/{sum?.total ?? 0} {t("common.completed", "완료")}
                            </span>
                            <span className="font-medium text-foreground tabular-nums">
                              {sum?.avgProgress ?? 0}%
                            </span>
                          </div>
                          <Progress value={sum?.avgProgress ?? 0} className="h-1.5" />
                        </div>
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          {sum?.avgScore != null && (
                            <Badge variant="outline" className="text-[10px]">
                              {t("branchAdminStats.scoreShort", "점수")} {sum.avgScore}
                            </Badge>
                          )}
                          {sum && sum.attempts > 0 && (
                            <Badge variant="secondary" className="text-[10px]">
                              {sum.passed}/{sum.attempts}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

/* ----- KPI sub-component ----- */
const KpiCard = ({
  icon,
  label,
  value,
  suffix,
  accent,
  warning,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  suffix?: string;
  accent?: boolean;
  warning?: boolean;
}) => (
  <div
    className={`rounded-xl border bg-card p-3 space-y-1.5 min-w-0 ${
      warning ? "border-rose-300 dark:border-rose-700" : "border-border"
    }`}
  >
    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
      <span className="truncate">{label}</span>
      <span className={accent ? "text-primary" : warning ? "text-rose-500" : "text-muted-foreground"}>
        {icon}
      </span>
    </div>
    <div className="flex items-baseline gap-1 min-w-0">
      <span
        className={`text-lg sm:text-xl font-semibold tabular-nums truncate ${
          warning ? "text-rose-500" : ""
        }`}
      >
        {value}
      </span>
      {suffix && <span className="text-[11px] text-muted-foreground truncate">{suffix}</span>}
    </div>
  </div>
);

/* ----- Rank card sub-component ----- */
const RankCard = ({
  title,
  icon,
  rows,
  emptyLabel,
}: {
  title: string;
  icon: React.ReactNode;
  rows: { user_id: string; name: string; email: string; progress: number; completed: number; total: number }[];
  emptyLabel: string;
}) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-medium flex items-center gap-2">
        {icon}
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="p-0">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">{emptyLabel}</p>
      ) : (
        <div className="border-t border-border">
          {rows.map((r, i) => (
            <div
              key={r.user_id}
              className="px-4 py-2.5 border-b-2 border-border/80 last:border-b-0 flex items-center gap-3 min-w-0"
            >
              <span className="w-5 text-center text-xs font-semibold text-muted-foreground tabular-nums">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{r.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {r.completed}/{r.total} 완료
                </div>
              </div>
              <div className="w-24">
                <Progress value={r.progress} className="h-1.5" />
              </div>
              <span className="text-xs font-semibold tabular-nums w-10 text-right">{r.progress}%</span>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

export default BranchAdminStats;