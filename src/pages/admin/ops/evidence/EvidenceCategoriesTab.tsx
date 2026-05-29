import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Category = {
  id: string;
  name: string;
  description: string | null;
  scope: string;
  is_required: boolean;
  sort_order: number;
  active: boolean;
};

const SCOPE_LABEL: Record<string, string> = {
  general: "전체",
  program: "프로그램",
  project: "산학프로젝트",
};

const emptyForm: Partial<Category> = {
  name: "",
  description: "",
  scope: "general",
  is_required: false,
  sort_order: 0,
  active: true,
};

export default function EvidenceCategoriesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<Partial<Category>>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["evidence_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evidence_categories")
        .select("*")
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  const save = useMutation({
    mutationFn: async (payload: Partial<Category>) => {
      const clean: any = { ...payload };
      if (clean.description === "") clean.description = null;
      clean.sort_order = Number(clean.sort_order ?? 0);
      if (editing) {
        const { error } = await supabase.from("evidence_categories").update(clean).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("evidence_categories").insert(clean);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? "수정되었습니다" : "등록되었습니다" });
      setOpen(false); setEditing(null); setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["evidence_categories"] });
    },
    onError: (e: any) => toast({ title: "저장 실패", description: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("evidence_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "삭제되었습니다" });
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["evidence_categories"] });
    },
    onError: (e: any) => toast({ title: "삭제 실패", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (r: Category) => { setEditing(r); setForm(r); setOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" />카테고리 추가</Button>
      </div>

      <div className="border-2 border-border/60 rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">순서</TableHead>
              <TableHead>이름</TableHead>
              <TableHead>적용 범위</TableHead>
              <TableHead>필수</TableHead>
              <TableHead>활성</TableHead>
              <TableHead className="text-right w-[120px]">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">불러오는 중…</TableCell></TableRow>}
            {!isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">등록된 카테고리가 없습니다.</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id} className="border-b-2 border-border/60">
                <TableCell className="text-sm text-muted-foreground">{r.sort_order}</TableCell>
                <TableCell className="font-medium">
                  {r.name}
                  {r.description && <div className="text-xs text-muted-foreground mt-0.5">{r.description}</div>}
                </TableCell>
                <TableCell><Badge variant="outline">{SCOPE_LABEL[r.scope] ?? r.scope}</Badge></TableCell>
                <TableCell>{r.is_required ? <Badge>필수</Badge> : <span className="text-muted-foreground text-sm">—</span>}</TableCell>
                <TableCell>{r.active ? <Badge variant="secondary">활성</Badge> : <span className="text-muted-foreground text-sm">비활성</span>}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm(emptyForm); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "카테고리 수정" : "카테고리 추가"}</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}>
            <div>
              <Label>이름 *</Label>
              <Input required value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>설명</Label>
              <Textarea rows={2} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>적용 범위</Label>
                <Select value={form.scope ?? "general"} onValueChange={(v) => setForm({ ...form, scope: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">전체</SelectItem>
                    <SelectItem value="program">프로그램</SelectItem>
                    <SelectItem value="project">산학프로젝트</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>정렬 순서</Label>
                <Input type="number" value={form.sort_order ?? 0} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="cursor-pointer">필수 제출</Label>
              <Switch checked={!!form.is_required} onCheckedChange={(v) => setForm({ ...form, is_required: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="cursor-pointer">활성</Label>
              <Switch checked={form.active ?? true} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>취소</Button>
              <Button type="submit" disabled={save.isPending}>{save.isPending ? "저장 중…" : "저장"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>카테고리를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              이미 이 카테고리로 제출된 자료가 있다면 삭제할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && del.mutate(deleteTarget.id)}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}