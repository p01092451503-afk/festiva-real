import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Award, Medal, Sprout, MessagesSquare, Star, Heart, Flame, BadgeCheck } from "lucide-react";

const CommunityRankingPanel = () => {
  const { data: ranking = [] } = useQuery({
    queryKey: ["community-ranking"],
    queryFn: async () => {
      const [posts, comments, likes] = await Promise.all([
        supabase.from("community_posts" as any).select("author_id").eq("is_hidden", false).limit(1000),
        supabase.from("community_comments" as any).select("author_id").limit(1000),
        supabase.from("community_likes" as any).select("post_id, user_id").limit(2000),
      ]);
      const score: Record<string, { posts: number; comments: number; likes: number; total: number }> = {};
      const inc = (uid: string, k: "posts" | "comments" | "likes", n = 1) => {
        if (!score[uid]) score[uid] = { posts: 0, comments: 0, likes: 0, total: 0 };
        score[uid][k] += n;
      };
      ((posts.data as any[]) || []).forEach((p) => inc(p.author_id, "posts", 5));
      ((comments.data as any[]) || []).forEach((c) => inc(c.author_id, "comments", 2));

      // Map like → post author
      const postAuthors: Record<string, string> = {};
      ((posts.data as any[]) || []).forEach((p: any) => (postAuthors[p.id] = p.author_id));
      // We didn't select post.id above — re-fetch ids
      const { data: postIds } = await supabase.from("community_posts" as any).select("id, author_id").eq("is_hidden", false);
      const map: Record<string, string> = {};
      ((postIds as any[]) || []).forEach((p) => (map[p.id] = p.author_id));
      ((likes.data as any[]) || []).forEach((l: any) => {
        const author = map[l.post_id];
        if (author && author !== l.user_id) inc(author, "likes", 1);
      });
      Object.values(score).forEach((s) => (s.total = s.posts + s.comments + s.likes));

      const userIds = Object.keys(score);
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds);
      const pmap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      return userIds
        .map((uid) => ({ user_id: uid, ...score[uid], profile: pmap.get(uid) as any }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
    },
  });

  const { data: allBadges = [] } = useQuery({
    queryKey: ["community-badges"],
    queryFn: async () => {
      const { data } = await supabase
        .from("badges")
        .select("*")
        .in("requirement_type", ["community_posts", "community_comments", "community_likes_received"])
        .order("requirement_value");
      return data || [];
    },
  });

  const medals = [Trophy, Medal, Award];

  const badgeIconFor = (b: any) => {
    switch (b.requirement_type) {
      case "community_posts":
        return { Icon: Sprout, color: "text-emerald-600", bg: "bg-emerald-50" };
      case "community_comments":
        return { Icon: MessagesSquare, color: "text-sky-600", bg: "bg-sky-50" };
      case "community_likes_received":
        return { Icon: Star, color: "text-amber-500", bg: "bg-amber-50" };
      default:
        return { Icon: BadgeCheck, color: "text-primary", bg: "bg-muted" };
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Card>
        <CardContent className="p-4">
          <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-3">
            <Trophy className="h-3.5 w-3.5" /> 커뮤니티 활동 랭킹 TOP 5
          </h3>
          {ranking.length === 0 ? (
            <p className="text-xs text-muted-foreground">아직 데이터가 없습니다.</p>
          ) : (
            <ol className="space-y-2">
              {ranking.map((r: any, i: number) => {
                const Icon = medals[i] || Award;
                return (
                  <li key={r.user_id} className="flex items-center gap-2 min-w-0">
                    <div className="w-6 flex justify-center">
                      {i < 3 ? <Icon className={`h-4 w-4 ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : "text-amber-700"}`} /> : <span className="text-xs text-muted-foreground">{i + 1}</span>}
                    </div>
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
                      {r.profile?.full_name?.[0] || "?"}
                    </div>
                    <span className="text-sm font-medium truncate flex-1">{r.profile?.full_name || "익명"}</span>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground whitespace-nowrap">
                      <span>글 {r.posts / 5}</span>
                      <span>댓 {r.comments / 2}</span>
                      <span>♥ {r.likes}</span>
                      <span className="font-semibold text-primary">{r.total}pt</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-3">
            <Award className="h-3.5 w-3.5" /> 커뮤니티 뱃지
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {allBadges.map((b: any) => {
              const { Icon, color, bg } = badgeIconFor(b);
              return (
                <div key={b.id} className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border bg-background hover:bg-muted/30 transition-colors">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${bg}`}>
                    <Icon className={`h-5 w-5 ${color}`} strokeWidth={1.75} />
                  </div>
                  <span className="text-[11px] font-medium text-foreground text-center leading-tight">{b.name}</span>
                  <span className="text-[10px] text-muted-foreground text-center">{b.description}</span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">
            글 5pt · 댓글 2pt · 좋아요 1pt가 자동 적립됩니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CommunityRankingPanel;