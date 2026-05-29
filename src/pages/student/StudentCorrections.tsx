import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PenLine, Plus, Camera, X, Clock, CheckCircle2, Loader2, ChevronRight, AlertCircle,
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
  in_progress: { label: "첨삭 진행 중", icon: Loader2, cls: "text-info" },
  completed: { label: "첨삭 완료", icon: CheckCircle2, cls: "text-success" },
  returned: { label: "반려", icon: AlertCircle, cls: "text-warning" },
};

const StudentCorrections = () => {
  const { user } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [note, setNote] = useState("");
  const [courseId, setCourseId] = useState<string>("none");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

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

  const reset = () => {
    setTopic("");
    setNote("");
    setCourseId("none");
    setFiles([]);
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

      // 1) request 생성
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

      // 2) 각 페이지 압축 후 업로드 + correction_pages 생성
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
      return req.id;
    },
    onSuccess: () => {
      toast({ title: "첨삭 요청이 접수되었습니다." });
      qc.invalidateQueries({ queryKey: ["my-correction-requests"] });
      reset();
      setOpen(false);
    },
    onError: (e: any) => {
      toast({ title: e?.message || "요청 실패", variant: "destructive" });
    },
    onSettled: () => setSubmitting(false),
  });

  const stats = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter((r: any) => r.status === "pending").length,
      inProgress: requests.filter((r: any) => r.status === "in_progress").length,
      completed: requests.filter((r: any) => r.status === "completed").length,
    };
  }, [requests]);

  return (
    <DashboardLayout>
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
              <PenLine className="h-6 w-6" /> 첨삭 받기
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              손글씨로 작성한 답안을 사진으로 올리면 강사가 디지털로 첨삭해 드립니다.
            </p>
          </div>
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> 새 첨삭 요청
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

        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">불러오는 중…</div>
          ) : requests.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">
              아직 등록된 첨삭 요청이 없습니다.
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>새 첨삭 요청</DialogTitle>
            <DialogDescription>
              답안지를 사진으로 촬영해 올려주세요. 자동으로 WebP로 압축됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="topic">주제 / 과제명 *</Label>
              <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="예: 2024년 노무사 2차 행정쟁송법 사례" />
            </div>
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
            <div>
              <Label htmlFor="note">요청 메모 (선택)</Label>
              <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="강사님께 전달할 메모를 적어주세요." rows={3} />
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>취소</Button>
            <Button
              onClick={() => { setSubmitting(true); submitMutation.mutate(); }}
              disabled={submitting || !topic.trim() || files.length === 0}
            >
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              요청 보내기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default StudentCorrections;
