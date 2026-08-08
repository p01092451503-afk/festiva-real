import { useQuery } from "@tanstack/react-query";
import { Coins, TrendingUp, TrendingDown, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";

const PointsTab = () => {
  const { user } = useUser();

  const { data: gamification } = useQuery({
    queryKey: ["my-gamification", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_gamification")
        .select("total_points, level, streak_days")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["my-point-history", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("point_history")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const earned = history.filter((h: any) => h.points > 0).reduce((s: number, h: any) => s + h.points, 0);
  const spent = history.filter((h: any) => h.points < 0).reduce((s: number, h: any) => s + Math.abs(h.points), 0);

  const soon = history.filter((h: any) => {
    if (!h.expires_at || h.expired_at || h.points <= 0) return false;
    const d = (new Date(h.expires_at).getTime() - Date.now()) / 86400000;
    return d > 0 && d <= 30;
  });
  const expiringPoints = soon.reduce((s: number, h: any) => s + h.points, 0);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">포인트</h2>
        <p className="text-sm text-muted-foreground">적립·사용 내역과 소멸 예정 포인트를 확인할 수 있습니다.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Coins className="h-3.5 w-3.5" /> 보유 포인트</div>
          <p className="text-xl font-bold text-foreground">{(gamification?.total_points ?? 0).toLocaleString()} P</p>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" /> 누적 적립</div>
          <p className="text-xl font-bold text-foreground">{earned.toLocaleString()} P</p>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><TrendingDown className="h-3.5 w-3.5" /> 누적 사용</div>
          <p className="text-xl font-bold text-foreground">{spent.toLocaleString()} P</p>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" /> 30일 내 소멸예정</div>
          <p className="text-xl font-bold text-foreground">{expiringPoints.toLocaleString()} P</p>
        </Card>
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="h-14 w-14 rounded-full bg-accent flex items-center justify-center">
            <Coins className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">포인트 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="divide-y divide-border border-t border-b border-border/80">
          {history.map((h: any) => (
            <div key={h.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">{h.description || h.action_type}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {h.created_at ? new Date(h.created_at).toLocaleDateString("ko-KR") : "-"}
                  {h.expires_at && !h.expired_at ? ` · ${new Date(h.expires_at).toLocaleDateString("ko-KR")} 소멸예정` : ""}
                  {h.expired_at ? " · 소멸됨" : ""}
                </p>
              </div>
              <p className={`text-sm font-semibold shrink-0 ${h.points >= 0 ? "text-foreground" : "text-destructive"}`}>
                {h.points > 0 ? "+" : ""}{h.points.toLocaleString()} P
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PointsTab;
