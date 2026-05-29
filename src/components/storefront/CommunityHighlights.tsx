import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Flame, Clock, Eye, MessageSquare, Heart, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Post {
  id: string;
  title: string;
  content: string;
  view_count: number;
  created_at: string;
  category_id: string | null;
  author_id: string;
}

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(iso).toLocaleDateString();
};

const CommunityHighlights = () => {
  const { data: posts = [] } = useQuery({
    queryKey: ["storefront-community-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_posts")
        .select("id, title, content, view_count, created_at, category_id, author_id, is_hidden, is_pinned")
        .eq("is_hidden", false)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []) as unknown as Post[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["storefront-community-categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("community_categories")
        .select("id, name, slug")
        .eq("is_active", true);
      return data || [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["storefront-community-stats", posts.map((p) => p.id)],
    enabled: posts.length > 0,
    queryFn: async () => {
      const ids = posts.map((p) => p.id);
      const [likes, comments] = await Promise.all([
        supabase.from("community_likes").select("post_id").in("post_id", ids),
        supabase.from("community_comments").select("post_id").in("post_id", ids),
      ]);
      const lc: Record<string, number> = {};
      const cc: Record<string, number> = {};
      (likes.data || []).forEach((l: any) => (lc[l.post_id] = (lc[l.post_id] || 0) + 1));
      (comments.data || []).forEach((c: any) => (cc[c.post_id] = (cc[c.post_id] || 0) + 1));
      return { likes: lc, comments: cc };
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["storefront-community-authors", posts.map((p) => p.author_id)],
    enabled: posts.length > 0,
    queryFn: async () => {
      const ids = [...new Set(posts.map((p) => p.author_id))];
      const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      return data || [];
    },
  });
  const nameMap = new Map(profiles.map((p: any) => [p.user_id, p.full_name]));
  const catMap = new Map(categories.map((c: any) => [c.id, c.name]));

  if (posts.length === 0) return null;

  const popular = [...posts].sort((a, b) => b.view_count - a.view_count).slice(0, 5);
  const latest = posts.slice(0, 6);

  return (
    <section className="border-b border-border bg-accent/20">
      <div className="max-w-6xl mx-auto px-4 py-14">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              커뮤니티
            </h2>
            <p className="text-sm text-muted-foreground mt-1">학습자들이 나누는 생생한 이야기를 확인하세요</p>
          </div>
          <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground hover:text-foreground">
            <Link to="/student/community">
              전체 보기 <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 인기글 */}
          <div className="bg-background border border-border rounded-lg p-5">
            <div className="flex items-center gap-1.5 mb-4">
              <Flame className="h-4 w-4 text-orange-500" />
              <h3 className="text-sm font-semibold text-foreground">인기글</h3>
            </div>
            <ol className="space-y-3">
              {popular.map((p, idx) => (
                <li key={p.id}>
                  <Link
                    to="/student/community"
                    className="flex items-start gap-3 group min-w-0"
                  >
                    <span className="text-sm font-semibold text-primary w-5 shrink-0">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground group-hover:text-primary transition-colors truncate">
                        {p.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                        <span>{nameMap.get(p.author_id) || "익명"}</span>
                        <span>·</span>
                        <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{p.view_count}</span>
                        <span className="flex items-center gap-0.5"><MessageSquare className="h-3 w-3" />{stats?.comments[p.id] || 0}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          </div>

          {/* 최신글 */}
          <div className="bg-background border border-border rounded-lg p-5">
            <div className="flex items-center gap-1.5 mb-4">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">최신글</h3>
            </div>
            <ul className="space-y-3">
              {latest.map((p) => (
                <li key={p.id}>
                  <Link to="/student/community" className="flex items-start gap-2 group min-w-0">
                    {p.category_id && catMap.get(p.category_id) && (
                      <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">
                        {catMap.get(p.category_id)}
                      </Badge>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground group-hover:text-primary transition-colors truncate">
                        {p.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                        <span>{nameMap.get(p.author_id) || "익명"}</span>
                        <span>·</span>
                        <span>{timeAgo(p.created_at)}</span>
                        <span className="flex items-center gap-0.5"><Heart className="h-3 w-3" />{stats?.likes[p.id] || 0}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CommunityHighlights;