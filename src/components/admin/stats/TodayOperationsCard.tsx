import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay } from "date-fns";
import { useTranslation } from "react-i18next";
import { ClipboardList, Clock } from "lucide-react";

const TodayOperationsCard = () => {
  const { t } = useTranslation();
  const today = startOfDay(new Date()).toISOString();

  const { data, dataUpdatedAt } = useQuery({
    queryKey: ["stat-today-operations", today],
    queryFn: async () => {
      const [enrollRes, complRes, subRes, assessRes, pendingRes, unreadRes] = await Promise.all([
        supabase.from("enrollments").select("*", { count: "exact", head: true }).gte("enrolled_at", today),
        supabase.from("enrollments").select("*", { count: "exact", head: true }).gte("completed_at", today),
        supabase.from("assignment_submissions").select("*", { count: "exact", head: true }).gte("submitted_at", today),
        supabase.from("assessment_attempts").select("*", { count: "exact", head: true }).gte("started_at", today),
        supabase.from("assignment_submissions").select("*", { count: "exact", head: true }).eq("status", "submitted"),
        supabase.from("notifications").select("*", { count: "exact", head: true }).eq("is_read", false),
      ]);
      return {
        todayEnrollments: enrollRes.count || 0,
        todayCompletions: complRes.count || 0,
        todaySubmissions: subRes.count || 0,
        todayAssessments: assessRes.count || 0,
        pendingSubmissions: pendingRes.count || 0,
        unreadNotifications: unreadRes.count || 0,
      };
    },
    staleTime: 3 * 60 * 1000,
  });

  const stats = data || {
    todayEnrollments: 0, todayCompletions: 0, todaySubmissions: 0,
    todayAssessments: 0, pendingSubmissions: 0, unreadNotifications: 0,
  };

  const items = [
    { label: t("stats.newEnroll"), value: stats.todayEnrollments, accent: "primary" as const },
    { label: t("stats.completionToday"), value: stats.todayCompletions, accent: "success" as const },
    { label: t("stats.submissionToday"), value: stats.todaySubmissions, accent: "info" as const },
    { label: t("stats.assessmentToday"), value: stats.todayAssessments, accent: "primary" as const },
    { label: t("stats.pendingGrade"), value: stats.pendingSubmissions, accent: "warning" as const },
    { label: t("stats.unreadNotif"), value: stats.unreadNotifications, accent: "muted" as const },
  ];

  const accentClass = (a: string, value: number) => {
    if (value === 0) return "text-muted-foreground/60";
    switch (a) {
      case "success": return "text-success";
      case "warning": return "text-warning";
      case "info": return "text-info";
      case "muted": return "text-muted-foreground";
      default: return "text-foreground";
    }
  };

  const today_label = new Date().toLocaleDateString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  const lastUpdated = new Date(dataUpdatedAt).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="relative rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      {/* Header strip */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/60 bg-muted/30">
        <div className="flex items-center gap-1.5">
          <ClipboardList className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("stats.todayOps", "오늘 운영 현황")}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">{today_label}</span>
      </div>

      {/* Body grid — borderless cells, divider lines for trustworthy ledger feel */}
      <div className="grid grid-cols-3 divide-x divide-y divide-border/60 [&>*:nth-child(-n+3)]:border-t-0">
        {items.map((item) => (
          <div key={item.label} className="px-3 py-3 text-center first:border-l-0 [&:nth-child(4)]:border-l-0">
            <p className={`text-2xl font-bold tabular-nums ${accentClass(item.accent, item.value)}`}>
              {item.value}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Footer meta — explicit data lineage */}
      <div className="border-t border-border/60 bg-muted/20 divide-y divide-border/60">
        <div className="px-4 py-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {t("stats.refreshInterval", "갱신 주기")} 3m · COUNT(*) GROUP BY status
          </span>
          <span className="tabular-nums">{t("stats.updated", "갱신")} {lastUpdated}</span>
        </div>
      </div>
    </div>
  );
};

export default TodayOperationsCard;
