import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Plus, Search, Pencil, Trash2, ArrowRight, Building2 } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import IaProjectFormDialog, { type IaProjectRecord } from "@/components/ops/projects/IaProjectFormDialog";

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  planning: { label: "기획", variant: "outline" },
  active: { label: "진행중", variant: "default" },
  on_hold: { label: "보류", variant: "secondary" },
  completed: { label: "완료", variant: "secondary" },
  cancelled: { label: "취소", variant: "destructive" },
};

export default function AdminOpsProjects() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<IaProjectRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IaProjectRecord | null>(null);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["admin_ia_projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ia_projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as IaProjectRecord[];
    },
  });

  const { data: memberCounts = {} } = useQuery({
    queryKey: ["admin_ia_member_counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ia_project_members").select("project_id");
      if (error) throw error;
      const m: Record<string, number> = {};
      (data ?? []).forEach((r: any) => (m[r.project_id] = (m[r.project_id] ?? 0) + 1));
      return m;
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return [p.title, p.partner_company, p.category, p.cohort, p.lead_teacher_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [projects, search, statusFilter]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ia_projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "프로젝트가 삭제되었습니다" });
      qc.invalidateQueries({ queryKey: ["admin_ia_projects"] });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: "삭제 실패", description: e.message, variant: "destructive" }),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 min-w-0">
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Briefcase className="w-6 h-6 text-muted-foreground" />
              <h1 className="text-xl sm:text-2xl font-semibold">산학프로젝트 관리</h1>
            </div>
            <p className="text-muted-foreground mt-1">
              기업 연계 프로젝트의 팀, 마일스톤, 산출물을 통합 관리합니다.
            </p>
          </div>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> 새 프로젝트
          </Button>
        </header>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="프로젝트명·기업·담당자 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              {Object.entries(STATUS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="border-2 border-border/80 rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>프로젝트</TableHead>
                <TableHead>협력 기업</TableHead>
                <TableHead>기간</TableHead>
                <TableHead>참여</TableHead>
                <TableHead>진척률</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">불러오는 중…</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">등록된 프로젝트가 없습니다.</TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id} className="border-b-2 border-border/80">
                    <TableCell className="font-medium">
                      <button
                        className="hover:underline text-left"
                        onClick={() => navigate(`/admin/ops-projects/${p.id}`)}
                      >
                        {p.title}
                      </button>
                      {p.category && <div className="text-xs text-muted-foreground">{p.category}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{p.partner_company || "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {p.starts_at ? new Date(p.starts_at).toLocaleDateString("ko-KR") : "?"} ~{" "}
                      {p.ends_at ? new Date(p.ends_at).toLocaleDateString("ko-KR") : "?"}
                    </TableCell>
                    <TableCell>{memberCounts[p.id] ?? 0}명</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-32">
                        <Progress value={p.progress ?? 0} className="h-1.5" />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{p.progress ?? 0}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS[p.status]?.variant ?? "outline"} className="whitespace-nowrap">
                        {STATUS[p.status]?.label ?? p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setFormOpen(true); }}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(p)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/ops-projects/${p.id}`)}>
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <IaProjectFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["admin_ia_projects"] })}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>프로젝트를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" 프로젝트의 모든 멤버·마일스톤·산출물이 함께 삭제됩니다. 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}