import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { BookOpen, CheckCircle2, AlertCircle, FileEdit, Users, Trophy, TrendingUp, Target } from "lucide-react";

const CourseStatsCard = () => {
  const { t } = useTranslation();

  const { data: courses = [] } = useQuery({
    queryKey: ["stat-courses-overview"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("id, title, status, is_mandatory, deadline");
      if (error) throw error;
      return data;
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["stat-enrollments-overview"],
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollments").select("course_id, progress, completed_at, status");
      if (error) throw error;
      return data;
    },
  });

  const totalCourses = courses.length;
  const published = courses.filter((c: any) => c.status === "published").length;
  const draft = courses.filter((c: any) => c.status === "draft").length;
  const mandatory = courses.filter((c: any) => c.is_mandatory).length;

  const totalEnrollments = enrollments.length;
  const completed = enrollments.filter((e: any) => e.completed_at).length;
  const completionRate = totalEnrollments > 0 ? Math.round((completed / totalEnrollments) * 100) : 0;
  const avgProgress = totalEnrollments > 0
    ? Math.round(enrollments.reduce((s: number, e: any) => s + (Number(e.progress) || 0), 0) / totalEnrollments)
    : 0;

  const pendingEnrollments = enrollments.filter((e: any) => e.status === "pending").length;
  const approvedEnrollments = enrollments.filter((e: any) => e.status === "approved").length;

  const courseEnrollMap = new Map<string, { count: number; completions: number }>();
  enrollments.forEach((e: any) => {
    const entry = courseEnrollMap.get(e.course_id) || { count: 0, completions: 0 };
    entry.count++;
    if (e.completed_at) entry.completions++;
    courseEnrollMap.set(e.course_id, entry);
  });

  const topCourses = courses
    .map((c: any) => ({
      title: c.title,
      ...courseEnrollMap.get(c.id) || { count: 0, completions: 0 },
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-2 px-3 sm:px-6">
        <CardTitle className="text-sm font-medium">{t("stats.courseStats")}</CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t("stats.totalCoursesCount"), value: t("stats.itemCount", { count: totalCourses }), icon: BookOpen, accent: "text-foreground", barClass: "bg-foreground" },
            { label: t("stats.publishedCoursesCount"), value: t("stats.itemCount", { count: published }), icon: CheckCircle2, accent: "text-success", barClass: "bg-success" },
            { label: t("stats.mandatoryCoursesCount"), value: t("stats.itemCount", { count: mandatory }), icon: AlertCircle, accent: "text-warning", barClass: "bg-warning" },
            { label: t("stats.draftCoursesCount"), value: t("stats.itemCount", { count: draft }), icon: FileEdit, accent: "text-muted-foreground", barClass: "bg-muted-foreground" },
          ].map((item) => (
            <div key={item.label} className="relative p-3 rounded-lg bg-muted/40 border border-border/50 hover:bg-muted/60 transition-colors">
              <div className="flex items-center gap-1.5 mb-1">
                <item.icon className={`h-3 w-3 ${item.accent}`} aria-hidden="true" />
                <p className="text-[10px] text-muted-foreground">{item.label}</p>
              </div>
              <p className="text-lg font-bold text-foreground tabular-nums">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t("stats.totalStudentsCount"), value: `${totalEnrollments}${t("common.people")}`, icon: Users, ratio: null, accent: "text-foreground", barClass: "bg-foreground" },
            { label: t("stats.completedStudents"), value: `${completed}${t("common.people")}`, icon: Trophy, ratio: null, accent: "text-success", barClass: "bg-success" },
            { label: t("stats.avgProgressRate"), value: `${avgProgress}%`, icon: TrendingUp, ratio: avgProgress, accent: "text-info", barClass: "bg-info" },
            { label: t("stats.completionRateValue"), value: `${completionRate}%`, icon: Target, ratio: completionRate, accent: "text-primary", barClass: "bg-primary" },
          ].map((item) => (
            <div key={item.label} className="relative p-3 rounded-lg bg-muted/40 border border-border/50 overflow-hidden">
              <div className="flex items-center gap-1.5 mb-1">
                <item.icon className={`h-3 w-3 ${item.accent}`} aria-hidden="true" />
                <p className="text-[10px] text-muted-foreground">{item.label}</p>
              </div>
              <p className="text-lg font-bold text-foreground tabular-nums">{item.value}</p>
              {item.ratio !== null && (
                <div className="mt-1.5 h-1 w-full rounded-full bg-border/60 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.barClass}`}
                    style={{ width: `${Math.min(100, Math.max(0, item.ratio))}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Trophy className="h-3 w-3 text-warning" aria-hidden="true" />
            <p className="text-xs font-medium text-muted-foreground">TOP 5</p>
          </div>
          <div className="space-y-2.5">
            {topCourses.map((c, i) => {
              const pct = topCourses[0]?.count > 0 ? (c.count / topCourses[0].count) * 100 : 0;
              const rankColor =
                i === 0 ? "bg-warning text-warning-foreground" :
                i === 1 ? "bg-muted-foreground text-background" :
                i === 2 ? "bg-warning/70 text-warning-foreground" :
                "bg-muted text-muted-foreground";
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-semibold shrink-0 ${rankColor}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground truncate">{c.title}</p>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-border/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-foreground/70 to-foreground transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-foreground shrink-0 tabular-nums">{c.count}{t("common.people")}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-3 border-t border-border space-y-2">
          <div className="flex items-center justify-between text-[10px]">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />
              {t("enrollment.pending")} <span className="font-semibold text-foreground tabular-nums">{pendingEnrollments}</span>
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {t("enrollment.approvedStatus")} <span className="font-semibold text-foreground tabular-nums">{approvedEnrollments}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
            </span>
          </div>
          {(pendingEnrollments + approvedEnrollments) > 0 && (
            <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-border/60">
              <div
                className="bg-warning"
                style={{ width: `${(pendingEnrollments / (pendingEnrollments + approvedEnrollments)) * 100}%` }}
              />
              <div
                className="bg-success"
                style={{ width: `${(approvedEnrollments / (pendingEnrollments + approvedEnrollments)) * 100}%` }}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CourseStatsCard;
