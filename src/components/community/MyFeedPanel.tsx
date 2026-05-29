import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, UserPlus } from "lucide-react";
import { useMyFollowingIds } from "@/hooks/useFollow";

const MyFeedPanel = () => {
  const { data: followingIds = [], isLoading: loadingFollows } = useMyFollowingIds();

  const { data: posts = [], isLoading: loadingPosts } = useQuery({
    queryKey: ["community-feed", followingIds.join(",")],
    enabled: followingIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("community_posts" as any)
        .select("*")
        .in("author_id", followingIds)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(100);
      return (data as any[]) || [];
    },
  });

  const authorIds = useMemo(() => Array.from(new Set(posts.map((p: any) => p.author_id))), [posts]);
  const { data: authorMap = {} } = useQuery({
    queryKey: ["feed-authors", authorIds.join(",")],
    enabled: authorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", authorIds);
      const map: Record<string, any> = {};
      ((data as any[]) || []).forEach((p) => (map[p.user_id] = p));
      return map;
    },
  });

  if (!loadingFollows && followingIds.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <UserPlus className="h-10 w-10 mx-auto text-muted-foreground" />
          <div className="text-muted-foreground">아직 팔로우한 멤버가 없습니다.</div>
          <p className="text-xs text-muted-foreground">멤버 프로필에서 팔로우하면 이곳에 새 글이 모입니다.</p>
        </CardContent>
      </Card>
    );
  }
  if (loadingPosts) return <Card><CardContent className="py-10 text-center text-muted-foreground">불러오는 중...</CardContent></Card>;
  if (posts.length === 0) return <Card><CardContent className="py-10 text-center text-muted-foreground">팔로우한 멤버의 새 글이 아직 없습니다.</CardContent></Card>;

  return (
    <div className="space-y-2">
      {posts.map((p: any) => {
        const author = (authorMap as any)[p.author_id];
        return (
          <div key={p.id} className="border-b-2 border-border/80 py-4 px-2 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <Link to={`/community/members/${p.author_id}`} className="flex items-center gap-2 hover:underline">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={author?.avatar_url || undefined} />
                  <AvatarFallback>{author?.full_name?.[0] || "?"}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{author?.full_name || "멤버"}</span>
              </Link>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString("ko-KR")}</span>
              {p.is_pinned && <Badge variant="secondary" className="whitespace-nowrap ml-1">고정</Badge>}
            </div>
            <Link to={`/community/posts/${p.id}`} className="block">
              <div className="font-medium">{p.title}</div>
              <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.content}</div>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{p.view_count || 0}</span>
              </div>
            </Link>
          </div>
        );
      })}
    </div>
  );
};

export default MyFeedPanel;