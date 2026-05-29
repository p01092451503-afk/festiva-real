import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, RefreshCw, Medal, Award } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { toast } from "sonner";

const RankingPanel = () => {
  const { user, roles } = useUser();
  const isAdmin = roles?.includes("admin") || roles?.includes("super_admin");
  const [refreshing, setRefreshing] = useState(false);

  const { data: rows = [], refetch } = useQuery({
    queryKey: ["community-rankings-daily"],
    queryFn: async () => {
      const { data: latest } = await supabase
        .from("community_rankings_daily" as any)
        .select("snapshot_date")
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!latest) return [];
      const { data } = await supabase
        .from("community_rankings_daily" as any)
        .select("*")
        .eq("snapshot_date", (latest as any).snapshot_date)
        .order("rank", { ascending: true })
        .limit(50);
      return (data as any[]) || [];
    },
  });

  const userIds = rows.map((r) => r.user_id);
  const { data: profiles = [] } = useQuery({
    queryKey: ["ranking-profiles", userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, position")
        .in("user_id", userIds);
      return data || [];
    },
  });
  const pMap = new Map((profiles as any[]).map((p) => [p.user_id, p]));

  const refreshRanking = async () => {
    setRefreshing(true);
    try {
      const { error } = await supabase.rpc("community_aggregate_daily_rankings" as any, {});
      if (error) throw error;
      toast.success("랭킹을 새로 집계했습니다.");
      refetch();
    } catch (e: any) {
      toast.error(e.message || "집계 실패");
    } finally {
      setRefreshing(false);
    }
  };

  const medal = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-amber-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-slate-400" />;
    if (rank === 3) return <Award className="h-5 w-5 text-amber-700" />;
    return <span className="text-sm font-semibold text-muted-foreground w-5 text-center">{rank}</span>;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground">활동 점수 기반 일별 랭킹 · 게시글 5점 · 댓글 2점 · 좋아요 받음 3점 · 팔로워 4점</p>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={refreshRanking} disabled={refreshing} className="gap-1.5">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> 집계
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              아직 집계된 랭킹이 없습니다.
            </div>
          ) : (
            <ul>
              {rows.map((r: any) => {
                const p = pMap.get(r.user_id) as any;
                const isMe = user?.id === r.user_id;
                return (
                  <li key={r.id} className={`border-b-2 border-border/80 last:border-b-0 px-4 py-3 flex items-center gap-3 ${isMe ? "bg-primary/5" : ""}`}>
                    <div className="w-6 flex justify-center">{medal(r.rank)}</div>
                    <Link to={`/community/members/${r.user_id}`}>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={p?.avatar_url || undefined} />
                        <AvatarFallback>{p?.full_name?.[0] || "?"}</AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link to={`/community/members/${r.user_id}`} className="text-sm font-medium hover:underline">
                        {p?.full_name || "멤버"}
                      </Link>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        글 {r.post_count} · 댓글 {r.comment_count} · 좋아요 {r.like_received} · 팔로워 {r.follower_count}
                      </div>
                    </div>
                    <Badge variant="secondary" className="font-semibold whitespace-nowrap">{r.score} pt</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RankingPanel;