import {
  BookOpen, Clock, ClipboardCheck, Award, Play, ArrowRight, TrendingUp, BarChart3, Star,
  AlertTriangle, Calendar, Layers, GraduationCap,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { StudentDashboardSkeleton } from "@/components/PageSkeletons";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useCourseTrackMap } from "@/components/student/TracksPanel";
import { lazy, Suspense } from "react";
import { format as fmtDate, subDays } from "date-fns";
import { useCourseI18n, useContentI18n } from "@/hooks/useI18nMaps";
const DashCharts = {
  Bar: lazy(() => import("@/components/charts/DashboardCharts").then(m => ({ default: m.SimpleBarChart }))),
  Donut: lazy(() => import("@/components/charts/DashboardCharts").then(m => ({ default: m.DonutChart }))),
};

const StudentDashboard = () => {
  const { user, profile } = useUser();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const displayName = profile?.full_name || t("common.user");
  const courseTrackMap = useCourseTrackMap();
  const isEn = t("course.standaloneBadge") === "Standalone";

  // 수강 중인 강좌 (진행 중) - 승인된 수강만 표시
  const { data: enrollments = [], isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["dash-enrollments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*, courses(id, title, instructor_id, difficulty_level)")
        .eq("user_id", user!.id)
        .eq("status", "approved")
        .is("completed_at", null)
        .order("enrolled_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000,
    refetchOnMount: true,
  });

  // 강사 프로필 조회
  const instructorIds = [...new Set(enrollments.map((e: any) => e.courses?.instructor_id).filter(Boolean))];
  const { data: instructorProfiles = [] } = useQuery({
    queryKey: ["dash-instructors", instructorIds],
    queryFn: async () => {
      if (instructorIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", instructorIds);
      if (error) throw error;
      return data;
    },
    enabled: instructorIds.length > 0,
  });
  const instructorMap = new Map(instructorProfiles.map((p: any) => [p.user_id, p.full_name]));

  // 각 강좌의 다음 차시 조회
  const courseIds = enrollments.map((e: any) => e.course_id);
  const { data: courseContents = [] } = useQuery({
    queryKey: ["dash-course-contents", courseIds],
    queryFn: async () => {
      if (courseIds.length === 0) return [];
      const { data, error } = await supabase
        .from("course_contents")
        .select("id, course_id, title, order_index")
        .in("course_id", courseIds)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: courseIds.length > 0,
  });

  const { data: contentProgress = [] } = useQuery({
    queryKey: ["dash-content-progress", user?.id, courseIds],
    queryFn: async () => {
      if (courseIds.length === 0) return [];
      const contentIds = courseContents.map((c: any) => c.id);
      if (contentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("content_progress")
        .select("content_id, completed")
        .eq("user_id", user!.id)
        .in("content_id", contentIds);
      if (error) throw error;
      return data;
    },
    enabled: courseContents.length > 0 && !!user?.id,
  });

  const completedContentIds = new Set(contentProgress.filter((p: any) => p.completed).map((p: any) => p.content_id));

  const getNextContent = (courseId: string) => {
    const contents = courseContents.filter((c: any) => c.course_id === courseId);
    return contents.find((c: any) => !completedContentIds.has(c.id));
  };

  // ---- i18n: localize course/content titles for English UI ----
  const allCourseIds = [
    ...enrollments.map((e: any) => e.course_id),
  ];
  const allContentIds = courseContents.map((c: any) => c.id);
  const { tCourseTitle } = useCourseI18n(allCourseIds);
  const { tContentTitle } = useContentI18n(allContentIds);

  // 통계
  const { data: enrollmentStats } = useQuery({
    queryKey: ["dash-enrollment-stats", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("progress, completed_at")
        .eq("user_id", user!.id);
      if (error) throw error;
      const total = data.length;
      const completed = data.filter((e) => e.completed_at).length;
      const inProgress = total - completed;
      const avgProgress = total > 0 ? Math.round(data.reduce((s, e) => s + (Number(e.progress) || 0), 0) / total) : 0;
      return { total, completed, inProgress, avgProgress };
    },
    enabled: !!user?.id,
  });

  // 완료한 과제
  const { data: completedAssignments = 0 } = useQuery({
    queryKey: ["dash-completed-assignments", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("assignment_submissions")
        .select("*", { count: "exact", head: true })
        .eq("student_id", user!.id)
        .eq("status", "graded");
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
  });

  const { data: totalAssignments = 0 } = useQuery({
    queryKey: ["dash-total-assignments", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("assignment_submissions")
        .select("*", { count: "exact", head: true })
        .eq("student_id", user!.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
  });

  // 뱃지
  const { data: badgeCount = 0 } = useQuery({
    queryKey: ["dash-badge-count", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("user_badges")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
  });

  // 게이미피케이션
  const { data: gamification } = useQuery({
    queryKey: ["dash-gamification", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_gamification")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // 최근 7일 학습 활동 (완료한 차시 수)
  const { data: weeklyActivity = [] } = useQuery({
    queryKey: ["dash-weekly-activity", user?.id],
    queryFn: async () => {
      const sevenAgo = subDays(new Date(), 6);
      sevenAgo.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("content_progress")
        .select("completed_at")
        .eq("user_id", user!.id)
        .eq("completed", true)
        .gte("completed_at", sevenAgo.toISOString());
      if (error) throw error;
      const map: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        map[fmtDate(subDays(new Date(), i), "MM/dd")] = 0;
      }
      (data || []).forEach((r: any) => {
        if (!r.completed_at) return;
        const k = fmtDate(new Date(r.completed_at), "MM/dd");
        if (map[k] !== undefined) map[k]++;
      });
      return Object.entries(map).map(([name, value]) => ({ name, value }));
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  // 필수교육 (마감 임박 우선)
  const { data: mandatoryCourses = [] } = useQuery({
    queryKey: ["dash-mandatory", user?.id],
    queryFn: async () => {
      // Get enrolled mandatory courses that are not completed
      const { data: myEnrollments } = await supabase
        .from("enrollments")
        .select("course_id, progress")
        .eq("user_id", user!.id)
        .is("completed_at", null);

      if (!myEnrollments || myEnrollments.length === 0) return [];
      const enrolledMap = new Map(myEnrollments.map(e => [e.course_id, Number(e.progress) || 0]));

      const { data: courses, error } = await supabase
        .from("courses")
        .select("id, title, deadline, is_mandatory")
        .eq("is_mandatory", true)
        .eq("status", "published")
        .in("id", [...enrolledMap.keys()])
        .order("deadline", { ascending: true });

      if (error) throw error;
      return (courses || []).map(c => ({
        ...c,
        progress: enrolledMap.get(c.id) || 0,
        daysLeft: c.deadline ? Math.ceil((new Date(c.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null,
      }));
    },
    enabled: !!user?.id,
  });

  // i18n maps for mandatory + recommended course titles (declared after the queries)
  const mandatoryCourseIds = mandatoryCourses.map((c: any) => c.id);
  const { tCourseTitle: tMandatoryTitle } = useCourseI18n(mandatoryCourseIds);

  // 추천 강의 (수강하지 않은 published 강좌)
  const { data: recommendedCourses = [] } = useQuery({
    queryKey: ["dash-recommended", user?.id],
    queryFn: async () => {
      const { data: enrolledData } = await supabase
        .from("enrollments")
        .select("course_id")
        .eq("user_id", user!.id);
      const enrolledIds = (enrolledData || []).map((e) => e.course_id);

      let query = supabase
        .from("courses")
        .select("id, title, instructor_id")
        .eq("status", "published")
        .limit(3);

      if (enrolledIds.length > 0) {
        // Filter out enrolled courses - use not.in
        const { data, error } = await supabase
          .from("courses")
          .select("id, title, instructor_id")
          .eq("status", "published")
          .not("id", "in", `(${enrolledIds.join(",")})`)
          .limit(3);
        if (error) throw error;
        return data || [];
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // 추천 강좌 강사 정보
  const recInstructorIds = [...new Set(recommendedCourses.map((c: any) => c.instructor_id).filter(Boolean))];
  const { tCourseTitle: tRecTitle } = useCourseI18n(recommendedCourses.map((c: any) => c.id));
  const { data: recInstructorProfiles = [] } = useQuery({
    queryKey: ["dash-rec-instructors", recInstructorIds],
    queryFn: async () => {
      if (recInstructorIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", recInstructorIds);
      if (error) throw error;
      return data;
    },
    enabled: recInstructorIds.length > 0,
  });
  const recInstructorMap = new Map(recInstructorProfiles.map((p: any) => [p.user_id, p.full_name]));

  // 추천 강좌 수강생 수
  const { data: recEnrollCounts = [] } = useQuery({
    queryKey: ["dash-rec-enroll-counts", recommendedCourses.map((c: any) => c.id)],
    queryFn: async () => {
      const ids = recommendedCourses.map((c: any) => c.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("enrollments")
        .select("course_id")
        .in("course_id", ids);
      if (error) throw error;
      return data || [];
    },
    enabled: recommendedCourses.length > 0,
  });
  const recEnrollCountMap = new Map<string, number>();
  recEnrollCounts.forEach((e: any) => {
    recEnrollCountMap.set(e.course_id, (recEnrollCountMap.get(e.course_id) || 0) + 1);
  });

  const assignmentCompletionRate = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

  const totalCourses = enrollmentStats?.total || 0;
  const completedCount = enrollmentStats?.completed || 0;
  const inProgressCount = enrollmentStats?.inProgress || 0;
  const courseCompletionPct = totalCourses > 0 ? Math.round((completedCount / totalCourses) * 100) : 0;
  const learningHours = gamification?.experience_points ? Math.round(gamification.experience_points / 60) : 0;
  const xp = gamification?.experience_points || 0;
  const level = gamification?.level || 1;
  // XP within current level (assume 100 XP per level for visualization)
  const xpInLevel = xp % 100;
  const streak = gamification?.streak_days || 0;
  const points = gamification?.total_points || 0;

  // Sparkline-friendly weekly content completion data
  const weekValues = (weeklyActivity as Array<{ value: number }>).map((d) => d.value);
  const weekMax = Math.max(1, ...weekValues);

  type StatTone = "indigo" | "emerald" | "amber" | "rose" | "violet" | "sky" | "teal" | "fuchsia";
  const TONE_BG: Record<StatTone, string> = {
    indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
    sky: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
    teal: "bg-teal-500/10 text-teal-600 dark:text-teal-300",
    fuchsia: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300",
  };
  const TONE_BAR: Record<StatTone, string> = {
    indigo: "bg-indigo-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    violet: "bg-violet-500",
    sky: "bg-sky-500",
    teal: "bg-teal-500",
    fuchsia: "bg-fuchsia-500",
  };

  // Tiny SVG ring (used inline, design-token friendly via currentColor)
  const Ring = ({ value, tone, size = 36 }: { value: number; tone: StatTone; size?: number }) => {
    const r = (size - 4) / 2;
    const c = 2 * Math.PI * r;
    const dash = (Math.min(100, Math.max(0, value)) / 100) * c;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={TONE_BG[tone].split(" ").slice(1).join(" ")}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeOpacity="0.15" strokeWidth="3" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
    );
  };

  // Tiny sparkline bar set
  const Sparkline = ({ values, tone }: { values: number[]; tone: StatTone }) => {
    const max = Math.max(1, ...values);
    return (
      <div className="flex items-end gap-0.5 h-7">
        {values.map((v, i) => (
          <span
            key={i}
            className={`w-1.5 rounded-sm ${TONE_BAR[tone]} opacity-80`}
            style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
          />
        ))}
      </div>
    );
  };

  type RichStat = {
    label: string;
    value: string;
    sub: string;
    icon: typeof BookOpen;
    tone: StatTone;
    href?: string;
    visual: "ring" | "bar" | "sparkline" | "dots";
    ringValue?: number;
    barValue?: number;
    barCaption?: string;
    dotsActive?: number;
    dotsTotal?: number;
  };

  const richStats: RichStat[] = [
    {
      label: t("dashboard.coursesInProgress"),
      value: String(inProgressCount),
      sub: t("dashboard.inProgress"),
      icon: BookOpen,
      tone: "indigo",
      href: "/dashboard/courses",
      visual: "bar",
      barValue: enrollmentStats?.avgProgress || 0,
      barCaption: `${t("dashboard.progressRate", "평균 진도")} ${enrollmentStats?.avgProgress || 0}%`,
    },
    {
      label: t("dashboard.coursesCompleted"),
      value: String(completedCount),
      sub: t("dashboard.totalCourses", { count: totalCourses }),
      icon: ClipboardCheck,
      tone: "emerald",
      href: "/dashboard/courses",
      visual: "ring",
      ringValue: courseCompletionPct,
    },
    {
      label: t("dashboard.learningTime"),
      value: `${learningHours}h`,
      sub: t("dashboard.cumulativeLearning"),
      icon: Clock,
      tone: "sky",
      visual: "sparkline",
    },
    {
      label: t("dashboard.badgesEarned"),
      value: String(badgeCount),
      sub: t("dashboard.earnedBadges"),
      icon: Award,
      tone: "amber",
      href: "/dashboard/achievements",
      visual: "dots",
      dotsActive: badgeCount,
      dotsTotal: 10,
    },
    {
      label: t("dashboard.consecutiveLearning"),
      value: `${streak}${t("common.days")}`,
      sub: t("dashboard.consecutiveDays"),
      icon: TrendingUp,
      tone: "rose",
      visual: "dots",
      dotsActive: Math.min(streak, 7),
      dotsTotal: 7,
    },
    {
      label: t("dashboard.level"),
      value: `Lv.${level}`,
      sub: `${xp} XP`,
      icon: Star,
      tone: "violet",
      visual: "ring",
      ringValue: xpInLevel,
    },
    {
      label: t("dashboard.completedAssignments"),
      value: String(completedAssignments),
      sub: t("dashboard.totalAssignmentsSub", { count: totalAssignments }),
      icon: ClipboardCheck,
      tone: "teal",
      visual: "bar",
      barValue: assignmentCompletionRate,
      barCaption: `${assignmentCompletionRate}%`,
    },
    {
      label: t("dashboard.totalPoints"),
      value: String(points),
      sub: t("dashboard.cumulativePoints"),
      icon: Award,
      tone: "fuchsia",
      visual: "sparkline",
    },
  ];

  if (enrollmentsLoading) {
    return (
      <DashboardLayout role="student">
        <StudentDashboardSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="student">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" aria-hidden="true" />
            {t("dashboard.learningDashboard")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t("dashboard.hello")}</p>
        </div>

        {/* Stat Cards — visualized 2 rows of 4 */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3" aria-label={t("dashboard.stats", "학습 통계")}>
          {richStats.map((stat) => {
            const Icon = stat.icon;
            const content = (
              <div className="relative h-full flex flex-col justify-between gap-3">
                {/* Top: icon badge + label */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`inline-flex items-center justify-center h-8 w-8 rounded-lg ${TONE_BG[stat.tone]}`} aria-hidden="true">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-[11px] sm:text-xs text-muted-foreground leading-tight truncate font-medium">
                      {stat.label}
                    </span>
                  </div>
                  {stat.href && (
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 mt-1.5" aria-hidden="true" />
                  )}
                </div>

                {/* Middle: value + visual */}
                <div className="flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-2xl sm:text-3xl font-bold text-foreground leading-none tabular-nums tracking-tight">
                      {stat.value}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1.5 truncate">
                      {stat.sub}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {stat.visual === "ring" && <Ring value={stat.ringValue || 0} tone={stat.tone} />}
                    {stat.visual === "sparkline" && (
                      <Sparkline
                        values={
                          weekValues.length > 0
                            ? weekValues
                            : [3, 5, 2, 6, 4, 7, 5]
                        }
                        tone={stat.tone}
                      />
                    )}
                    {stat.visual === "dots" && (
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: stat.dotsTotal || 7 }).map((_, i) => (
                          <span
                            key={i}
                            className={`h-1.5 w-1.5 rounded-full ${
                              i < (stat.dotsActive || 0) ? TONE_BAR[stat.tone] : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom: progress bar (only for 'bar' visual) */}
                {stat.visual === "bar" && (
                  <div className="space-y-1">
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${TONE_BAR[stat.tone]} rounded-full transition-all`}
                        style={{ width: `${Math.min(100, Math.max(0, stat.barValue || 0))}%` }}
                      />
                    </div>
                    {stat.barCaption && (
                      <p className="text-[10px] text-muted-foreground tabular-nums">{stat.barCaption}</p>
                    )}
                  </div>
                )}
              </div>
            );
            const baseClass =
              "relative rounded-xl border border-border bg-card p-3.5 sm:p-4 shadow-sm transition-all";
            return stat.href ? (
              <Link
                key={stat.label}
                to={stat.href}
                className={`${baseClass} hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5`}
                role="group"
                aria-label={stat.label}
              >
                {content}
              </Link>
            ) : (
              <div key={stat.label} className={baseClass} role="group" aria-label={stat.label}>
                {content}
              </div>
            );
          })}
        </section>

        {/* 필수교육 안내 */}
        {mandatoryCourses.length > 0 && (
          <section className="stat-card !p-6 space-y-4 border-destructive/30" aria-label={t("mandatory.title")} role="alert">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
              <div>
                <h2 className="text-lg font-bold text-foreground">{t("mandatory.title")}</h2>
                <p className="text-xs text-muted-foreground">{t("mandatory.subtitle")}</p>
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden border border-border">
              {mandatoryCourses.map((mc: any, index: number) => {
                const isOverdue = mc.daysLeft !== null && mc.daysLeft < 0;
                const isToday = mc.daysLeft === 0;
                const isUrgent = mc.daysLeft !== null && mc.daysLeft <= 3;
                return (
                  <div key={mc.id} className={`!p-3 sm:!p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 border-b-2 border-border/80 last:border-b-0 ${isOverdue ? "bg-destructive/5" : isUrgent ? "bg-orange-50/50 dark:bg-orange-950/10" : ""}`} role="article" aria-label={tMandatoryTitle(mc)}>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-foreground truncate">{tMandatoryTitle(mc)}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          isOverdue ? "bg-destructive/10 text-destructive" :
                          isToday ? "bg-destructive/10 text-destructive" :
                          isUrgent ? "bg-amber-500 text-white dark:bg-amber-500 dark:text-white" :
                          "bg-muted text-muted-foreground"
                        }`} role="status">
                          {isOverdue ? t("mandatory.overdue") :
                           isToday ? t("mandatory.today") :
                           mc.daysLeft !== null ? t("mandatory.daysLeft", { days: mc.daysLeft }) : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={mc.progress} className="h-2 flex-1" aria-label={`${t("dashboard.progressRate")}: ${Math.round(mc.progress)}%`} />
                        <span className="text-xs font-semibold text-foreground shrink-0">{Math.round(mc.progress)}%</span>
                      </div>
                      {mc.deadline && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Calendar className="h-3 w-3" aria-hidden="true" />
                          <time dateTime={mc.deadline}>{t("mandatory.deadline")}: {mc.deadline}</time>
                        </div>
                      )}
                    </div>
                    <Button size="sm" variant={isOverdue || isUrgent ? "destructive" : "outline"} className="shrink-0 rounded-full gap-1.5 w-full sm:w-auto" onClick={() => navigate(`/student/courses/${mc.id}?view=learn`)} aria-label={`${tMandatoryTitle(mc)} - ${t("common.continue")}`}>
                      <Play className="h-3.5 w-3.5" aria-hidden="true" /> {t("common.continue")}
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="stat-card !p-6 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-foreground">{t("dashboard.ongoingCourses")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{t("dashboard.continueStudy")}</p>
          </div>

          {enrollments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">{t("dashboard.noCourses")}</p>
            </div>
          ) : (() => {
            const renderItem = (enrollment: any) => {
              const nextContent = getNextContent(enrollment.course_id);
              const progress = Math.round(Number(enrollment.progress) || 0);
              const instructorName = instructorMap.get(enrollment.courses?.instructor_id) || t("dashboard.instructor");
              return (
                <div key={enrollment.id} className="!p-4 sm:!p-5 space-y-3 border-b-2 border-border/80 last:border-b-0" role="article" aria-label={tCourseTitle({ id: enrollment.course_id, title: enrollment.courses?.title })}>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <h3 className="text-sm sm:text-base font-semibold text-foreground truncate">
                        {tCourseTitle({ id: enrollment.course_id, title: enrollment.courses?.title })}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">{instructorName}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 shrink-0 rounded-full w-full sm:w-auto"
                      onClick={() => {
                        if (nextContent) {
                          navigate(`/student/courses/${enrollment.course_id}/content/${nextContent.id}?view=learn`);
                        } else {
                          navigate(`/student/courses/${enrollment.course_id}?view=learn`);
                        }
                      }}
                      aria-label={`${tCourseTitle({ id: enrollment.course_id, title: enrollment.courses?.title })} - ${t("common.continue")}`}
                    >
                      <Play className="h-3.5 w-3.5" aria-hidden="true" /> {t("common.continue")}
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t("dashboard.progressRate")}</span>
                      <span className="font-semibold text-foreground">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2.5" aria-label={`${t("dashboard.progressRate")}: ${progress}%`} />
                  </div>

                  {nextContent && (
                    <p className="text-xs text-muted-foreground">
                      {t("dashboard.nextLesson", { title: tContentTitle(nextContent) })}
                    </p>
                  )}
                </div>
              );
            };

            // Split enrollments into track-grouped and standalone
            const trackGroups = new Map<string, { trackName: string; trackNameEn: string | null; sortOrder: number; items: any[] }>();
            const standaloneItems: any[] = [];
            enrollments.forEach((e: any) => {
              const trackInfo = courseTrackMap.get(e.course_id);
              if (trackInfo) {
                if (!trackGroups.has(trackInfo.trackId)) {
                  trackGroups.set(trackInfo.trackId, {
                    trackName: trackInfo.trackName,
                    trackNameEn: trackInfo.trackNameEn,
                    sortOrder: trackInfo.sortOrder,
                    items: [],
                  });
                }
                trackGroups.get(trackInfo.trackId)!.items.push(e);
              } else {
                standaloneItems.push(e);
              }
            });
            const sortedTracks = Array.from(trackGroups.entries()).sort(
              (a, b) => a[1].sortOrder - b[1].sortOrder,
            );

            return (
              <div className="space-y-6">
                {sortedTracks.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary" aria-hidden="true" />
                      <h3 className="text-sm font-semibold text-foreground">
                        {t("nav.learningTracks", "학습 트랙")}
                      </h3>
                      <Badge variant="outline" className="text-[10px] h-5 border-primary/40 text-primary">
                        {sortedTracks.length}
                      </Badge>
                    </div>
                    <div className="space-y-4">
                      {sortedTracks.map(([trackId, group]) => (
                        <div key={trackId} className="rounded-2xl border border-border overflow-hidden">
                          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-secondary/40 border-b border-border">
                            <div className="flex items-center gap-2 min-w-0">
                              <Layers className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                              <h4 className="text-sm font-semibold text-foreground truncate">
                                {isEn && group.trackNameEn ? group.trackNameEn : group.trackName}
                              </h4>
                            </div>
                            <span className="text-[11px] text-muted-foreground shrink-0">
                              {isEn ? `${group.items.length} in progress` : `${group.items.length}개 수강중`}
                            </span>
                          </div>
                          <div>{group.items.map(renderItem)}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {standaloneItems.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <h3 className="text-sm font-semibold text-foreground">
                        {t("course.standaloneBadge", "단과")}
                      </h3>
                      <Badge variant="outline" className="text-[10px] h-5 border-muted-foreground/40 text-muted-foreground">
                        {standaloneItems.length}
                      </Badge>
                    </div>
                    <div className="space-y-0 rounded-2xl overflow-hidden border border-border">
                      {standaloneItems.map(renderItem)}
                    </div>
                  </section>
                )}
              </div>
            );
          })()}
        </div>

        {/* 학습 통계 + 추천 강의 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="stat-card !p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" />
                {isEn ? "Lessons completed (7d)" : "최근 7일 학습 차시"}
              </h3>
              <span className="text-xs text-muted-foreground">
                {weeklyActivity.reduce((s, d) => s + d.value, 0)}{isEn ? "" : "차시"}
              </span>
            </div>
            <Suspense fallback={<div className="h-[180px]" />}>
              <DashCharts.Bar data={weeklyActivity} dataKey="value" xKey="name" color="hsl(var(--primary))" height={180} unit={isEn ? "" : "차시"} />
            </Suspense>
          </div>

          <div className="stat-card !p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-chart-3" aria-hidden="true" />
                {isEn ? "My Course Status" : "내 강의 진행 상태"}
              </h3>
              <span className="text-xs text-muted-foreground">{enrollmentStats?.total || 0}{isEn ? "" : "개"}</span>
            </div>
            <Suspense fallback={<div className="h-[180px]" />}>
              <DashCharts.Donut
                height={180}
                centerValue={`${enrollmentStats?.avgProgress || 0}%`}
                centerLabel={isEn ? "Avg progress" : "평균 진도"}
                data={[
                  { name: isEn ? "Completed" : "수료", value: enrollmentStats?.completed || 0, color: "hsl(158 64% 42%)" },
                  { name: isEn ? "In progress" : "진행중", value: enrollmentStats?.inProgress || 0, color: "hsl(217 91% 55%)" },
                ].filter(d => d.value > 0)}
              />
            </Suspense>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* 학습 통계 */}
          <div className="stat-card !p-6 space-y-5">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5" aria-hidden="true" /> {t("dashboard.learningStats")}
            </h2>
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("dashboard.weeklyGoal")}</span>
                  <span className="font-semibold text-foreground">
                    {gamification?.experience_points ? Math.round(gamification.experience_points / 60) : 0}h / 20h
                  </span>
                </div>
                <Progress
                  value={Math.min(100, ((gamification?.experience_points ? gamification.experience_points / 60 : 0) / 20) * 100)}
                  className="h-3"
                  aria-label={`${t("dashboard.weeklyGoal")}: ${gamification?.experience_points ? Math.round(gamification.experience_points / 60) : 0}h / 20h`}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("dashboard.assignmentCompletionRate")}</span>
                  <span className="font-semibold text-foreground">{assignmentCompletionRate}%</span>
                </div>
                <Progress value={assignmentCompletionRate} className="h-3" aria-label={`${t("dashboard.assignmentCompletionRate")}: ${assignmentCompletionRate}%`} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("dashboard.averageScore")}</span>
                  <span className="font-semibold text-foreground">{enrollmentStats?.avgProgress || 0}{t("common.points")}</span>
                </div>
                <Progress value={enrollmentStats?.avgProgress || 0} className="h-3" aria-label={`${t("dashboard.averageScore")}: ${enrollmentStats?.avgProgress || 0}${t("common.points")}`} />
              </div>
            </div>
          </div>

          {/* 추천 강의 */}
          <div className="stat-card !p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-foreground">{t("dashboard.recommendedCourses")}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{t("dashboard.recommendedDesc")}</p>
            </div>
            {recommendedCourses.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">{t("dashboard.noRecommended")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recommendedCourses.map((course: any) => (
                  <div key={course.id} className="stat-card !p-3 sm:!p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4" role="article" aria-label={tRecTitle(course)}>
                    <div className="min-w-0 flex-1 space-y-1">
                      <h3 className="text-sm font-semibold text-foreground truncate">{tRecTitle(course)}</h3>
                      <p className="text-xs text-muted-foreground">{recInstructorMap.get(course.instructor_id) || t("dashboard.instructor")}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" aria-hidden="true" />
                        <span>{(recEnrollCountMap.get(course.id) || 0).toLocaleString()} {t("dashboard.students")}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0 rounded-full w-full sm:w-auto"
                      onClick={() => navigate(`/student/courses/${course.id}?view=learn`)}
                      aria-label={`${tRecTitle(course)} - ${t("common.details")}`}
                    >
                      {t("common.details")}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;
