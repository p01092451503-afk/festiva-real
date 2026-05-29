import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Download, Check, X, RefreshCcw, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Submission = {
  id: string;
  category_id: string;
  program_id: string | null;
  project_id: string | null;
  beneficiary_id: string | null;
  submitted_by: string;
  submitter_name: string | null;
  title: string;
  note: string | null;
  file_path: string;
  file_name: string;
  file_size: number | null;
  file_mime: string | null;
  status: string;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  submitted: "제출됨",
  approved: "승인",
  rejected: "반려",
  changes_requested: "재요청",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  submitted: "secondary",
  approved: "default",
  rejected: "destructive",
  changes_requested: "outline",
};

function formatBytes(n?: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function EvidenceSubmissionsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const [reviewTarget, setReviewTarget] = useState<Submission | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewStatus, setReviewStatus] = useState<string>("approved");

  const { data: categories = [] } = useQuery({
    queryKey: ["evidence_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evidence_categories")
        .select("id, name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["evidence_submissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evidence_submissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Submission[];
    },
  });

  const categoryMap = useMemo(() => {
    const m = new Map<string, string>();
    (categories as { id: string; name: string }[]).forEach((c) => m.set(c.id, c.name));
    return m;
  }, [categories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (categoryFilter !== "all" && r.category_id !== categoryFilter) return false;
      if (!q) return true;
      return [r.title, r.submitter_name, r.file_name, r.note]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, search, statusFilter, categoryFilter]);

  const review = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: string; note: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("evidence_submissions")
        .update({
          status,
          review_note: note || null,
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "검토가 반영되었습니다" });
      setReviewTarget(null); setReviewNote(""); setReviewStatus("approved");
      qc.invalidateQueries({ queryKey: ["evidence_submissions"] });
    },
    onError: (e: any) => toast({ title: "검토 실패", description: e.message, variant: "destructive" }),
  });

  const downloadFile = async (s: Submission) => {
    const { data, error } = await supabase.storage
      .from("evidence-files")
      .createSignedUrl(s.file_path, 60 * 5);
    if (error || !data?.signedUrl) {
      toast({ title: "다운로드 실패", description: error?.message ?? "URL 생성 실패", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const openReview = (r: Submission) => {
    setReviewTarget(r);
    setReviewStatus(r.status === "submitted" ? "approved" : r.status);
    setReviewNote(r.review_note ?? "");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="제목·제출자·파일명·메모로 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="상태" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="카테고리" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 카테고리</SelectItem>
            {(categories as { id: string; name: string }[]).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="text-xs text-muted-foreground">전체 {rows.length}건 · 필터 결과 {filtered.length}건</div>

      <div className="border-2 border-border/60 rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>제목</TableHead>
              <TableHead>카테고리</TableHead>
              <TableHead>제출자</TableHead>
              <TableHead>파일</TableHead>
              <TableHead className="w-[100px]">상태</TableHead>
              <TableHead className="w-[140px]">제출일</TableHead>
              <TableHead className="w-[160px] text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">불러오는 중…</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">제출된 증빙이 없습니다.</TableCell></TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id} className="border-b-2 border-border/60">
                <TableCell className="font-medium">
                  {r.title}
                  {r.note && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{r.note}</div>}
                </TableCell>
                <TableCell className="text-sm">{categoryMap.get(r.category_id) ?? "—"}</TableCell>
                <TableCell className="text-sm">{r.submitter_name ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  <div className="truncate max-w-[200px]">{r.file_name}</div>
                  <div className="text-xs">{formatBytes(r.file_size)}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[r.status] ?? "outline"}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ko-KR")}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => downloadFile(r)} title="다운로드">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openReview(r)} title="검토">
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!reviewTarget} onOpenChange={(o) => !o && setReviewTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>증빙 검토</DialogTitle></DialogHeader>
          {reviewTarget && (
            <div className="space-y-4">
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-1">
                <div className="font-medium">{reviewTarget.title}</div>
                <div className="text-xs text-muted-foreground">{categoryMap.get(reviewTarget.category_id) ?? "—"} · {reviewTarget.submitter_name ?? ""}</div>
                {reviewTarget.note && <div className="text-sm mt-1">{reviewTarget.note}</div>}
                <div className="text-xs mt-1">
                  <button className="underline text-foreground" onClick={() => downloadFile(reviewTarget)}>
                    {reviewTarget.file_name} ({formatBytes(reviewTarget.file_size)})
                  </button>
                </div>
              </div>
              <div>
                <Label>처리 결과</Label>
                <div className="flex gap-2 mt-1">
                  <Button type="button" size="sm" variant={reviewStatus === "approved" ? "default" : "outline"} onClick={() => setReviewStatus("approved")}>
                    <Check className="h-4 w-4 mr-1" />승인
                  </Button>
                  <Button type="button" size="sm" variant={reviewStatus === "changes_requested" ? "default" : "outline"} onClick={() => setReviewStatus("changes_requested")}>
                    <RefreshCcw className="h-4 w-4 mr-1" />재요청
                  </Button>
                  <Button type="button" size="sm" variant={reviewStatus === "rejected" ? "default" : "outline"} onClick={() => setReviewStatus("rejected")}>
                    <X className="h-4 w-4 mr-1" />반려
                  </Button>
                </div>
              </div>
              <div>
                <Label>검토 메모</Label>
                <Textarea rows={3} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="필요 시 검토 내용을 남기세요." />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReviewTarget(null)}>취소</Button>
                <Button
                  onClick={() => reviewTarget && review.mutate({ id: reviewTarget.id, status: reviewStatus, note: reviewNote })}
                  disabled={review.isPending}
                >
                  {review.isPending ? "처리 중…" : "저장"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}