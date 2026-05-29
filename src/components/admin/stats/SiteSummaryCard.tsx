import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserPlus, Globe, Monitor, BarChart3, Clock } from "lucide-react";
import { startOfMonth, startOfDay } from "date-fns";
import { useTranslation } from "react-i18next";

const SiteSummaryCard = () => {
  const { t } = useTranslation();
  const today = startOfDay(new Date()).toISOString();
  const monthStart = startOfMonth(new Date()).toISOString();

  const { data, dataUpdatedAt } = useQuery({
    queryKey: ["stat-site-summary", today, monthStart],
    queryFn: async () => {
      const [sessionsRes, monthMembersRes, totalMembersRes, pageViewsRes] = await Promise.all([
        supabase.from("user_sessions").select("user_id").gte("login_at", today),
        supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", monthStart),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("traffic_logs").select("*", { count: "exact", head: true }).eq("event_type", "page_view").gte("created_at", today),
      ]);
      return {
        todayVisitors: sessionsRes.data ? new Set(sessionsRes.data.map((s) => s.user_id)).size : 0,
        monthNewMembers: monthMembersRes.count || 0,
        totalMembers: totalMembersRes.count || 0,
        todayPageViews: pageViewsRes.count || 0,
      };
    },
    staleTime: 3 * 60 * 1000,
  });

  const stats = data || { todayVisitors: 0, monthNewMembers: 0, totalMembers: 0, todayPageViews: 0 };

  const items = [
    { label: t("stats.todayVisitors"), value: stats.todayVisitors, unit: t("common.people"), icon: Globe },
    { label: t("stats.monthNewSignups"), value: stats.monthNewMembers, unit: t("common.people"), icon: UserPlus },
    { label: t("stats.totalMembers"), value: stats.totalMembers, unit: t("common.people"), icon: Users },
    { label: t("stats.todayPageViews"), value: stats.todayPageViews, unit: t("common.cases"), icon: Monitor },
  ];

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
          <BarChart3 className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("stats.siteSummary", "사이트 요약")}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {t("stats.dailyAggregate", "일간 집계")}
        </span>
      </div>

      {/* Body — divided rows */}
      <div className="divide-y divide-border/60">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <item.icon className="h-3.5 w-3.5 text-muted-foreground/70" />
              <span>{item.label}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-bold text-foreground tabular-nums">
                {item.value.toLocaleString()}
              </span>
              <span className="text-[11px] text-muted-foreground">{item.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer meta — explicit data lineage */}
      <div className="border-t border-border/60 bg-muted/20 divide-y divide-border/60">
        <div className="px-4 py-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {t("stats.refreshInterval", "갱신 주기")} 3m · {t("stats.aggregate", "집계")} COUNT
          </span>
          <span className="tabular-nums">{t("stats.updated", "갱신")} {lastUpdated}</span>
        </div>
      </div>
    </div>
  );
};

export default SiteSummaryCard;
