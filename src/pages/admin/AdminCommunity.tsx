import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users2, Pin, EyeOff, Eye, Trash2, Plus, Flag, BarChart3, MessageSquare, Heart, FileText, Check, X, Pencil, ChevronRight } from "lucide-react";
import { RefreshCw, Trophy } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const AdminCommunity = () => {
  const qc = useQueryClient();
  const emptyCat = {
    id: "" as string | "",
    name: "",
    slug: "",
    parent_id: "none" as string,
    category_type: "general",
    write_role: "all",
    icon: "",
  };
  const [catForm, setCatForm] = useState(emptyCat);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [reportFilter, setReportFilter] = useState<"pending" | "all" | "resolved" | "rejected">("pending");
  const [aggregating, setAggregating] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-community-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("community_categories" as any).select("*").order("sort_order");
      return (data as any[]) || [];
    },
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["admin-community-posts"],
    queryFn: async () => {
      const { data } = await supabase.from("community_posts" as any).select("*").order("created_at", { ascending: false }).limit(500);
      return (data as any[]) || [];
    },
  });

  const authorIds = [...new Set(posts.map((p: any) => p.author_id))];
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-community-authors", authorIds],
    enabled: authorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", authorIds);
      return data || [];
    },
  });
  const profileMap = new Map(profiles.map((p: any) => [p.user_id, p.full_name]));

  // 신고 목록
  const { data: reports = [] } = useQuery({
    queryKey: ["admin-community-reports"],
    queryFn: async () => {
      const { data } = await supabase.from("community_reports" as any).select("*").order("created_at", { ascending: false }).limit(300);
      return (data as any[]) || [];
    },
  });
  const pendingReports = reports.filter((r: any) => r.status === "pending");

  const reporterIds = [...new Set(reports.map((r: any) => r.reporter_id))];
  const { data: reporterProfiles = [] } = useQuery({
    queryKey: ["admin-community-reporters", reporterIds],
    enabled: reporterIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", reporterIds);
      return data || [];
    },
  });
  const reporterMap = new Map(reporterProfiles.map((p: any) => [p.user_id, p.full_name]));
  const postMap = new Map(posts.map((p: any) => [p.id, p]));

  // 신고된 댓글 ID 수집
  const reportedCommentIds = [...new Set(reports.filter((r: any) => r.target_type === "comment").map((r: any) => r.target_id))];
  const { data: reportedComments = [] } = useQuery({
    queryKey: ["admin-community-reported-comments", reportedCommentIds],
    enabled: reportedCommentIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("community_comments" as any).select("id, post_id, content, is_hidden, author_id").in("id", reportedCommentIds);
      return (data as any[]) || [];
    },
  });
  const commentMap = new Map(reportedComments.map((c: any) => [c.id, c]));

  const filteredReports = reports.filter((r: any) => reportFilter === "all" || r.status === reportFilter);

  const hideCommentFromReport = useMutation({
    mutationFn: async (commentId: string) => {
      await supabase.from("community_comments" as any).update({ is_hidden: true } as any).eq("id", commentId);
    },
    onSuccess: () => {
      toast.success("댓글을 숨김 처리했습니다");
      qc.invalidateQueries({ queryKey: ["admin-community-reported-comments"] });
    },
  });

  const runAggregation = async () => {
    setAggregating(true);
    try {
      const { error } = await supabase.functions.invoke("community-rankings-cron");
      if (error) throw error;
      toast.success("랭킹 집계가 완료되었습니다");
    } catch (e: any) {
      toast.error(e.message || "집계 실패");
    } finally {
      setAggregating(false);
    }
  };

  // 통계 데이터
  const { data: stats } = useQuery({
    queryKey: ["admin-community-stats"],
    queryFn: async () => {
      const [likes, comments, bookmarks] = await Promise.all([
        supabase.from("community_likes" as any).select("id", { count: "exact", head: true }),
        supabase.from("community_comments" as any).select("id", { count: "exact", head: true }),
        supabase.from("community_bookmarks" as any).select("id", { count: "exact", head: true }),
      ]);
      return {
        likes: likes.count || 0,
        comments: comments.count || 0,
        bookmarks: bookmarks.count || 0,
      };
    },
  });

  const totalViews = posts.reduce((s: number, p: any) => s + (p.view_count || 0), 0);
  const postsByCategory = categories.map((c: any) => ({
    name: c.name,
    count: posts.filter((p: any) => p.category_id === c.id).length,
  }));
  const topPosts = [...posts].sort((a: any, b: any) => (b.view_count || 0) - (a.view_count || 0)).slice(0, 5);

  const togglePin = useMutation({
    mutationFn: async (p: any) => {
      await supabase.from("community_posts" as any).update({ is_pinned: !p.is_pinned } as any).eq("id", p.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-community-posts"] }),
  });

  const toggleHide = useMutation({
    mutationFn: async (p: any) => {
      await supabase.from("community_posts" as any).update({ is_hidden: !p.is_hidden } as any).eq("id", p.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-community-posts"] }),
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("community_posts" as any).delete().eq("id", id);
    },
    onSuccess: () => {
      toast.success("삭제되었습니다");
      qc.invalidateQueries({ queryKey: ["admin-community-posts"] });
    },
  });

  const saveCategory = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: catForm.name.trim(),
        slug: catForm.slug.trim(),
        parent_id: catForm.parent_id === "none" ? null : catForm.parent_id,
        category_type: catForm.category_type,
        write_role: catForm.write_role,
        icon: catForm.icon.trim() || null,
      };
      if (catForm.id) {
        const { error } = await supabase.from("community_categories" as any).update(payload).eq("id", catForm.id);
        if (error) throw error;
      } else {
        payload.sort_order = (categories[categories.length - 1]?.sort_order || 0) + 1;
        const { error } = await supabase.from("community_categories" as any).insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(catForm.id ? "수정되었습니다" : "추가되었습니다");
      setCatDialogOpen(false);
      setCatForm(emptyCat);
      qc.invalidateQueries({ queryKey: ["admin-community-categories"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openCatDialog = (c?: any) => {
    setCatForm(c ? {
      id: c.id, name: c.name || "", slug: c.slug || "",
      parent_id: c.parent_id || "none",
      category_type: c.category_type || "general",
      write_role: c.write_role || "all",
      icon: c.icon || "",
    } : emptyCat);
    setCatDialogOpen(true);
  };

  const toggleCat = useMutation({
    mutationFn: async (c: any) => {
      await supabase.from("community_categories" as any).update({ is_active: !c.is_active } as any).eq("id", c.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-community-categories"] }),
  });

  const deleteCat = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("community_categories" as any).delete().eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-community-categories"] }),
  });

  const resolveReport = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "resolved" | "rejected" }) => {
      await supabase.from("community_reports" as any).update({
        status, resolved_at: new Date().toISOString(),
      } as any).eq("id", id);
    },
    onSuccess: () => {
      toast.success("처리되었습니다");
      qc.invalidateQueries({ queryKey: ["admin-community-reports"] });
    },
  });

  const hidePostFromReport = useMutation({
    mutationFn: async (postId: string) => {
      await supabase.from("community_posts" as any).update({ is_hidden: true } as any).eq("id", postId);
    },
    onSuccess: () => {
      toast.success("게시글을 숨김 처리했습니다");
      qc.invalidateQueries({ queryKey: ["admin-community-posts"] });
    },
  });

  const catName = (id: string | null) => categories.find((c: any) => c.id === id)?.name || "기타";

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 min-w-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <Users2 className="h-6 w-6" /> 커뮤니티 관리
          </h1>
          <p className="text-sm text-muted-foreground mt-1">게시글과 카테고리를 관리합니다.</p>
        </div>

        <Tabs defaultValue="posts">
          <TabsList>
            <TabsTrigger value="posts">게시글 ({posts.length})</TabsTrigger>
            <TabsTrigger value="categories">카테고리 ({categories.length})</TabsTrigger>
            <TabsTrigger value="reports">
              신고 ({pendingReports.length}{pendingReports.length > 0 && " 대기"})
            </TabsTrigger>
            <TabsTrigger value="stats">통계</TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="space-y-2 mt-4">
            {posts.length === 0 && <p className="text-sm text-muted-foreground">게시글이 없습니다.</p>}
            {posts.map((p: any) => (
              <Card key={p.id} className={p.is_hidden ? "opacity-50" : ""}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {p.is_pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
                      <Badge variant="outline" className="text-[10px]">{catName(p.category_id)}</Badge>
                      <span className="text-xs text-muted-foreground">{profileMap.get(p.author_id) || "익명"}</span>
                      <span className="text-[11px] text-muted-foreground">· {new Date(p.created_at).toLocaleString()}</span>
                    </div>
                    <p className="font-medium text-foreground truncate">{p.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{p.content}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" title={p.is_pinned ? "고정 해제" : "고정"} onClick={() => togglePin.mutate(p)}>
                      <Pin className={`h-4 w-4 ${p.is_pinned ? "text-primary" : ""}`} />
                    </Button>
                    <Button size="icon" variant="ghost" title={p.is_hidden ? "표시" : "숨김"} onClick={() => toggleHide.mutate(p)}>
                      {p.is_hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (confirm("삭제할까요?")) deletePost.mutate(p.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="categories" className="space-y-2 mt-4">
            <Button size="sm" onClick={() => openCatDialog()}><Plus className="h-4 w-4 mr-1" /> 카테고리 추가</Button>
            {categories.filter((c: any) => !c.parent_id).map((parent: any) => {
              const children = categories.filter((c: any) => c.parent_id === parent.id);
              return (
                <div key={parent.id} className="space-y-2">
                  <CategoryRow c={parent} onEdit={openCatDialog} onToggle={(c) => toggleCat.mutate(c)} onDelete={(id) => { if (confirm("삭제할까요? 하위 카테고리는 최상위로 이동합니다.")) deleteCat.mutate(id); }} />
                  {children.map((child: any) => (
                    <div key={child.id} className="pl-6 flex items-center gap-1">
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1"><CategoryRow c={child} onEdit={openCatDialog} onToggle={(c) => toggleCat.mutate(c)} onDelete={(id) => { if (confirm("삭제할까요?")) deleteCat.mutate(id); }} /></div>
                    </div>
                  ))}
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="reports" className="space-y-2 mt-4">
            <div className="flex items-center gap-2 flex-wrap">
              {(["pending", "all", "resolved", "rejected"] as const).map((s) => (
                <Button key={s} size="sm" variant={reportFilter === s ? "default" : "outline"} onClick={() => setReportFilter(s)}>
                  {s === "pending" ? `대기 (${pendingReports.length})` : s === "all" ? `전체 (${reports.length})` : s === "resolved" ? "처리됨" : "기각됨"}
                </Button>
              ))}
            </div>
            {filteredReports.length === 0 && <p className="text-sm text-muted-foreground py-4">신고 내역이 없습니다.</p>}
            {filteredReports.map((r: any) => {
              const isComment = r.target_type === "comment";
              const post = !isComment ? postMap.get(r.target_id) : null;
              const comment = isComment ? commentMap.get(r.target_id) : null;
              const targetTitle = isComment ? "(댓글)" : (post?.title || "(삭제된 게시글)");
              const targetBody = isComment ? comment?.content : post?.content;
              const targetHidden = isComment ? comment?.is_hidden : post?.is_hidden;
              const targetPostId = isComment ? comment?.post_id : r.target_id;
              return (
                <Card key={r.id} className={r.status !== "pending" ? "opacity-60" : ""}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={r.status === "pending" ? "destructive" : "outline"} className="text-[10px]">
                        {r.status === "pending" ? "대기" : r.status === "resolved" ? "처리됨" : "기각됨"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">{isComment ? "댓글" : "게시글"}</Badge>
                      <Badge variant="outline" className="text-[10px]">{r.reason}</Badge>
                      <span className="text-xs text-muted-foreground">
                        신고자: {reporterMap.get(r.reporter_id) || "익명"} · {new Date(r.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-muted/40 rounded p-2 text-xs">
                      <p className="font-medium truncate">{targetTitle}</p>
                      <p className="text-muted-foreground line-clamp-2 mt-0.5 whitespace-pre-wrap">{targetBody || "(삭제됨)"}</p>
                      {targetPostId && <a href={`/community/posts/${targetPostId}`} target="_blank" rel="noopener" className="text-[11px] text-primary hover:underline mt-1 inline-block">원문 보기 →</a>}
                    </div>
                    {r.detail && <p className="text-xs text-muted-foreground">상세: {r.detail}</p>}
                    {r.status === "pending" && (
                      <div className="flex gap-2 pt-1 flex-wrap">
                        <Button size="sm" variant="outline" onClick={() => resolveReport.mutate({ id: r.id, status: "resolved" })}>
                          <Check className="h-3.5 w-3.5 mr-1" /> 처리완료
                        </Button>
                        {!isComment && post && !post.is_hidden && (
                          <Button size="sm" variant="outline" onClick={() => { hidePostFromReport.mutate(post.id); resolveReport.mutate({ id: r.id, status: "resolved" }); }}>
                            <EyeOff className="h-3.5 w-3.5 mr-1" /> 게시글 숨김 + 처리
                          </Button>
                        )}
                        {isComment && comment && !targetHidden && (
                          <Button size="sm" variant="outline" onClick={() => { hideCommentFromReport.mutate(comment.id); resolveReport.mutate({ id: r.id, status: "resolved" }); }}>
                            <EyeOff className="h-3.5 w-3.5 mr-1" /> 댓글 숨김 + 처리
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => resolveReport.mutate({ id: r.id, status: "rejected" })}>
                          <X className="h-3.5 w-3.5 mr-1" /> 기각
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="stats" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card><CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><FileText className="h-3.5 w-3.5" /> 전체 게시글</div>
                <p className="text-2xl font-semibold mt-1">{posts.length}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Eye className="h-3.5 w-3.5" /> 전체 조회</div>
                <p className="text-2xl font-semibold mt-1">{totalViews.toLocaleString()}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Heart className="h-3.5 w-3.5" /> 좋아요</div>
                <p className="text-2xl font-semibold mt-1">{stats?.likes ?? 0}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><MessageSquare className="h-3.5 w-3.5" /> 댓글</div>
                <p className="text-2xl font-semibold mt-1">{stats?.comments ?? 0}</p>
              </CardContent></Card>
            </div>

            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><BarChart3 className="h-4 w-4" /> 카테고리별 게시글</h3>
                <div className="space-y-2">
                  {postsByCategory.map((c) => {
                    const max = Math.max(...postsByCategory.map((x) => x.count), 1);
                    return (
                      <div key={c.name} className="flex items-center gap-3">
                        <span className="text-xs w-24 truncate">{c.name}</span>
                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                          <div className="bg-primary h-full" style={{ width: `${(c.count / max) * 100}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">{c.count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Eye className="h-4 w-4" /> 인기 게시글 TOP 5</h3>
                <div className="space-y-2">
                  {topPosts.map((p: any, i: number) => (
                    <div key={p.id} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground w-5">{i + 1}.</span>
                      <span className="flex-1 truncate">{p.title}</span>
                      <span className="text-muted-foreground flex items-center gap-1"><Eye className="h-3 w-3" />{p.view_count || 0}</span>
                    </div>
                  ))}
                  {topPosts.length === 0 && <p className="text-xs text-muted-foreground">데이터가 없습니다.</p>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Flag className="h-4 w-4" /> 신고 현황</h3>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div><p className="text-lg font-semibold text-destructive">{reports.filter((r: any) => r.status === "pending").length}</p><p className="text-[11px] text-muted-foreground">대기</p></div>
                  <div><p className="text-lg font-semibold">{reports.filter((r: any) => r.status === "resolved").length}</p><p className="text-[11px] text-muted-foreground">처리됨</p></div>
                  <div><p className="text-lg font-semibold">{reports.filter((r: any) => r.status === "rejected").length}</p><p className="text-[11px] text-muted-foreground">기각됨</p></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-1.5"><Trophy className="h-4 w-4" /> 랭킹 자동 집계</h3>
                  <p className="text-[11px] text-muted-foreground mt-1">매일 새벽 3시 자동 집계 · TOP 10 사용자에게 배지 수여</p>
                </div>
                <Button size="sm" variant="outline" onClick={runAggregation} disabled={aggregating}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${aggregating ? "animate-spin" : ""}`} /> 지금 집계
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{catForm.id ? "카테고리 수정" : "카테고리 추가"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">이름</Label>
              <Input placeholder="예: 자유게시판" value={catForm.name} onChange={(e) => setCatForm((s) => ({ ...s, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">슬러그</Label>
              <Input placeholder="예: free" value={catForm.slug} onChange={(e) => setCatForm((s) => ({ ...s, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">유형</Label>
                <Select value={catForm.category_type} onValueChange={(v) => setCatForm((s) => ({ ...s, category_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">일반</SelectItem>
                    <SelectItem value="qna">Q&amp;A</SelectItem>
                    <SelectItem value="column">칼럼</SelectItem>
                    <SelectItem value="notice">공지</SelectItem>
                    <SelectItem value="series">시리즈</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">작성 권한</Label>
                <Select value={catForm.write_role} onValueChange={(v) => setCatForm((s) => ({ ...s, write_role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">모든 사용자</SelectItem>
                    <SelectItem value="member">회원만</SelectItem>
                    <SelectItem value="teacher">교강사 이상</SelectItem>
                    <SelectItem value="admin">관리자만</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">상위 카테고리</Label>
              <Select value={catForm.parent_id} onValueChange={(v) => setCatForm((s) => ({ ...s, parent_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">(최상위)</SelectItem>
                  {categories.filter((c: any) => !c.parent_id && c.id !== catForm.id).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">아이콘 (Lucide 이름, 선택)</Label>
              <Input placeholder="예: MessageCircle" value={catForm.icon} onChange={(e) => setCatForm((s) => ({ ...s, icon: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>취소</Button>
            <Button onClick={() => saveCategory.mutate()} disabled={!catForm.name.trim() || !catForm.slug.trim() || saveCategory.isPending}>
              {catForm.id ? "저장" : "추가"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

const CategoryRow = ({ c, onEdit, onToggle, onDelete }: { c: any; onEdit: (c: any) => void; onToggle: (c: any) => void; onDelete: (id: string) => void }) => {
  const typeLabel: Record<string, string> = { general: "일반", qna: "Q&A", column: "칼럼", notice: "공지", series: "시리즈" };
  const roleLabel: Record<string, string> = { all: "전체", member: "회원", teacher: "교강사+", admin: "관리자" };
  return (
    <Card className={!c.is_active ? "opacity-50" : ""}>
      <CardContent className="p-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm">{c.name}</p>
            <Badge variant="outline" className="text-[10px] whitespace-nowrap">{typeLabel[c.category_type] || "일반"}</Badge>
            <Badge variant="secondary" className="text-[10px] whitespace-nowrap">작성: {roleLabel[c.write_role] || "전체"}</Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{c.slug} · 순서 {c.sort_order}</p>
        </div>
        <Button size="icon" variant="ghost" onClick={() => onEdit(c)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={() => onToggle(c)}>
          {c.is_active ? "비활성화" : "활성화"}
        </Button>
        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => onDelete(c.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
};

export default AdminCommunity;