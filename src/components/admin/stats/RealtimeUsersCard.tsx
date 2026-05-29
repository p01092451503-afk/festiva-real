import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

const RealtimeUsersCard = () => {
  const { t } = useTranslation();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: onlineCount = 0, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["realtime-online-users"],
    queryFn: async () => {
      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from("user_sessions")
        .select("*", { count: "exact", head: true })
        .is("logout_at", null)
        .gte("login_at", fifteenMinAgo);
      if (error) throw error;
      return count || 0;
    },
    staleTime: 20_000,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("online-users-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_sessions" },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => refetch(), 3000);
        }
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const lastUpdated = new Date(dataUpdatedAt).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const secondsAgo = Math.max(0, Math.floor((now - dataUpdatedAt) / 1000));
  const relativeAgo = secondsAgo < 60
    ? `${secondsAgo}${t("stats.secondsAgo", "초 전")}`
    : `${Math.floor(secondsAgo / 60)}${t("stats.minutesAgo", "분 전")}`;

  return (
    <div className="relative rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      {/* Header strip */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/60 bg-muted/30">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("stats.realtimeUsers", "현재 동시접속자")}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-success">LIVE</span>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-5 flex items-end justify-between">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-bold text-foreground tabular-nums tracking-tight">
              {onlineCount.toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground font-medium">{t("common.people")}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {t("stats.activeWindow", "지난 15분 활성 세션")}
          </p>
        </div>

        {/* Sparkline placeholder bars */}
        <div className="flex items-end gap-0.5 h-10" aria-hidden="true">
          {[40, 65, 50, 80, 55, 70, 90].map((h, i) => (
            <span
              key={i}
              className="w-1 bg-success/30 rounded-sm"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>

      {/* Footer meta — explicit data lineage */}
      <div className="border-t border-border/60 bg-muted/20 divide-y divide-border/60">
        <div className="px-4 py-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {t("stats.refreshInterval", "갱신 주기")} 60s · Realtime ON
          </span>
          <span className="tabular-nums">{lastUpdated} ({relativeAgo})</span>
        </div>
      </div>
    </div>
  );
};

export default RealtimeUsersCard;
