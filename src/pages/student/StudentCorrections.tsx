import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PenLine, Plus, Camera, X, Clock, CheckCircle2, Loader2, ChevronRight, AlertCircle, FileText, Calendar, Sparkles,
} from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { compressAnswerImage } from "@/lib/imageCompression";

const STATUS_META: Record<string, { label: string; icon: any; cls: string }> = {
  pending: { label: "대기", icon: Clock, cls: "text-muted-foreground" },
  in_progress: { label: "에세이 진행 중", icon: Loader2, cls: "text-info" },
  completed: { label: "에세이 완료", icon: CheckCircle2, cls: "text-success" },
  returned: { label: "반려", icon: AlertCircle, cls: "text-warning" },
};

const StudentCorrections = () => {
  const { user } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [topic, setTopic] = useState("");
  const [note, setNote] = useState("");
  const [courseId, setCourseId] = useState<string>("none");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [activeAssignment, setActiveAssignment] = useState<null | {
    target_id: string; assignment_id: string; title: string; instructions: string | null; course_id: string | null; course_title?: string | null; due_at: string | null;
  }>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["my-correction-requests", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("correction_requests")
        .select("id, topic, status, score, submitted_at, completed_at, course_id, correction_pages(id)")
        .eq("student_id", user!.id)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: myCourses = [] } = useQuery({
    queryKey: ["my-enrolled-courses-min", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("course_id, courses:course_id(id, title)")
        .eq("user_id", user!.id);
      if (error) return [];
      return (data || [])
        .map((r: any) => r.courses)
        .filter(Boolean) as { id: string; title: string }[];
    },
    enabled: !!user?.id,
  });

  // 부여된 에세이 과제 (미제출만 표시)
  const { data: myAssignments = [] } = useQuery({
    queryKey: ["my-essay-assignments", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("correction_assignment_targets")
        .select(`
          id, status, submitted_at, assignment_id,
          correction_assignments!inner(id, title, instructions, course_id, due_at, courses:course_id(title))
        `)
        .eq("student_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const pendingAssignments = useMemo(
    () => myAssignments.filter((t: any) => t.status === "assigned"),
    [myAssignments]
  );

  const reset = () => {
    setTopic("");
    setNote("");
    setCourseId("none");
    setFiles([]);
    setActiveAssignment(null);
    setStep(1);
  };

  const openNewRequest = () => {
    reset();
    setStep(2); // 자유 요청은 바로 작성 단계
    setOpen(true);
  };

  const openAssignmentReview = (t: any) => {
    const a = t.correction_assignments;
    setActiveAssignment({
      target_id: t.id,
      assignment_id: a.id,
      title: a.title,
      instructions: a.instructions,
      course_id: a.course_id,
      course_title: a.courses?.title ?? null,
      due_at: a.due_at,
    });
    setTopic(a.title);
    setNote("");
    setCourseId(a.course_id || "none");
    setFiles([]);
    setStep(1); // 1단계: 주제 확인
    setOpen(true);
  };

  const onPickFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const list = Array.from(incoming).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;
    setFiles((prev) => {
      const merged = [...prev, ...list];
      if (merged.length > 20) {
        toast({ title: "최대 20장까지 첨부할 수 있어요.", variant: "destructive" });
        return merged.slice(0, 20);
      }
      return merged;
    });
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!topic.trim()) throw new Error("주제를 입력해주세요.");
      if (files.length === 0) throw new Error("답안 사진을 1장 이상 첨부해주세요.");

      const { data: req, error: reqErr } = await supabase
        .from("correction_requests")
        .insert({
          student_id: user!.id,
          topic: topic.trim(),
          note: note.trim() || null,
          course_id: courseId !== "none" ? courseId : null,
          status: "pending",
        })
        .select("id")
        .single();
      if (reqErr) throw reqErr;

      for (let i = 0; i < files.length; i++) {
        const raw = files[i];
        const compressed = await compressAnswerImage(raw);
        const path = `${req.id}/${i + 1}/${Date.now()}_${compressed.name}`;
        const { error: upErr } = await supabase.storage
          .from("corrections")
          .upload(path, compressed, { contentType: compressed.type, upsert: false });
        if (upErr) throw upErr;
        const { error: pageErr } = await supabase.from("correction_pages").insert({
          request_id: req.id,
          page_no: i + 1,
          original_path: path,
        });
        if (pageErr) throw pageErr;
      }

      // 과제 대상 → 제출 상태 연결
      if (activeAssignment) {
        await supabase
          .from("correction_assignment_targets")
          .update({
            status: "submitted",
            request_id: req.id,
            submitted_at: new Date().toISOString(),
          })
          .eq("id", activeAssignment.target_id);
      }
      return req.id;
    },
    onSuccess: () => {
      toast({ title: "에세이가 제출되었습니다." });
      qc.invalidateQueries({ queryKey: ["my-correction-requests"] });
      qc.invalidateQueries({ queryKey: ["my-essay-assignments"] });
      reset();
      setOpen(false);
    },
    onError: (e: any) => {
      toast({ title: e?.message || "요청 실패", variant: "destructive" });
    },
    onSettled: () => setSubmitting(false),
  });


  const stats = useMemo(() => {
    const pendingFromRequests = requests.filter((r: any) => r.status === "pending").length;
    const inProgress = requests.filter((r: any) => r.status === "in_progress").length;
    const completed = requests.filter((r: any) => r.status === "completed").length;
    const pending = pendingAssignments.length + pendingFromRequests;
    return {
      total: pending + inProgress + completed,
      pending,
      inProgress,
      completed,
    };
  }, [requests, pendingAssignments]);

  return (
    <DashboardLayout>
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
              <PenLine className="h-6 w-6" /> 에세이(첨삭) 작성하기
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              강사가 부여한 에세이 과제를 확인하고 답안을 작성·제출하세요.
            </p>
          </div>
          <Button onClick={openNewRequest} className="gap-2">
            <Plus className="h-4 w-4" /> 새 에세이(첨삭) 작성
          </Button>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "전체", value: stats.total },
            { label: "대기", value: stats.pending },
            { label: "진행 중", value: stats.inProgress },
            { label: "완료", value: stats.completed },
          ].map((s) => (
            <Card key={s.label} className="p-4">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="text-2xl font-semibold mt-1">{s.value}</div>
            </Card>
          ))}
        </div>

        {pendingAssignments.length > 0 && (
          <Card className="overflow-hidden border-primary/30">
            <div className="p-4 border-b border-border bg-primary/5 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <div className="min-w-0">
                <h2 className="text-base font-semibold">부여받은 에세이 과제 ({pendingAssignments.length})</h2>
                <p className="text-xs text-muted-foreground">아래 과제를 클릭하면 답안 사진을 올려 바로 제출할 수 있어요.</p>
              </div>
            </div>
            <ul className="divide-y-2 divide-border/80">
              {pendingAssignments.map((t: any) => {
                const a = t.correction_assignments;
                const overdue = a.due_at && new Date(a.due_at) < new Date();
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => openAssignmentReview(t)}
                      className="w-full text-left flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors"
                    >
                      <FileText className="h-5 w-5 text-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{a.title}</div>
                        {a.instructions && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2 whitespace-pre-wrap">{a.instructions}</div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                          {a.courses?.title && <span>· {a.courses.title}</span>}
                          {a.due_at && (
                            <span className={`inline-flex items-center gap-1 ${overdue ? "text-destructive" : ""}`}>
                              <Calendar className="h-3 w-3" /> 기한 {new Date(a.due_at).toLocaleDateString()}{overdue && " (지남)"}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge className="shrink-0">제출하기</Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">불러오는 중…</div>
          ) : requests.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">
              아직 제출한 에세이가 없습니다.
            </div>
          ) : (
            <ul className="divide-y-2 divide-border/80">
              {requests.map((r: any) => {
                const meta = STATUS_META[r.status] || STATUS_META.pending;
                const Icon = meta.icon;
                return (
                  <li key={r.id}>
                    <Link
                      to={`/student/corrections/${r.id}`}
                      className="flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{r.topic}</div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                          <span className={`flex items-center gap-1 ${meta.cls}`}>
                            <Icon className="h-3.5 w-3.5" /> {meta.label}
                          </span>
                          <span>· {r.correction_pages?.length ?? 0}장</span>
                          {r.score != null && <span>· 점수 {r.score}</span>}
                          <span className="hidden sm:inline">
                            · {new Date(r.submitted_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Dialog open={open} onOpenChange={(o) => { if (!submitting) { setOpen(o); if (!o) reset(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {activeAssignment ? <><Sparkles className="h-5 w-5 text-primary" /> 부여된 에세이 과제</> : "새 에세이(첨삭) 작성"}
            </DialogTitle>
            <DialogDescription>
              {activeAssignment
                ? (step === 1 ? "강사/관리자가 부여한 주제와 내용을 먼저 확인하세요." : "에세이를 작성한 뒤 답안 사진을 올려 제출합니다.")
                : "답안지를 사진으로 촬영해 올려주세요. 자동으로 WebP로 압축됩니다."}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator (과제일 때만) */}
          {activeAssignment && (
            <div className="flex items-center gap-2 text-xs">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${step === 1 ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground"}`}>
                <span className="font-semibold">1</span> 주제 확인
              </div>
              <div className="h-px flex-1 bg-border" />
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${step === 2 ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground"}`}>
                <span className="font-semibold">2</span> 에세이(첨삭) 작성 · 사진 업로드
              </div>
            </div>
          )}

          {/* STEP 1: 주제/내용 확인 */}
          {activeAssignment && step === 1 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">에세이 주제</div>
                  <div className="text-base font-semibold flex items-start gap-2">
                    <FileText className="h-4 w-4 text-primary mt-1 shrink-0" />
                    <span>{activeAssignment.title}</span>
                  </div>
                </div>
                {activeAssignment.instructions && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">작성 안내 / 내용</div>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed bg-background/60 rounded-md border p-3">
                      {activeAssignment.instructions}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1 border-t">
                  {activeAssignment.course_title && (
                    <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> {activeAssignment.course_title}</span>
                  )}
                  {activeAssignment.due_at && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> 제출 기한 {new Date(activeAssignment.due_at).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                다음 단계에서 직접 작성한 에세이 본문(선택)과 답안 사진을 올려 제출할 수 있어요.
              </div>
            </div>
          )}

          {/* STEP 2: 작성 + 업로드 */}
          {(!activeAssignment || step === 2) && (
            <div className="space-y-4">
              {activeAssignment && (
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <div className="text-xs text-muted-foreground mb-0.5">제출 주제</div>
                  <div className="font-medium">{activeAssignment.title}</div>
                </div>
              )}
              {!activeAssignment && (
                <div>
                  <Label htmlFor="topic">주제 / 과제명 *</Label>
                  <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="예: 2024년 노무사 2차 행정쟁송법 사례" />
                </div>
              )}
              {!activeAssignment && (
                <div>
                  <Label>관련 강의 (선택)</Label>
                  <Select value={courseId} onValueChange={setCourseId}>
                    <SelectTrigger><SelectValue placeholder="강의 선택" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">선택 안 함</SelectItem>
                      {myCourses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label htmlFor="note">에세이 본문 / 메모 (선택)</Label>
                <Textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="직접 작성한 에세이 본문이나 강사님께 전달할 메모를 적어주세요."
                  rows={6}
                />
                <p className="text-xs text-muted-foreground mt-1">손글씨 답안을 사진으로 올리는 경우 비워두셔도 됩니다.</p>
              </div>
              <div>
                <Label>답안 사진 *</Label>
                <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {files.map((f, i) => {
                    const url = URL.createObjectURL(f);
                    return (
                      <div key={i} className="relative aspect-[3/4] border rounded overflow-hidden bg-muted">
                        <img src={url} alt="" className="w-full h-full object-cover" onLoad={() => URL.revokeObjectURL(url)} />
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="absolute top-1 right-1 bg-background/90 rounded-full p-0.5 shadow"
                          aria-label="삭제"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <div className="absolute bottom-1 left-1 text-[10px] bg-background/80 px-1 rounded">
                          {i + 1}
                        </div>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-[3/4] border-2 border-dashed rounded flex flex-col items-center justify-center text-xs text-muted-foreground hover:bg-muted/40"
                  >
                    <Camera className="h-5 w-5 mb-1" />
                    추가
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  hidden
                  onChange={(e) => { onPickFiles(e.target.files); e.target.value = ""; }}
                />
                <p className="text-xs text-muted-foreground mt-2">최대 20장 · 자동 압축</p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {activeAssignment && step === 2 && (
              <Button variant="ghost" onClick={() => setStep(1)} disabled={submitting}>← 주제 다시 보기</Button>
            )}
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>취소</Button>
            {activeAssignment && step === 1 ? (
              <Button onClick={() => setStep(2)} className="gap-1">
                에세이(첨삭) 작성하기 →
              </Button>
            ) : (
              <Button
                onClick={() => { setSubmitting(true); submitMutation.mutate(); }}
                disabled={submitting || !topic.trim() || files.length === 0}
              >
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                에세이 제출
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default StudentCorrections;
