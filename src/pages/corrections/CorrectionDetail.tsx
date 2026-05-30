import { useMemo, useState, useEffect, useCallback } from "react";
import { useParams, Link, useLocation, Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save, CheckCircle2, Pencil, MessageSquareText, Clock, Sparkles, AlertCircle, ImageIcon, Eye } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
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

  const canvasApiRef = { current: null as null | { getSnapshot: () => any } };
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

        {isStaff && req.status === "pending" && (
          <Card className="p-4 flex items-center justify-between">
            <div className="text-sm">이 요청을 담당하시겠습니까?</div>
            <Button onClick={() => claimMutation.mutate()} disabled={claimMutation.isPending}>
              {claimMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              첨삭 시작
            </Button>
          </Card>
        )}

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
              return (
                <TabsContent key={p.id} value={p.id} className="space-y-4 mt-4">
                  {url ? (
                    <CorrectionCanvas
                      key={p.id + (canEdit ? "-edit" : "-view")}
                      imageUrl={url}
                      initialSnapshot={ann?.snapshot}
                      readOnly={!canEdit}
                      onReady={(api) => { canvasApiRef.current = api; }}
                    />
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

                  {!canEdit && ann?.comment && (
                    <Card className="p-4">
                      <div className="text-xs text-muted-foreground mb-1">강사 코멘트</div>
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
            <h2 className="font-semibold">종합 평가</h2>
            {req.score != null && <div className="text-sm">점수: <span className="font-medium">{req.score}점</span></div>}
            {req.summary && <div className="text-sm"><span className="text-muted-foreground">총평:</span> <span className="whitespace-pre-wrap">{req.summary}</span></div>}
            {req.next_recommendation && (
              <div className="text-sm"><span className="text-muted-foreground">다음 학습 추천:</span> <span className="whitespace-pre-wrap">{req.next_recommendation}</span></div>
            )}
          </Card>
        ) : null}
      </div>
    </DashboardLayout>
  );
};

export default CorrectionDetail;
