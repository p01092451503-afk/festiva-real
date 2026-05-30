import {
  BookOpen, Users, ClipboardCheck, TrendingUp, ArrowRight, LayoutDashboard,
  GraduationCap, FileCheck2, Activity,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { AdminDashboardSkeleton } from "@/components/PageSkeletons";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, subDays, format } from "date-fns";
import { ko, enUS } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { lazy, Suspense } from "react";
import RichStatCard from "@/components/admin/stats/RichStatCard";
const DashCharts = {
  Bar: lazy(() => import("@/components/charts/DashboardCharts").then(m => ({ default: m.SimpleBarChart }))),
  Donut: lazy(() => import("@/components/charts/DashboardCharts").then(m => ({ default: m.DonutChart }))),
  Buckets: lazy(() => import("@/components/charts/DashboardCharts").then(m => ({ default: m.ProgressBucketChart }))),
  Trend: lazy(() => import("@/components/charts/DashboardCharts").then(m => ({ default: m.TrendAreaChart }))),
};

const TeacherDashboard = () => {
  const { user, profile } = useUser();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const dateFnsLocale = i18n.language?.startsWith("en") ? enUS : ko;

  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ["teacher-dash-courses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").eq("instructor_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const courseIds = courses.map((c: any) => c.id);

  const { data: enrollments = [] } = useQuery({
    queryKey: ["teacher-dash-enrollments", courseIds],
    queryFn: async () => {
      if (courseIds.length === 0) return [];
      const { data, error } = await supabase.from("enrollments").select("course_id, user_id, progress, completed_at").in("course_id", courseIds);
      if (error) throw error;
      return data;
    },
    enabled: courseIds.length > 0,
  });

  const { data: recentSubmissions = [] } = useQuery({
    queryKey: ["teacher-dash-submissions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignment_submissions")
        .select("*, assignments(title, course_id, courses(title, instructor_id))")
        .order("submitted_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []).filter((s: any) => s.assignments?.courses?.instructor_id === user!.id);
    },
    enabled: !!user?.id,
  });

  const { data: submitterProfiles = [] } = useQuery({
    queryKey: ["teacher-dash-profiles", recentSubmissions.map((s: any) => s.student_id)],
    queryFn: async () => {
      const ids = [...new Set(recentSubmissions.map((s: any) => s.student_id))];
      if (ids.length === 0) return [];
      const { data, error } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      if (error) throw error;
      return data;
    },
    enabled: recentSubmissions.length > 0,
  });

  const profileMap = new Map(submitterProfiles.map((p: any) => [p.user_id, p.full_name]));

  const totalStudents = enrollments.length;
  const publishedCourses = courses.filter((c: any) => c.status === "published").length;
  const draftCourses = courses.filter((c: any) => c.status !== "published").length;
  const pendingSubmissions = recentSubmissions.filter((s: any) => s.status === "submitted");

  const enrollmentCountMap = new Map<string, number>();
  enrollments.forEach((e: any) => {
    enrollmentCountMap.set(e.course_id, (enrollmentCountMap.get(e.course_id) || 0) + 1);
  });

  // === KPI 계산 ===
  // 평균 진도율
  const avgProgressAll = enrollments.length > 0
    ? Math.round(enrollments.reduce((s: number, e: any) => s + (Number(e.progress) || 0), 0) / enrollments.length)
    : 0;
  // 수료율
  const completedCount = enrollments.filter((e: any) => !!e.completed_at).length;
  const completionRate = enrollments.length > 0
    ? Math.round((completedCount / enrollments.length) * 100)
    : 0;
  // 발행 비율
  const publishRate = courses.length > 0
    ? Math.round((publishedCourses / courses.length) * 100)
    : 0;

  // 14일 제출 추세
  const trendDays = 14;
  const today = new Date();
  const submissionTrend = Array.from({ length: trendDays }, (_, i) => {
    const d = subDays(today, trendDays - 1 - i);
    const key = format(d, "MM/dd");
    const count = recentSubmissions.filter((s: any) => {
      if (!s.submitted_at) return false;
      return format(new Date(s.submitted_at), "MM/dd") === key;
    }).length;
    return { date: key, value: count };
  });
  const sparkValues = submissionTrend.map((d) => d.value);

  const pendingCount = pendingSubmissions.length;
  const gradedCount = recentSubmissions.filter((s: any) => s.status === "graded").length;

  if (coursesLoading) {
    return (
      <DashboardLayout role="teacher">
        <AdminDashboardSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <LayoutDashboard className="h-6 w-6 text-primary" aria-hidden="true" /> {t("teacher.teacherDashboard")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{t("teacher.manageStudents")}</p>
          </div>
        </div>

        {/* === KPI Row === */}
        <section
          className="grid grid-cols-2 lg:grid-cols-5 gap-3"
          aria-label={t("teacher.teacherDashboard")}
        >
          <RichStatCard
            label={t("teacher.totalStudents")}
            value={totalStudents}
            icon={Users}
            tone="indigo"
            sub={t("teacher.myStudents")}
            visual="dots"
            dotsActive={Math.min(7, Math.ceil(totalStudents / Math.max(1, Math.ceil(totalStudents / 7))))}
            dotsTotal={7}
          />
          <RichStatCard
            label={t("teacher.averageProgress", "평균 진도율")}
            value={`${avgProgressAll}%`}
            icon={Activity}
            tone="sky"
            sub={t("teacher.allEnrollmentsBasis", "전체 등록 기준")}
            visual="bar"
            barValue={avgProgressAll}
            barCaption={t("teacher.enrollmentsCount", { count: enrollments.length, defaultValue: "{{count}}건 등록" })}
          />
          <RichStatCard
            label={t("teacher.completionRate", "수료율")}
            value={`${completionRate}%`}
            icon={GraduationCap}
            tone="emerald"
            sub={t("teacher.completedOf", { done: completedCount, total: enrollments.length, defaultValue: "{{done}} / {{total}}건 수료" })}
            visual="ring"
            ringValue={completionRate}
          />
          <RichStatCard
            label={t("teacher.activeCourses")}
            value={publishedCourses}
            icon={BookOpen}
            tone="violet"
            sub={t("teacher.publishedRate", { rate: publishRate, defaultValue: "발행률 {{rate}}%" })}
            visual="bar"
            barValue={publishRate}
            barCaption={t("teacher.draftCount", { count: draftCourses, defaultValue: "초안 {{count}}건" })}
          />
          <RichStatCard
            label={t("teacher.pendingSubmissions", "채점 대기")}
            value={pendingCount}
            icon={FileCheck2}
            tone={pendingCount > 0 ? "amber" : "slate"}
            sub={t("teacher.last14daysTrend", { defaultValue: "최근 14일 추세" })}
            visual="sparkline"
            sparklineValues={sparkValues}
          />
        </section>

        {/* Charts: 강의별 수강생 + 진도 분포 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" aria-hidden="true" />
                {t("teacher.studentsPerCourse", "강의별 수강생")}
              </h3>
              <span className="text-xs text-muted-foreground">{totalStudents}{t("common.people")}</span>
            </div>
            <Suspense fallback={<div className="h-[220px]" />}>
              <DashCharts.Bar
                data={courses.slice(0, 6).map((c: any) => ({
                  name: (c.title || "").length > 12 ? c.title.slice(0, 12) + "…" : c.title,
                  value: enrollmentCountMap.get(c.id) || 0,
                }))}
                dataKey="value"
                xKey="name"
                color="hsl(var(--primary))"
                height={220}
                vertical
                showLabel
              />
            </Suspense>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-chart-3" aria-hidden="true" />
                {t("teacher.progressDistribution", "수강생 진도율 분포")}
              </h3>
              <span className="text-xs text-muted-foreground">{enrollments.length}{t("common.count")}</span>
            </div>
            <Suspense fallback={<div className="h-[220px]" />}>
              <DashCharts.Buckets enrollments={enrollments} height={220} />
            </Suspense>
          </div>
        </div>

        {/* === 제출 추세 === */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-[hsl(var(--chart-4))]" aria-hidden="true" />
              {t("teacher.submissionsTrend", { defaultValue: "최근 14일 과제 제출 추세" })}
            </h3>
            <span className="text-xs text-muted-foreground">
              {t("teacher.totalCount", { count: recentSubmissions.length, defaultValue: "총 {{count}}건" })}
            </span>
          </div>
          <Suspense fallback={<div className="h-[200px]" />}>
            <DashCharts.Trend
              data={submissionTrend}
              dataKey="value"
              xKey="date"
              color="hsl(var(--chart-4))"
              height={200}
            />
          </Suspense>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">{t("teacher.myCoursesList")}</h2>
              <p className="text-xs text-muted-foreground">{t("teacher.manageCourseDesc")}</p>
            </div>
            <Link to="/teacher/courses">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1" aria-label={t("common.viewAll")}>
                {t("common.viewAll")} <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Button>
            </Link>
          </div>

          {courses.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{t("teacher.noCourses")}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {courses.slice(0, 5).map((course: any) => {
                const studentCount = enrollmentCountMap.get(course.id) || 0;
                const courseEnrollments = enrollments.filter((e: any) => e.course_id === course.id);
                const avgProgress = courseEnrollments.length > 0
                  ? Math.round(courseEnrollments.reduce((s: number, e: any) => s + (Number(e.progress) || 0), 0) / courseEnrollments.length)
                  : 0;

                return (
                  <Link key={course.id} to={`/teacher/courses/${course.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-accent/20 transition-colors group" aria-label={course.title}>
                    {course.thumbnail_url ? (
                      <img src={course.thumbnail_url} alt={course.title} className="h-10 w-14 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="h-10 w-14 rounded-lg bg-accent flex items-center justify-center shrink-0" aria-hidden="true">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{course.title}</span>
                        <Badge
                          variant="secondary"
                          className={`text-[9px] h-4 shrink-0 ${
                            course.status === "published"
                              ? "bg-emerald-500 text-white dark:bg-emerald-500 dark:text-white"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {course.status === "published" ? t("teacher.published") : t("teacher.unpublished")}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[11px] text-muted-foreground"><Users className="h-3 w-3 inline mr-0.5" aria-hidden="true" />{studentCount}{t("common.people")}</span>
                        <span className="text-[11px] text-muted-foreground">{t("teacher.progressPercent", { percent: avgProgress })}</span>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" aria-hidden="true" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">{t("teacher.recentSubmissionsTitle")}</h2>
            </div>
            {recentSubmissions.length === 0 ? (
              <div className="text-center py-10">
                <ClipboardCheck className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">{t("teacher.noSubmissions")}</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentSubmissions.slice(0, 5).map((sub: any) => (
                  <div key={sub.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                      {(profileMap.get(sub.student_id) || t("teacher.student"))[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{profileMap.get(sub.student_id) || t("teacher.student")}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{sub.assignments?.title} · {sub.assignments?.courses?.title}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge
                        variant="secondary"
                        className={`text-[9px] ${
                          sub.status === "submitted"
                            ? "bg-amber-500 text-white dark:bg-amber-500 dark:text-white"
                            : sub.status === "graded"
                            ? "bg-emerald-500 text-white dark:bg-emerald-500 dark:text-white"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {sub.status === "submitted" ? t("teacher.ungraded") : sub.status === "graded" ? t("teacher.graded") : t("teacher.returned")}
                      </Badge>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {sub.submitted_at ? formatDistanceToNow(new Date(sub.submitted_at), { addSuffix: true, locale: dateFnsLocale }) : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">{t("teacher.courseStats")}</h2>
              <p className="text-xs text-muted-foreground">{t("teacher.myCourseStatus")}</p>
            </div>
            <div className="px-5 py-3 space-y-0">
              {[
                { label: t("teacher.totalCoursesCount"), value: `${courses.length}${t("common.count")}` },
                { label: t("teacher.activeCoursesCount"), value: `${publishedCourses}${t("common.count")}` },
                { label: t("teacher.totalStudentsCount"), value: `${totalStudents}${t("common.people")}` },
                { label: t("teacher.waitingCoursesCount"), value: `${draftCourses}${t("common.count")}` },
              ].map((row, idx) => (
                <div key={row.label} className={`flex items-center justify-between py-3 ${idx > 0 ? "border-t border-border" : ""}`}>
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className="text-sm font-semibold text-foreground">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TeacherDashboard;