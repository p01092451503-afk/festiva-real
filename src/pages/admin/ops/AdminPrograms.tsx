import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, Plus, Search, Pencil, Trash2, Users2, ArrowRight } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ProgramFormDialog, { type ProgramRecord } from "@/components/ops/programs/ProgramFormDialog";

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "임시", variant: "outline" },
  open: { label: "모집중", variant: "default" },
  closed: { label: "마감", variant: "secondary" },
  completed: { label: "종료", variant: "secondary" },
  cancelled: { label: "취소", variant: "destructive" },
};

export default function AdminPrograms() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProgramRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProgramRecord | null>(null);

  const { data: programs = [], isLoading } = useQuery({
    queryKey: ["admin_programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProgramRecord[];
    },
  });

  const { data: appCounts = {} } = useQuery({
    queryKey: ["admin_program_app_counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_applications")
        .select("program_id, status");
      if (error) throw error;
      const map: Record<string, { total: number; pending: number; approved: number }> = {};
      (data ?? []).forEach((r: any) => {
        const m = (map[r.program_id] ??= { total: 0, pending: 0, approved: 0 });
        m.total++;
        if (r.status === "pending") m.pending++;
        if (r.status === "approved") m.approved++;
      });
      return map;
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return programs.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return [p.title, p.category, p.location, p.manager_name].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [programs, search, statusFilter]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("programs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "삭제되었습니다" });
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["admin_programs"] });
    },
    onError: (e: any) => toast({ title: "삭제 실패", description: e.message, variant: "destructive" }),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <CalendarRange className="h-6 w-6 text-foreground mt-0.5" />
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">프로그램 신청/참여 관리</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                특강·캠프·워크숍을 등록하고 신청 승인과 출석을 관리합니다.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-1.5" /> 프로그램 등록
          </Button>
        </header>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="제목, 카테고리, 장소, 담당자 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="상태" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs text-muted-foreground">전체 {programs.length}건 · 필터 결과 {filtered.length}건</div>

        <div className="border-2 border-border/60 rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>프로그램</TableHead>
                <TableHead className="w-[150px]">기간</TableHead>
                <TableHead className="w-[110px]">정원/신청</TableHead>
                <TableHead className="w-[90px]">상태</TableHead>
                <TableHead className="w-[180px] text-right">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">불러오는 중…</TableCell></TableRow>}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">등록된 프로그램이 없습니다. 상단의 “프로그램 등록”으로 시작하세요.</TableCell></TableRow>
              )}
              {filtered.map((p) => {
                const c = appCounts[p.id] ?? { total: 0, pending: 0, approved: 0 };
                return (
                  <TableRow key={p.id} className="border-b-2 border-border/60">
                    <TableCell>
                      <button className="font-medium hover:underline text-left" onClick={() => navigate(`/admin/programs/${p.id}`)}>
                        {p.title}
                      </button>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {[p.category, p.location, p.manager_name].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{p.starts_at ? new Date(p.starts_at).toLocaleDateString("ko-KR") : "—"}</div>
                      <div className="text-muted-foreground">~ {p.ends_at ? new Date(p.ends_at).toLocaleDateString("ko-KR") : "—"}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{p.capacity ?? "∞"} / 승인 {c.approved}</div>
                      <div className="text-muted-foreground">대기 {c.pending} · 총 {c.total}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS[p.status]?.variant ?? "outline"}>{STATUS[p.status]?.label ?? p.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/programs/${p.id}`)}>
                        <Users2 className="h-4 w-4 mr-1" /> 신청자
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setFormOpen(true); }} title="수정">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(p)} title="삭제">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <ProgramFormDialog
          open={formOpen}
          onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }}
          editing={editing}
          onSaved={() => qc.invalidateQueries({ queryKey: ["admin_programs"] })}
        />

        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>프로그램을 삭제하시겠습니까?</AlertDialogTitle>
              <AlertDialogDescription>
                "{deleteTarget?.title}" 및 관련 신청·출석 기록이 모두 삭제됩니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>삭제</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}