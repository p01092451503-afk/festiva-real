import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users2, MessageCircle, Heart, Eye } from "lucide-react";
import FollowButton from "@/components/community/FollowButton";
import { useFollowCounts } from "@/hooks/useFollow";
import UserBadges from "@/components/community/UserBadges";

const MemberProfile = () => {
  const { userId } = useParams<{ userId: string }>();

  const { data: profile } = useQuery({
    queryKey: ["member-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, position, department")
        .eq("user_id", userId!)
        .maybeSingle();
      return data;
    },
  });

  const { data: counts } = useFollowCounts(userId);

  const { data: posts = [] } = useQuery({
    queryKey: ["member-posts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("community_posts" as any)
        .select("*")
        .eq("author_id", userId!)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data as any[]) || [];
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 min-w-0">
        <header>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <Users2 className="h-5 w-5" /> 멤버 프로필
          </h1>
          <p className="text-muted-foreground mt-1">커뮤니티 활동 내역과 팔로우 현황입니다.</p>
        </header>

        <Card>
          <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback>{profile?.full_name?.[0] || "?"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-lg font-semibold">{profile?.full_name || "(이름 없음)"}</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                {profile?.position || ""} {profile?.department ? `· ${profile.department}` : ""}
              </div>
              <div className="mt-2"><UserBadges userId={userId!} /></div>
              <div className="flex items-center gap-4 mt-3 text-sm">
                <span><b>{counts?.followers ?? 0}</b> <span className="text-muted-foreground">팔로워</span></span>
                <span><b>{counts?.following ?? 0}</b> <span className="text-muted-foreground">팔로잉</span></span>
                <span><b>{posts.length}</b> <span className="text-muted-foreground">게시글</span></span>
              </div>
            </div>
            {userId && <FollowButton targetUserId={userId} size="default" />}
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">최근 게시글</h2>
          {posts.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">아직 작성한 게시글이 없습니다.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {posts.map((p) => (
                <Link
                  key={p.id}
                  to={`/community/posts/${p.id}`}
                  className="block border-b-2 border-border/80 py-4 hover:bg-muted/30 transition-colors px-2"
                >
                  <div className="flex items-start gap-2">
                    {p.is_pinned && <Badge variant="secondary" className="whitespace-nowrap">고정</Badge>}
                    <div className="font-medium truncate flex-1 min-w-0">{p.title}</div>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.content}</div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{p.view_count || 0}</span>
                    <span>{new Date(p.created_at).toLocaleDateString("ko-KR")}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
};

export default MemberProfile;