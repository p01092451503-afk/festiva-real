import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { FolderCheck, Upload, FileText, Trash2 } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { useFeatureModules } from "@/hooks/useFeatureModules";
import { supabase } from "@/integrations/supabase/client";

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  submitted: { label: "검토중", variant: "secondary" },
  approved: { label: "승인", variant: "default" },
  rejected: { label: "반려", variant: "destructive" },
  changes_requested: { label: "수정요청", variant: "outline" },
};

export default function StudentEvidence() {
  const { user, profile } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { isEnabled, isLoading: modulesLoading } = useFeatureModules();

  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["student_evidence_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evidence_categories").select("id, name, scope, is_required, sort_order")
        .eq("active", true).order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: subs = [] } = useQuery({
    queryKey: ["student_evidence_subs", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evidence_submissions")
        .select("id, title, status, note, file_path, file_name, review_note, created_at, category:evidence_categories(name)")
        .eq("submitted_by", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const submit = async () => {
    if (!user) return;
    if (!categoryId) return toast({ title: "카테고리를 선택하세요", variant: "destructive" });
    if (!title.trim()) return toast({ title: "제목을 입력하세요", variant: "destructive" });
    if (!file) return toast({ title: "파일을 선택하세요", variant: "destructive" });
    if (file.size > 20 * 1024 * 1024) return toast({ title: "파일 크기는 20MB 이하여야 합니다", variant: "destructive" });

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("evidence-files").upload(path, file, {
        contentType: file.type || undefined,
      });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("evidence_submissions").insert({
        category_id: categoryId,
        submitted_by: user.id,
        submitter_name: profile?.full_name || null,
        title: title.trim(),
        note: note.trim() || null,
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        file_mime: file.type || null,
        status: "submitted",
      });
      if (insErr) throw insErr;
      toast({ title: "제출되었습니다" });
      setOpen(false);
      setCategoryId(""); setTitle(""); setNote(""); setFile(null);
      qc.invalidateQueries({ queryKey: ["student_evidence_subs"] });
    } catch (e: any) {
      toast({ title: "업로드 실패", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const remove = useMutation({
    mutationFn: async (row: any) => {
      await supabase.storage.from("evidence-files").remove([row.file_path]);
      const { error } = await supabase.from("evidence_submissions").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "삭제되었습니다" });
      qc.invalidateQueries({ queryKey: ["student_evidence_subs"] });
    },
    onError: (e: any) => toast({ title: "삭제 실패", description: e.message, variant: "destructive" }),
  });

  const downloadFile = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("evidence-files").createSignedUrl(path, 60);
    if (error || !data) return toast({ title: "다운로드 실패", description: error?.message, variant: "destructive" });
    const a = document.createElement("a");
    a.href = data.signedUrl; a.download = name; a.click();
  };

  if (!modulesLoading && !isEnabled("evidence")) return <Navigate to="/" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-6 min-w-0">
        <header className="space-y-1">
          <div className="flex items-center gap-2">
            <FolderCheck className="w-6 h-6 text-muted-foreground" />
            <h1 className="text-xl sm:text-2xl font-semibold">증빙자료 제출</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            프로그램·프로젝트 참여를 증빙하는 영수증·확인서·서명부 등을 업로드하세요.
          </p>
        </header>

        <div className="flex justify-end">
          <Button onClick={() => setOpen(true)}><Upload className="w-4 h-4 mr-1" />새 증빙 제출</Button>
        </div>

        {subs.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">제출한 증빙자료가 없습니다.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {subs.map((s: any) => {
              const st = STATUS_LABEL[s.status] || { label: s.status, variant: "outline" as const };
              return (
                <Card key={s.id}>
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{s.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {s.category?.name} · {s.file_name} · {new Date(s.created_at).toLocaleDateString("ko-KR")}
                      </div>
                      {s.review_note && (
                        <div className="text-xs text-amber-700 mt-1">검토 의견: {s.review_note}</div>
                      )}
                    </div>
                    <Badge variant={st.variant} className="shrink-0">{st.label}</Badge>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => downloadFile(s.file_path, s.file_name)}>다운로드</Button>
                      {(s.status === "submitted" || s.status === "changes_requested") && (
                        <Button variant="ghost" size="sm" onClick={() => { if (confirm("삭제하시겠습니까?")) remove.mutate(s); }}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>증빙자료 제출</DialogTitle>
            <DialogDescription>최대 20MB의 파일을 업로드할 수 있습니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>카테고리 *</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="선택…" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.is_required ? " (필수)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>제목 *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 5월 워크숍 출석부" />
            </div>
            <div className="space-y-1.5">
              <Label>메모</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>파일 *</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {file && <p className="text-xs text-muted-foreground">{file.name} ({(file.size / 1024).toFixed(0)} KB)</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button onClick={submit} disabled={uploading}>{uploading ? "업로드 중…" : "제출"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}