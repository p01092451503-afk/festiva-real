import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookText, Plus, Trash2, Pencil, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

type Scope = "all" | "course" | "content" | "assessment" | "announcement" | "board";

interface GlossaryRow {
  id: string;
  ko_term: string;
  en_term: string;
  scope: Scope;
  notes: string | null;
  is_active: boolean;
  updated_at: string;
}

const SCOPE_LABEL: Record<Scope, string> = {
  all: "전체",
  course: "강의",
  content: "차시",
  assessment: "평가",
  announcement: "공지",
  board: "게시판",
};

const empty = (): Omit<GlossaryRow, "id" | "updated_at"> => ({
  ko_term: "", en_term: "", scope: "all", notes: "", is_active: true,
});

const AdminTranslationGlossary = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<GlossaryRow | null>(null);
  const [form, setForm] = useState(empty());
  const [open, setOpen] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["translation-glossary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("translation_glossary")
        .select("*")
        .order("scope", { ascending: true })
        .order("ko_term", { ascending: true });
      if (error) throw error;
      return (data ?? []) as GlossaryRow[];
    },
  });

  const upsert = useMutation({
    mutationFn: async () => {
      if (!form.ko_term.trim() || !form.en_term.trim()) throw new Error("필수 입력");
      if (editing) {
        const { error } = await supabase
          .from("translation_glossary")
          .update({ ...form, notes: form.notes || null })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("translation_glossary")
          .insert({ ...form, notes: form.notes || null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? "수정 완료" : "용어 추가 완료" });
      setOpen(false); setEditing(null); setForm(empty());
      qc.invalidateQueries({ queryKey: ["translation-glossary"] });
    },
    onError: (e: Error) => toast({ title: "저장 실패", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("translation_glossary").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "삭제 완료" });
      qc.invalidateQueries({ queryKey: ["translation-glossary"] });
    },
  });

  const openCreate = () => { setEditing(null); setForm(empty()); setOpen(true); };
  const openEdit = (r: GlossaryRow) => {
    setEditing(r);
    setForm({ ko_term: r.ko_term, en_term: r.en_term, scope: r.scope, notes: r.notes ?? "", is_active: r.is_active });
    setOpen(true);
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="mb-6">
              <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
                <BookText className="h-6 w-6" aria-hidden="true" />
                다국어 용어 관리
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              한국어 용어를 영어로 어떻게 번역할지 미리 정의하면, AI 자동 번역 시 일관된 표현을 사용합니다.
            </p>
          </div>
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" /> 용어 추가
          </Button>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">등록된 용어 ({rows.length})</CardTitle>
            <CardDescription className="text-xs">
              브랜드명·전문 용어·자주 등장하는 단어를 추가하세요. AI 번역기에 자동으로 전달됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">불러오는 중...</div>
            ) : rows.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">등록된 용어가 없습니다.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>한국어</TableHead>
                    <TableHead>영어</TableHead>
                    <TableHead className="w-24">적용 범위</TableHead>
                    <TableHead>메모</TableHead>
                    <TableHead className="w-20">활성</TableHead>
                    <TableHead className="w-28 text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.ko_term}</TableCell>
                      <TableCell>{r.en_term}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{SCOPE_LABEL[r.scope]}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{r.notes || "-"}</TableCell>
                      <TableCell>
                        {r.is_active ? <Badge>사용</Badge> : <Badge variant="outline">중지</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(r)} aria-label="수정">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => remove.mutate(r.id)} aria-label="삭제">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "용어 수정" : "용어 추가"}</DialogTitle>
              <DialogDescription>한국어 원본과 강제로 사용할 영어 번역을 입력하세요.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">한국어 *</Label>
                  <Input value={form.ko_term} onChange={(e) => setForm({ ...form, ko_term: e.target.value })} placeholder="예: 차시" />
                </div>
                <div>
                  <Label className="text-xs">영어 *</Label>
                  <Input value={form.en_term} onChange={(e) => setForm({ ...form, en_term: e.target.value })} placeholder="예: Lesson" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">적용 범위</Label>
                  <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v as Scope })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(SCOPE_LABEL).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                    <Label className="text-xs">활성화</Label>
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-xs">메모</Label>
                <Input value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="설명 (선택)" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
              <Button onClick={() => upsert.mutate()} disabled={upsert.isPending} className="gap-1.5">
                {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin" />} 저장
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminTranslationGlossary;
