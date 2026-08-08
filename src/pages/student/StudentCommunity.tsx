import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import RichTextEditor from "@/components/community/RichTextEditor";
import RichTextContent from "@/components/community/RichTextContent";
const stripHtml = (html: string) => (html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim();
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Heart, MessageCircle, Eye, Bookmark, Pin, Plus, Search, Users2, Trash2, X, Image as ImageIcon, Flag, Rss, Trophy } from "lucide-react";
import { toast } from "sonner";
import CommunityRankingPanel from "@/components/community/CommunityRankingPanel";
import MyFeedPanel from "@/components/community/MyFeedPanel";
import RankingPanel from "@/components/community/RankingPanel";

type SortKey = "latest" | "popular";

const StudentCommunity = () => {
  const { user } = useUser();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [view, setView] = useState<"board" | "feed" | "ranking">("board");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("latest");
  const [search, setSearch] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [composer, setComposer] = useState({ title: "", content: "", category_id: "" as string });
  const [files, setFiles] = useState<File[]>([]);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [newComment, setNewComment] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportData, setReportData] = useState({ reason: "스팸/광고", detail: "" });

  // 카테고리
  const { data: categories = [] } = useQuery({
    queryKey: ["community-categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("community_categories" as any)
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      return (data as any[]) || [];
    },
  });

  // 게시글
  const { data: rawPosts = [] } = useQuery({
    queryKey: ["community-posts", activeCat, sort],
    queryFn: async () => {
      let q = supabase.from("community_posts" as any).select("*").eq("is_hidden", false);
      if (activeCat !== "all") q = q.eq("category_id", activeCat);
      const { data } = await q.order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(200);
      return (data as any[]) || [];
    },
  });

  const postIds = useMemo(() => rawPosts.map((p: any) => p.id), [rawPosts]);

  // 좋아요 / 댓글 / 북마크 카운트
  const { data: stats = { likes: {}, comments: {}, myLikes: new Set(), myBookmarks: new Set() } } = useQuery({
    queryKey: ["community-stats", postIds, user?.id],
    enabled: postIds.length > 0,
    queryFn: async () => {
      const [likes, comments, myLikes, myBookmarks] = await Promise.all([
        supabase.from("community_likes" as any).select("post_id").in("post_id", postIds),
        supabase.from("community_comments" as any).select("post_id").in("post_id", postIds),
        user ? supabase.from("community_likes" as any).select("post_id").eq("user_id", user.id).in("post_id", postIds) : Promise.resolve({ data: [] }),
        user ? supabase.from("community_bookmarks" as any).select("post_id").eq("user_id", user.id).in("post_id", postIds) : Promise.resolve({ data: [] }),
      ]);
      const lk: Record<string, number> = {}, cm: Record<string, number> = {};
      ((likes.data as any[]) || []).forEach((r) => (lk[r.post_id] = (lk[r.post_id] || 0) + 1));
      ((comments.data as any[]) || []).forEach((r) => (cm[r.post_id] = (cm[r.post_id] || 0) + 1));
      return {
        likes: lk, comments: cm,
        myLikes: new Set(((myLikes.data as any[]) || []).map((r) => r.post_id)),
        myBookmarks: new Set(((myBookmarks.data as any[]) || []).map((r) => r.post_id)),
      };
    },
  });

  // 작성자 프로필
  const authorIds = useMemo(() => [...new Set(rawPosts.map((p: any) => p.author_id))], [rawPosts]);
  const { data: profiles = [] } = useQuery({
    queryKey: ["community-authors", authorIds],
    enabled: authorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", authorIds);
      return data || [];
    },
  });
  const profileMap = new Map(profiles.map((p: any) => [p.user_id, p]));

  // 필터/정렬 적용
  const posts = useMemo(() => {
    let list = rawPosts;
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((p: any) => p.title.toLowerCase().includes(s) || stripHtml(p.content).toLowerCase().includes(s));
    }
    if (sort === "popular") {
      list = [...list].sort((a: any, b: any) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        const score = (p: any) => (stats.likes[p.id] || 0) * 2 + (stats.comments[p.id] || 0) + (p.view_count || 0) * 0.1;
        return score(b) - score(a);
      });
    }
    return list;
  }, [rawPosts, search, sort, stats]);

  // 댓글 (상세 다이얼로그용)
  const { data: detailComments = [] } = useQuery({
    queryKey: ["community-detail-comments", selectedPost?.id],
    enabled: !!selectedPost,
    queryFn: async () => {
      const { data } = await supabase
        .from("community_comments" as any)
        .select("*")
        .eq("post_id", selectedPost.id)
        .order("created_at");
      return (data as any[]) || [];
    },
  });
  const commentAuthorIds = useMemo(() => [...new Set(detailComments.map((c: any) => c.author_id))], [detailComments]);
  const { data: commentProfiles = [] } = useQuery({
    queryKey: ["community-comment-authors", commentAuthorIds],
    enabled: commentAuthorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", commentAuthorIds);
      return data || [];
    },
  });
  const commentProfileMap = new Map(commentProfiles.map((p: any) => [p.user_id, p.full_name]));

  // 작성
  const createPost = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("login required");
      const urls: string[] = [];
      for (const f of files.slice(0, 5)) {
        const path = `${user.id}/${Date.now()}_${f.name}`;
        const { error } = await supabase.storage.from("community-images").upload(path, f);
        if (error) throw error;
        const { data } = supabase.storage.from("community-images").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      const { error } = await supabase.from("community_posts" as any).insert({
        title: composer.title.trim(),
        content: composer.content.trim(),
        category_id: composer.category_id || null,
        author_id: user.id,
        image_urls: urls,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("게시글이 등록되었습니다");
      setComposerOpen(false);
      setComposer({ title: "", content: "", category_id: "" });
      setFiles([]);
      qc.invalidateQueries({ queryKey: ["community-posts"] });
    },
    onError: (e: any) => toast.error(e.message || "등록 실패"),
  });

  // 좋아요 토글
  const toggleLike = useMutation({
    mutationFn: async (postId: string) => {
      if (!user) throw new Error("login required");
      if (stats.myLikes.has(postId)) {
        await supabase.from("community_likes" as any).delete().eq("post_id", postId).eq("user_id", user.id);
      } else {
        await supabase.from("community_likes" as any).insert({ post_id: postId, user_id: user.id } as any);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-stats"] }),
  });

  // 북마크 토글
  const toggleBookmark = useMutation({
    mutationFn: async (postId: string) => {
      if (!user) throw new Error("login required");
      if (stats.myBookmarks.has(postId)) {
        await supabase.from("community_bookmarks" as any).delete().eq("post_id", postId).eq("user_id", user.id);
      } else {
        await supabase.from("community_bookmarks" as any).insert({ post_id: postId, user_id: user.id } as any);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-stats"] }),
  });

  // 상세 열기 (조회수 증가)
  const openDetail = async (post: any) => {
    setSelectedPost(post);
    await supabase.from("community_posts" as any).update({ view_count: (post.view_count || 0) + 1 } as any).eq("id", post.id);
    qc.invalidateQueries({ queryKey: ["community-posts"] });
  };

  // 댓글 등록
  const addComment = useMutation({
    mutationFn: async () => {
      if (!user || !selectedPost) return;
      const { error } = await supabase.from("community_comments" as any).insert({
        post_id: selectedPost.id, author_id: user.id, content: newComment.trim(),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setNewComment("");
      qc.invalidateQueries({ queryKey: ["community-detail-comments"] });
      qc.invalidateQueries({ queryKey: ["community-stats"] });
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("community_comments" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-detail-comments"] }),
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("community_posts" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelectedPost(null);
      qc.invalidateQueries({ queryKey: ["community-posts"] });
      toast.success("삭제되었습니다");
    },
  });

  const submitReport = useMutation({
    mutationFn: async () => {
      if (!user || !selectedPost) return;
      const { error } = await supabase.from("community_reports" as any).insert({
        target_type: "post",
        target_id: selectedPost.id,
        reporter_id: user.id,
        reason: reportData.reason,
        detail: reportData.detail.trim() || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("신고가 접수되었습니다");
      setReportOpen(false);
      setReportData({ reason: "스팸/광고", detail: "" });
    },
    onError: (e: any) => toast.error(e.message || "신고 실패"),
  });

  const getCatName = (id: string | null) => categories.find((c: any) => c.id === id)?.name || "기타";
  const timeAgo = (d: string) => {
    const diff = (Date.now() - new Date(d).getTime()) / 1000;
    if (diff < 60) return "방금 전";
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return new Date(d).toLocaleDateString();
  };

  return (
    <DashboardLayout role="student">
      <div className="space-y-6 min-w-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
              <Users2 className="h-6 w-6" />
              커뮤니티
            </h1>
            <p className="text-sm text-muted-foreground mt-1">학습자들과 자유롭게 소통하고 정보를 공유하세요.</p>
          </div>
          {view === "board" && (
            <Button onClick={() => setComposerOpen(true)} className="rounded-full">
              <Plus className="h-4 w-4 mr-1" /> 글쓰기
            </Button>
          )}
        </div>

        {/* 메인 뷰 탭: 게시판 / 내 피드 / 랭킹 */}
        <Tabs value={view} onValueChange={(v) => setView(v as any)}>
          <TabsList>
            <TabsTrigger value="board" className="gap-1.5"><Users2 className="h-3.5 w-3.5" /> 게시판</TabsTrigger>
            <TabsTrigger value="feed" className="gap-1.5"><Rss className="h-3.5 w-3.5" /> 내 피드</TabsTrigger>
            <TabsTrigger value="ranking" className="gap-1.5"><Trophy className="h-3.5 w-3.5" /> 랭킹</TabsTrigger>
          </TabsList>
        </Tabs>

        {view === "board" && (
          <>
            {/* 카테고리 탭 */}
            <Tabs value={activeCat} onValueChange={setActiveCat}>
              <TabsList className="flex flex-wrap h-auto">
                <TabsTrigger value="all">전체</TabsTrigger>
                {categories.map((c: any) => (
                  <TabsTrigger key={c.id} value={c.id}>{c.name}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* 랭킹 & 뱃지 */}
            <CommunityRankingPanel />

            {/* 검색 + 정렬 */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="제목 / 본문 검색" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">최신순</SelectItem>
                  <SelectItem value="popular">인기순</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 목록 */}
            {posts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">아직 게시글이 없습니다. 첫 글을 작성해보세요!</p>
            ) : (
              <div className="space-y-2">
                {posts.map((p: any) => {
                  const author = profileMap.get(p.author_id) as any;
                  return (
                    <Card key={p.id} className="cursor-pointer hover:shadow-sm transition-shadow border-b-2 border-border/80" onClick={() => navigate(`/community/posts/${p.id}`)}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                            {author?.full_name?.[0] || "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              {p.is_pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
                              <Badge variant="outline" className="text-[10px] whitespace-nowrap">{getCatName(p.category_id)}</Badge>
                              <span className="text-xs text-muted-foreground">{author?.full_name || "익명"}</span>
                              <span className="text-[11px] text-muted-foreground">· {timeAgo(p.created_at)}</span>
                            </div>
                            <h3 className="font-medium text-foreground truncate">{p.title}</h3>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{stripHtml(p.content)}</p>
                            <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{p.view_count}</span>
                              <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{stats.likes[p.id] || 0}</span>
                              <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{stats.comments[p.id] || 0}</span>
                              {(p.image_urls?.length || 0) > 0 && <span className="flex items-center gap-1"><ImageIcon className="h-3 w-3" />{p.image_urls.length}</span>}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {view === "feed" && <MyFeedPanel />}
        {view === "ranking" && <RankingPanel />}
      </div>

      {/* 작성 다이얼로그 */}
      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>새 글 작성</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={composer.category_id} onValueChange={(v) => setComposer((s) => ({ ...s, category_id: v }))}>
              <SelectTrigger><SelectValue placeholder="카테고리 선택" /></SelectTrigger>
              <SelectContent>
                {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="제목" value={composer.title} onChange={(e) => setComposer((s) => ({ ...s, title: e.target.value }))} />
            <RichTextEditor
              value={composer.content}
              onChange={(html) => setComposer((s) => ({ ...s, content: html }))}
              placeholder="내용을 입력하세요"
            />
            <div>
              <label className="text-xs text-muted-foreground">이미지 첨부 (최대 5장)</label>
              <Input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))} className="mt-1" />
              {files.length > 0 && <p className="text-[11px] text-muted-foreground mt-1">{files.length}개 선택됨</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposerOpen(false)}>취소</Button>
            <Button onClick={() => createPost.mutate()} disabled={!composer.title.trim() || !stripHtml(composer.content) || createPost.isPending}>
              {createPost.isPending ? "등록 중..." : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 상세 다이얼로그 */}
      <Dialog open={!!selectedPost} onOpenChange={(v) => { if (!v) setSelectedPost(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedPost && (() => {
            const author = profileMap.get(selectedPost.author_id) as any;
            const liked = stats.myLikes.has(selectedPost.id);
            const bookmarked = stats.myBookmarks.has(selectedPost.id);
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <Badge variant="outline" className="text-[10px]">{getCatName(selectedPost.category_id)}</Badge>
                    {selectedPost.is_pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
                  </div>
                  <DialogTitle className="text-lg">{selectedPost.title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{author?.full_name || "익명"}</span>
                    <span>· {timeAgo(selectedPost.created_at)}</span>
                    <span className="ml-auto flex items-center gap-1"><Eye className="h-3 w-3" />{selectedPost.view_count + 1}</span>
                  </div>
                  <RichTextContent html={selectedPost.content} />
                  {(selectedPost.image_urls?.length || 0) > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {selectedPost.image_urls.map((u: string, i: number) => (
                        <img key={i} src={u} alt="" className="rounded border w-full object-cover max-h-60" loading="lazy" />
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Button size="sm" variant={liked ? "default" : "outline"} onClick={() => toggleLike.mutate(selectedPost.id)}>
                      <Heart className={`h-4 w-4 mr-1 ${liked ? "fill-current" : ""}`} />
                      {stats.likes[selectedPost.id] || 0}
                    </Button>
                    <Button size="sm" variant={bookmarked ? "default" : "outline"} onClick={() => toggleBookmark.mutate(selectedPost.id)}>
                      <Bookmark className={`h-4 w-4 mr-1 ${bookmarked ? "fill-current" : ""}`} />
                      {bookmarked ? "북마크됨" : "북마크"}
                    </Button>
                    {user?.id === selectedPost.author_id && (
                      <Button size="sm" variant="ghost" className="ml-auto text-destructive" onClick={() => deletePost.mutate(selectedPost.id)}>
                        <Trash2 className="h-4 w-4 mr-1" /> 삭제
                      </Button>
                    )}
                    {user && user.id !== selectedPost.author_id && (
                      <Button size="sm" variant="ghost" className="ml-auto text-muted-foreground" onClick={() => setReportOpen(true)}>
                        <Flag className="h-4 w-4 mr-1" /> 신고
                      </Button>
                    )}
                  </div>

                  {/* 댓글 */}
                  <div className="space-y-3 pt-2 border-t border-border">
                    <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <MessageCircle className="h-3.5 w-3.5" /> 댓글 {detailComments.length}
                    </h4>
                    {detailComments.map((c: any) => (
                      <div key={c.id} className="flex items-start gap-2 group">
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] shrink-0">
                          {(commentProfileMap.get(c.author_id) as string)?.[0] || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">{commentProfileMap.get(c.author_id) as string || "익명"}</span>
                            <span className="text-[10px] text-muted-foreground">{timeAgo(c.created_at)}</span>
                          </div>
                          <p className="text-xs mt-0.5 whitespace-pre-wrap">{c.content}</p>
                        </div>
                        {user?.id === c.author_id && (
                          <button onClick={() => deleteComment.mutate(c.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    {user && (
                      <div className="flex gap-2">
                        <Textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="댓글 입력..." className="text-xs min-h-[60px] flex-1 resize-none" />
                        <Button size="sm" className="self-end" disabled={!newComment.trim() || addComment.isPending} onClick={() => addComment.mutate()}>
                          등록
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* 신고 다이얼로그 */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>게시글 신고</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={reportData.reason} onValueChange={(v) => setReportData((s) => ({ ...s, reason: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["스팸/광고", "욕설/비방", "음란/혐오", "허위정보", "저작권 침해", "기타"].map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea placeholder="상세 사유 (선택)" rows={4} value={reportData.detail} onChange={(e) => setReportData((s) => ({ ...s, detail: e.target.value }))} />
            <p className="text-[11px] text-muted-foreground">신고된 내용은 운영자가 검토합니다.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>취소</Button>
            <Button onClick={() => submitReport.mutate()} disabled={submitReport.isPending}>접수</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default StudentCommunity;