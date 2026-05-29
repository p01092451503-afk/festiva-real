import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Heart, MessageCircle, Eye, Bookmark, Flag, Trash2, ArrowLeft, Pin } from "lucide-react";
import { toast } from "sonner";
import FollowButton from "@/components/community/FollowButton";
import QnaAnswers from "@/components/community/QnaAnswers";
import UserBadges from "@/components/community/UserBadges";

const PostDetail = () => {
  const { postId } = useParams<{ postId: string }>();
  const { user } = useUser();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [newComment, setNewComment] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportData, setReportData] = useState({ reason: "스팸/광고", detail: "" });
  const [viewed, setViewed] = useState(false);

  const { data: post, isLoading } = useQuery({
    queryKey: ["community-post", postId],
    enabled: !!postId,
    queryFn: async () => {
      const { data } = await supabase.from("community_posts" as any).select("*").eq("id", postId!).maybeSingle();
      if (data && !viewed) {
        setViewed(true);
        await supabase.from("community_posts" as any).update({ view_count: ((data as any).view_count || 0) + 1 } as any).eq("id", postId!);
      }
      return data as any;
    },
  });

  const { data: category } = useQuery({
    queryKey: ["community-post-category", post?.category_id],
    enabled: !!post?.category_id,
    queryFn: async () => {
      const { data } = await supabase.from("community_categories" as any).select("name, category_type").eq("id", post.category_id).maybeSingle();
      return data as any;
    },
  });

  const { data: author } = useQuery({
    queryKey: ["community-post-author", post?.author_id],
    enabled: !!post?.author_id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, avatar_url, position").eq("user_id", post.author_id).maybeSingle();
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["community-post-stats", postId, user?.id],
    enabled: !!postId,
    queryFn: async () => {
      const [likes, myLike, myBookmark] = await Promise.all([
        supabase.from("community_likes" as any).select("id", { count: "exact", head: true }).eq("post_id", postId!),
        user ? supabase.from("community_likes" as any).select("id").eq("post_id", postId!).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
        user ? supabase.from("community_bookmarks" as any).select("id").eq("post_id", postId!).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      return { likes: likes.count || 0, liked: !!myLike.data, bookmarked: !!myBookmark.data };
    },
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["community-post-comments", postId],
    enabled: !!postId,
    queryFn: async () => {
      const { data } = await supabase.from("community_comments" as any).select("*").eq("post_id", postId!).order("created_at");
      return (data as any[]) || [];
    },
  });
  const commentAuthorIds = useMemo(() => [...new Set(comments.map((c: any) => c.author_id))], [comments]);
  const { data: commentAuthors = [] } = useQuery({
    queryKey: ["community-post-comment-authors", commentAuthorIds],
    enabled: commentAuthorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", commentAuthorIds);
      return data || [];
    },
  });
  const cMap = new Map(commentAuthors.map((p: any) => [p.user_id, p]));

  const toggleLike = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("로그인이 필요합니다");
      if (stats?.liked) {
        await supabase.from("community_likes" as any).delete().eq("post_id", postId!).eq("user_id", user.id);
      } else {
        await supabase.from("community_likes" as any).insert({ post_id: postId!, user_id: user.id } as any);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-post-stats", postId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const toggleBookmark = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("로그인이 필요합니다");
      if (stats?.bookmarked) {
        await supabase.from("community_bookmarks" as any).delete().eq("post_id", postId!).eq("user_id", user.id);
      } else {
        await supabase.from("community_bookmarks" as any).insert({ post_id: postId!, user_id: user.id } as any);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-post-stats", postId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("로그인이 필요합니다");
      const { error } = await supabase.from("community_comments" as any).insert({
        post_id: postId!, author_id: user.id, content: newComment.trim(),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setNewComment("");
      qc.invalidateQueries({ queryKey: ["community-post-comments", postId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("community_comments" as any).delete().eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-post-comments", postId] }),
  });

  const deletePost = useMutation({
    mutationFn: async () => {
      await supabase.from("community_posts" as any).delete().eq("id", postId!);
    },
    onSuccess: () => {
      toast.success("삭제되었습니다");
      nav("/student/community");
    },
  });

  const submitReport = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("로그인이 필요합니다");
      const { error } = await supabase.from("community_reports" as any).insert({
        target_type: "post", target_id: postId!, reporter_id: user.id,
        reason: reportData.reason, detail: reportData.detail.trim() || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("신고가 접수되었습니다");
      setReportOpen(false);
      setReportData({ reason: "스팸/광고", detail: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <DashboardLayout><div className="py-10 text-center text-muted-foreground">불러오는 중...</div></DashboardLayout>;
  if (!post) return <DashboardLayout><div className="py-10 text-center text-muted-foreground">게시글을 찾을 수 없습니다.</div></DashboardLayout>;

  const isOwner = user?.id === post.author_id;

  return (
    <DashboardLayout>
      <div className="space-y-6 min-w-0 max-w-3xl">
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link to="/student/community"><ArrowLeft className="h-4 w-4 mr-1" /> 커뮤니티로</Link>
        </Button>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              {post.is_pinned && <Badge variant="secondary" className="whitespace-nowrap"><Pin className="h-3 w-3 mr-1" />고정</Badge>}
              {category && <Badge variant="outline" className="whitespace-nowrap">{category.name}</Badge>}
              <span className="text-xs text-muted-foreground ml-auto">{new Date(post.created_at).toLocaleString("ko-KR")}</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-semibold">{post.title}</h1>

            <div className="flex items-center gap-3 pb-4 border-b border-border/60">
              <Link to={`/community/members/${post.author_id}`} className="flex items-center gap-2 hover:underline">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={author?.avatar_url || undefined} />
                  <AvatarFallback>{author?.full_name?.[0] || "?"}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-sm font-medium">{author?.full_name || "멤버"}</div>
                  {author?.position && <div className="text-xs text-muted-foreground">{author.position}</div>}
                  <div className="mt-1"><UserBadges userId={post.author_id} size="sm" /></div>
                </div>
              </Link>
              <div className="ml-auto"><FollowButton targetUserId={post.author_id} /></div>
            </div>

            <div className="whitespace-pre-wrap text-sm leading-relaxed">{post.content}</div>

            {post.image_urls?.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                {post.image_urls.map((url: string, i: number) => (
                  <img key={i} src={url} alt="" className="rounded border border-border w-full h-32 object-cover" loading="lazy" />
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 pt-3 border-t border-border/60">
              <Button variant="outline" size="sm" onClick={() => toggleLike.mutate()} className="gap-1.5">
                <Heart className={`h-4 w-4 ${stats?.liked ? "fill-current text-destructive" : ""}`} />
                {stats?.likes ?? 0}
              </Button>
              <Button variant="outline" size="sm" onClick={() => toggleBookmark.mutate()} className="gap-1.5">
                <Bookmark className={`h-4 w-4 ${stats?.bookmarked ? "fill-current" : ""}`} />
              </Button>
              <span className="flex items-center gap-1 text-sm text-muted-foreground ml-2">
                <Eye className="h-4 w-4" /> {post.view_count || 0}
              </span>
              <div className="ml-auto flex gap-2">
                {!isOwner && user && (
                  <Button variant="ghost" size="sm" onClick={() => setReportOpen(true)} className="text-muted-foreground gap-1.5">
                    <Flag className="h-4 w-4" /> 신고
                  </Button>
                )}
                {isOwner && (
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm("삭제할까요?")) deletePost.mutate(); }} className="text-destructive gap-1.5">
                    <Trash2 className="h-4 w-4" /> 삭제
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {category?.category_type === "qna" && (
          <QnaAnswers postId={post.id} postAuthorId={post.author_id} />
        )}

        <section className="space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <MessageCircle className="h-4 w-4" /> 댓글 {comments.length}
          </h2>

          {user && (
            <div className="space-y-2">
              <Textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="댓글을 입력하세요" rows={3} />
              <div className="flex justify-end">
                <Button size="sm" onClick={() => addComment.mutate()} disabled={!newComment.trim() || addComment.isPending}>등록</Button>
              </div>
            </div>
          )}

          <div>
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">첫 댓글을 남겨보세요.</p>
            ) : (
              comments.map((c: any) => {
                const ca = cMap.get(c.author_id) as any;
                return (
                  <div key={c.id} className="border-b-2 border-border/80 py-3 flex items-start gap-3">
                    <Link to={`/community/members/${c.author_id}`}>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={ca?.avatar_url || undefined} />
                        <AvatarFallback>{ca?.full_name?.[0] || "?"}</AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Link to={`/community/members/${c.author_id}`} className="font-medium text-foreground hover:underline">{ca?.full_name || "멤버"}</Link>
                        <span>·</span>
                        <span>{new Date(c.created_at).toLocaleString("ko-KR")}</span>
                      </div>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{c.content}</p>
                    </div>
                    {user?.id === c.author_id && (
                      <Button size="icon" variant="ghost" className="text-destructive h-7 w-7" onClick={() => deleteComment.mutate(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>게시글 신고</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={reportData.reason} onValueChange={(v) => setReportData((s) => ({ ...s, reason: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="스팸/광고">스팸/광고</SelectItem>
                <SelectItem value="욕설/비방">욕설/비방</SelectItem>
                <SelectItem value="음란/선정성">음란/선정성</SelectItem>
                <SelectItem value="허위 정보">허위 정보</SelectItem>
                <SelectItem value="기타">기타</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="상세 사유 (선택)" value={reportData.detail} onChange={(e) => setReportData((s) => ({ ...s, detail: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>취소</Button>
            <Button onClick={() => submitReport.mutate()}>신고</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default PostDetail;