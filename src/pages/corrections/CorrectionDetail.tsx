import { useMemo, useState, useEffect, useRef } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save, CheckCircle2, Pencil, MessageSquareText, Clock, Sparkles, AlertCircle, ImageIcon, Eye, Trash2, Camera, Plus, X } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { compressAnswerImage } from "@/lib/imageCompression";
import CorrectionCanvas from "@/components/corrections/CorrectionCanvas";

const STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  in_progress: "첨삭 중",
  completed: "완료",
  returned: "반려",
};

const CorrectionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const { primaryRole, roles } = useUserRole();
  const qc = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const addFilesRef = useRef<HTMLInputElement>(null);

  const location = useLocation();
  const isStudentRoute = location.pathname.startsWith("/student/");

  const hasStaffRole = useMemo(
    () => ["teacher", "admin", "super_admin"].includes(primaryRole as string),
    [primaryRole],
  );
  // 학생 라우트에서는 staff 역할이 있어도 학생 뷰만 노출. 첨삭 도구/평가 UI는 강사/관리자 라우트에서만.
  const isStaff = !isStudentRoute && hasStaffRole;
  const basePath = useMemo(() => {
    if (isStudentRoute) return "/student/corrections";
    if (primaryRole === "admin" || primaryRole === "super_admin") return "/admin/corrections";
    if (primaryRole === "teacher") return "/teacher/corrections";
    return "/student/corrections";
  }, [primaryRole, isStudentRoute]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["correction-request-detail", id],
    queryFn: async () => {
      const { data: req, error } = await supabase
        .from("correction_requests")
        .select(
          "id, topic, note, status, score, summary, next_recommendation, student_id, course_id, assigned_teacher_id, submitted_at, completed_at",
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      let course: { id: string; title: string } | null = null;
      if (req?.course_id) {
        const { data: c } = await supabase
          .from("courses")
          .select("id, title")
          .eq("id", req.course_id)
          .maybeSingle();
        course = (c as any) || null;
      }
      const { data: pages } = await supabase
        .from("correction_pages")
        .select("id, page_no, original_path, annotated_path, width, height")
        .eq("request_id", id)
        .order("page_no");
      const { data: anns } = await supabase
        .from("correction_annotations")
        .select("id, page_id, snapshot, comment, author_id, updated_at")
        .eq("request_id", id);
      return { req: { ...req, courses: course }, pages: pages || [], anns: anns || [] };
    },
    enabled: !!id,
  });

  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!data?.pages) return;
    (async () => {
      const map: Record<string, string> = {};
      for (const p of data.pages) {
        const { data: s } = await supabase.storage
          .from("corrections")
          .createSignedUrl(p.original_path, 3600);
        if (s?.signedUrl) map[p.id] = s.signedUrl;
      }
      setSignedUrls(map);
    })();
  }, [data?.pages]);

  const [activePageId, setActivePageId] = useState<string | null>(null);
  useEffect(() => {
    if (!activePageId && data?.pages?.[0]) setActivePageId(data.pages[0].id);
  }, [data?.pages, activePageId]);

  const activePage = data?.pages.find((p) => p.id === activePageId) || null;
  const activeAnnotation = data?.anns.find((a) => a.page_id === activePageId) || null;

  const canvasApiRef = useRef<null | { getSnapshot: () => any }>(null);
  const [comment, setComment] = useState("");
  useEffect(() => {
    setComment(activeAnnotation?.comment || "");
  }, [activeAnnotation?.id]);

  // Staff: 첨삭 시작(claim)
  const claimMutation = useMutation({
    mutationFn: async () => {
      if (!data?.req) return;
      const patch: any = { status: "in_progress" };
      if (!data.req.assigned_teacher_id) patch.assigned_teacher_id = user!.id;
      const { error } = await supabase.from("correction_requests").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "첨삭을 시작합니다." });
      refetch();
    },
    onError: (e: any) => toast({ title: e?.message || "실패", variant: "destructive" }),
  });

  // Save annotation snapshot + comment for current page
  const saveAnnotation = useMutation({
    mutationFn: async () => {
      if (!activePage || !data?.req) return;
      const snapshot = canvasApiRef.current?.getSnapshot() ?? null;
      if (activeAnnotation) {
        const { error } = await supabase
          .from("correction_annotations")
          .update({ snapshot, comment: comment || null })
          .eq("id", activeAnnotation.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("correction_annotations").insert({
          page_id: activePage.id,
          request_id: data.req.id,
          author_id: user!.id,
          snapshot,
          comment: comment || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "저장되었습니다." });
      qc.invalidateQueries({ queryKey: ["correction-request-detail", id] });
    },
    onError: (e: any) => toast({ title: e?.message || "저장 실패", variant: "destructive" }),
  });

  // Complete review (score / summary / next)
  const [score, setScore] = useState<string>("");
  const [summary, setSummary] = useState("");
  const [nextRec, setNextRec] = useState("");
  useEffect(() => {
    if (!data?.req) return;
    setScore(data.req.score != null ? String(data.req.score) : "");
    setSummary(data.req.summary || "");
    setNextRec(data.req.next_recommendation || "");
  }, [data?.req?.id]);

  const completeMutation = useMutation({
    mutationFn: async () => {
      const patch: any = {
        status: "completed",
        completed_at: new Date().toISOString(),
        score: score === "" ? null : Math.max(0, Math.min(100, parseInt(score, 10) || 0)),
        summary: summary || null,
        next_recommendation: nextRec || null,
      };
      const { error } = await supabase.from("correction_requests").update(patch).eq("id", id);
      if (error) throw error;
      // Send notification
      if (data?.req?.student_id) {
        await supabase.from("notifications").insert({
          user_id: data.req.student_id,
          title: "첨삭이 완료되었습니다",
          message: `'${data.req.topic}' 답안에 대한 첨삭이 완료되었습니다.`,
          type: "info",
          action_url: `/student/corrections/${id}`,
        } as any);
      }
    },
    onSuccess: () => {
      toast({ title: "첨삭을 완료 처리했습니다." });
      refetch();
    },
    onError: (e: any) => toast({ title: e?.message || "실패", variant: "destructive" }),
  });

  // ─── 학생: 제출 내용 수정 / 사진 추가·삭제 / 요청 삭제 ───
  const isOwnerStudent = !!user?.id && data?.req?.student_id === user.id;
  const canStudentModify = isOwnerStudent && data?.req?.status === "pending";

  const [editOpen, setEditOpen] = useState(false);
  const [editTopic, setEditTopic] = useState("");
  const [editNote, setEditNote] = useState("");
  useEffect(() => {
    if (!data?.req) return;
    setEditTopic(data.req.topic || "");
    setEditNote(data.req.note || "");
  }, [data?.req?.id]);

  const updateRequestMutation = useMutation({
    mutationFn: async () => {
      if (!editTopic.trim()) throw new Error("주제를 입력해주세요.");
      const { error } = await supabase
        .from("correction_requests")
        .update({ topic: editTopic.trim(), note: editNote.trim() || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "내용이 수정되었습니다." });
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["correction-request-detail", id] });
      qc.invalidateQueries({ queryKey: ["my-correction-requests"] });
    },
    onError: (e: any) => toast({ title: e?.message || "수정 실패", variant: "destructive" }),
  });

  const deletePageMutation = useMutation({
    mutationFn: async (page: { id: string; original_path: string }) => {
      await supabase.storage.from("corrections").remove([page.original_path]);
      const { error } = await supabase.from("correction_pages").delete().eq("id", page.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "사진을 삭제했습니다." });
      setActivePageId(null);
      qc.invalidateQueries({ queryKey: ["correction-request-detail", id] });
    },
    onError: (e: any) => toast({ title: e?.message || "삭제 실패", variant: "destructive" }),
  });

  const addPagesMutation = useMutation({
    mutationFn: async (incoming: File[]) => {
      if (!data?.req) return;
      const startNo = (data.pages?.length || 0);
      for (let i = 0; i < incoming.length; i++) {
        const raw = incoming[i];
        const compressed = await compressAnswerImage(raw);
        const page_no = startNo + i + 1;
        const path = `${data.req.id}/${page_no}/${Date.now()}_${compressed.name}`;
        const { error: upErr } = await supabase.storage
          .from("corrections")
          .upload(path, compressed, { contentType: compressed.type, upsert: false });
        if (upErr) throw upErr;
        const { error: pageErr } = await supabase.from("correction_pages").insert({
          request_id: data.req.id,
          page_no,
          original_path: path,
        });
        if (pageErr) throw pageErr;
      }
    },
    onSuccess: () => {
      toast({ title: "사진을 추가했습니다." });
      qc.invalidateQueries({ queryKey: ["correction-request-detail", id] });
    },
    onError: (e: any) => toast({ title: e?.message || "업로드 실패", variant: "destructive" }),
  });

  const deleteRequestMutation = useMutation({
    mutationFn: async () => {
      if (!data?.pages?.length) {
        const { error } = await supabase.from("correction_requests").delete().eq("id", id);
        if (error) throw error;
        return;
      }
      const paths = data.pages.map((p) => p.original_path);
      await supabase.storage.from("corrections").remove(paths);
      const { error } = await supabase.from("correction_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "제출한 에세이를 삭제했습니다." });
      qc.invalidateQueries({ queryKey: ["my-correction-requests"] });
      navigate("/student/corrections");
    },
    onError: (e: any) => toast({ title: e?.message || "삭제 실패", variant: "destructive" }),
  });

  if (isLoading || !data?.req) {
    return (
      <DashboardLayout>
        <div className="p-10 text-center text-muted-foreground text-sm">불러오는 중…</div>
      </DashboardLayout>
    );
  }

  const req = data.req;
  const canEdit = isStaff && req.status !== "completed";

  return (
    <DashboardLayout>
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex items-center justify-between gap-2">
          <Link to={basePath} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> 목록
          </Link>
          <Badge variant="outline">{STATUS_LABEL[req.status] || req.status}</Badge>
        </div>

        <header className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <Pencil className="h-6 w-6" /> {req.topic}
          </h1>
          {(req.courses as any)?.title && (
            <p className="text-sm text-muted-foreground">강의: {(req.courses as any).title}</p>
          )}
          {req.note && <p className="text-sm text-muted-foreground whitespace-pre-wrap">메모: {req.note}</p>}
        </header>

        {/* ───────────── 학생 안내 배너 ───────────── */}
        {!isStaff && (
          <>
            {req.status === "pending" && (
              <Card className="p-4 border-info/30 bg-info/5">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-info/10 p-2 shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-info" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm">에세이가 정상적으로 업로드되었습니다</div>
                    <p className="text-sm text-muted-foreground mt-1">
                      강사 배정 후 첨삭이 시작됩니다. 첨삭이 완료되면 결과를 이 페이지에서 확인할 수 있어요.
                    </p>
                    <div className="text-xs text-muted-foreground mt-2 flex items-center gap-3">
                      <span className="inline-flex items-center gap-1"><ImageIcon className="h-3 w-3" /> 제출 사진 {data.pages.length}장</span>
                      <span>· 제출일 {new Date(req.submitted_at).toLocaleString()}</span>
                    </div>
                    {canStudentModify && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditOpen(true)}>
                          <Pencil className="h-3.5 w-3.5" /> 내용 수정
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => addFilesRef.current?.click()}
                          disabled={addPagesMutation.isPending}
                        >
                          {addPagesMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                          사진 추가
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" /> 제출 삭제
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>제출한 에세이를 삭제하시겠습니까?</AlertDialogTitle>
                              <AlertDialogDescription>
                                업로드한 사진과 메모가 모두 삭제됩니다. 이 작업은 되돌릴 수 없어요.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>취소</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteRequestMutation.mutate()}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                삭제
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <input
                          ref={addFilesRef}
                          type="file"
                          accept="image/*"
                          multiple
                          hidden
                          onChange={(e) => {
                            const fl = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
                            if (fl.length) addPagesMutation.mutate(fl);
                            e.target.value = "";
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}
            {req.status === "in_progress" && (
              <Card className="p-4 border-warning/30 bg-warning/5">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-warning/10 p-2 shrink-0">
                    <Loader2 className="h-5 w-5 text-warning animate-spin" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm">강사가 첨삭 중입니다</div>
                    <p className="text-sm text-muted-foreground mt-1">
                      첨삭이 완료되기 전까지는 강사의 주석과 코멘트가 공개되지 않습니다.
                      완료되면 알림을 통해 안내해 드릴게요.
                    </p>
                  </div>
                </div>
              </Card>
            )}
            {req.status === "completed" && (
              <Card className="p-4 border-success/30 bg-success/5">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-success/10 p-2 shrink-0">
                    <Sparkles className="h-5 w-5 text-success" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm">첨삭이 완료되었습니다</div>
                    <p className="text-sm text-muted-foreground mt-1">
                      아래에서 강사 주석, 페이지별 코멘트, 종합 평가를 확인할 수 있습니다.
                    </p>
                    {req.completed_at && (
                      <div className="text-xs text-muted-foreground mt-2">
                        완료일 {new Date(req.completed_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}
            {req.status === "returned" && (
              <Card className="p-4 border-destructive/30 bg-destructive/5">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-destructive/10 p-2 shrink-0">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm">에세이가 반려되었습니다</div>
                    <p className="text-sm text-muted-foreground mt-1">
                      강사의 안내에 따라 다시 작성 후 새 에세이로 제출해 주세요.
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}

        {isStaff && req.status === "pending" && (
          <Card className="p-4 flex items-center justify-between">
            <div className="text-sm">이 요청을 담당하시겠습니까?</div>
            <Button onClick={() => claimMutation.mutate()} disabled={claimMutation.isPending}>
              {claimMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              첨삭 시작
            </Button>
          </Card>
        )}

        {/* ───────────── 페이지/이미지 표시 ───────────── */}
        {data.pages.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">답안 페이지가 없습니다.</Card>
        ) : (
          <Tabs value={activePageId || ""} onValueChange={setActivePageId}>
            <TabsList className="flex flex-wrap h-auto">
              {data.pages.map((p) => (
                <TabsTrigger key={p.id} value={p.id}>페이지 {p.page_no}</TabsTrigger>
              ))}
            </TabsList>
            {data.pages.map((p) => {
              const ann = data.anns.find((a) => a.page_id === p.id) || null;
              const url = signedUrls[p.id];
              // 학생은 완료 전까지 강사 주석/스냅샷 비공개 — 원본 사진만 노출
              const studentHideAnnotations = !isStaff && req.status !== "completed";
              const snapshotForCanvas = studentHideAnnotations ? undefined : ann?.snapshot;
              return (
                <TabsContent key={p.id} value={p.id} className="space-y-4 mt-4">
                  {url ? (
                    <div className="relative">
                      <CorrectionCanvas
                        key={p.id + (canEdit ? "-edit" : "-view") + (studentHideAnnotations ? "-clean" : "-ann")}
                        imageUrl={url}
                        initialSnapshot={snapshotForCanvas}
                        readOnly={!canEdit}
                        onReady={(api) => { canvasApiRef.current = api; }}
                      />
                      {!isStaff && req.status === "pending" && (
                        <div className="absolute top-2 left-2 inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-background/90 backdrop-blur border shadow-sm">
                          <Eye className="h-3 w-3" /> 내가 제출한 답안
                        </div>
                      )}
                      {!isStaff && req.status === "in_progress" && (
                        <div className="absolute top-2 left-2 inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-warning/10 text-warning border border-warning/30 shadow-sm">
                          <Loader2 className="h-3 w-3 animate-spin" /> 첨삭 중
                        </div>
                      )}
                      {canStudentModify && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              type="button"
                              className="absolute top-2 right-2 inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-background/90 backdrop-blur border shadow-sm text-destructive hover:bg-destructive/10"
                              aria-label="이 사진 삭제"
                            >
                              <Trash2 className="h-3 w-3" /> 사진 삭제
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>이 사진을 삭제할까요?</AlertDialogTitle>
                              <AlertDialogDescription>
                                페이지 {p.page_no}의 사진이 영구적으로 삭제됩니다.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>취소</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deletePageMutation.mutate({ id: p.id, original_path: p.original_path })}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                삭제
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">이미지 로딩 중…</div>
                  )}

                  {canEdit && activePageId === p.id && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <Label htmlFor={`comment-${p.id}`} className="flex items-center gap-1">
                          <MessageSquareText className="h-4 w-4" /> 페이지 코멘트
                        </Label>
                        <Textarea
                          id={`comment-${p.id}`}
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          rows={3}
                          placeholder="이 페이지에 대한 텍스트 코멘트 (선택)"
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button onClick={() => saveAnnotation.mutate()} disabled={saveAnnotation.isPending} className="gap-2">
                          {saveAnnotation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          저장
                        </Button>
                      </div>
                    </Card>
                  )}

                  {/* 학생: 완료 시에만 강사 코멘트 노출 */}
                  {!canEdit && ann?.comment && (!isStaff ? req.status === "completed" : true) && (
                    <Card className="p-4">
                      <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <MessageSquareText className="h-3.5 w-3.5" /> 강사 코멘트
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{ann.comment}</p>
                    </Card>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        )}


        {/* 종합 평가 */}
        {isStaff && req.status !== "completed" ? (
          <Card className="p-4 space-y-3">
            <h2 className="font-semibold">종합 평가</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="score">점수 (0–100)</Label>
                <Input id="score" type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="summary">총평</Label>
                <Textarea id="summary" rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="next">다음 학습 추천</Label>
              <Textarea id="next" rows={2} value={nextRec} onChange={(e) => setNextRec(e.target.value)} placeholder="예: 행정쟁송법 사례형 2주차 강의 복습" />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending} className="gap-2">
                {completeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                첨삭 완료
              </Button>
            </div>
          </Card>
        ) : req.status === "completed" ? (
          <Card className="p-4 space-y-2">
            <h2 className="font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-success" /> 종합 평가
            </h2>
            {req.score != null && <div className="text-sm">점수: <span className="font-medium">{req.score}점</span></div>}
            {req.summary && <div className="text-sm"><span className="text-muted-foreground">총평:</span> <span className="whitespace-pre-wrap">{req.summary}</span></div>}
            {req.next_recommendation && (
              <div className="text-sm"><span className="text-muted-foreground">다음 학습 추천:</span> <span className="whitespace-pre-wrap">{req.next_recommendation}</span></div>
            )}
            {req.score == null && !req.summary && !req.next_recommendation && (
              <div className="text-sm text-muted-foreground">강사가 별도의 종합 평가를 남기지 않았습니다.</div>
            )}
          </Card>
        ) : !isStaff ? (
          // 학생: 미완료 상태에서 종합평가 자리표시자
          <Card className="p-4 border-dashed">
            <h2 className="font-semibold flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" /> 종합 평가 (대기 중)
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              첨삭이 완료되면 점수, 총평, 다음 학습 추천을 이곳에서 확인할 수 있습니다.
            </p>
          </Card>
        ) : null}
      </div>

      {/* 학생: 내용 수정 다이얼로그 */}
      <Dialog open={editOpen} onOpenChange={(o) => !updateRequestMutation.isPending && setEditOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>제출 내용 수정</DialogTitle>
            <DialogDescription>주제와 메모를 수정할 수 있습니다. 첨삭이 시작되면 수정할 수 없어요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="edit-topic">주제 *</Label>
              <Input id="edit-topic" value={editTopic} onChange={(e) => setEditTopic(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="edit-note">에세이 본문 / 메모</Label>
              <Textarea id="edit-note" rows={6} value={editNote} onChange={(e) => setEditNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={updateRequestMutation.isPending}>취소</Button>
            <Button onClick={() => updateRequestMutation.mutate()} disabled={updateRequestMutation.isPending || !editTopic.trim()} className="gap-2">
              {updateRequestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default CorrectionDetail;
