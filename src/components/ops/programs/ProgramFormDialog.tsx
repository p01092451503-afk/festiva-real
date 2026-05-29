import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export type FormField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number" | "checkbox";
  required: boolean;
  options?: string[];
};

export type ProgramRecord = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  location: string | null;
  capacity: number | null;
  starts_at: string | null;
  ends_at: string | null;
  apply_starts_at: string | null;
  apply_ends_at: string | null;
  manager_name: string | null;
  contact: string | null;
  budget: number | null;
  status: string;
  form_schema: FormField[] | any;
  cover_image_url: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

const STATUS_OPTIONS = [
  { value: "draft", label: "임시" },
  { value: "open", label: "모집중" },
  { value: "closed", label: "마감" },
  { value: "completed", label: "종료" },
  { value: "cancelled", label: "취소" },
];

const defaultForm = {
  title: "",
  description: "",
  category: "",
  location: "",
  capacity: "" as any,
  starts_at: "",
  ends_at: "",
  apply_starts_at: "",
  apply_ends_at: "",
  manager_name: "",
  contact: "",
  budget: "" as any,
  status: "draft",
  is_public: true,
  cover_image_url: "",
  form_schema: [] as FormField[],
};

const toLocal = (iso: string | null | undefined) =>
  iso ? new Date(iso).toISOString().slice(0, 16) : "";
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: ProgramRecord | null;
  onSaved: () => void;
}

export default function ProgramFormDialog({ open, onOpenChange, editing, onSaved }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState({ ...defaultForm });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        title: editing.title ?? "",
        description: editing.description ?? "",
        category: editing.category ?? "",
        location: editing.location ?? "",
        capacity: editing.capacity ?? "",
        starts_at: toLocal(editing.starts_at),
        ends_at: toLocal(editing.ends_at),
        apply_starts_at: toLocal(editing.apply_starts_at),
        apply_ends_at: toLocal(editing.apply_ends_at),
        manager_name: editing.manager_name ?? "",
        contact: editing.contact ?? "",
        budget: editing.budget ?? "",
        status: editing.status ?? "draft",
        is_public: editing.is_public,
        cover_image_url: editing.cover_image_url ?? "",
        form_schema: Array.isArray(editing.form_schema) ? editing.form_schema : [],
      });
    } else {
      setForm({ ...defaultForm });
    }
  }, [open, editing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title: form.title,
        description: form.description || null,
        category: form.category || null,
        location: form.location || null,
        capacity: form.capacity === "" ? null : Number(form.capacity),
        starts_at: fromLocal(form.starts_at),
        ends_at: fromLocal(form.ends_at),
        apply_starts_at: fromLocal(form.apply_starts_at),
        apply_ends_at: fromLocal(form.apply_ends_at),
        manager_name: form.manager_name || null,
        contact: form.contact || null,
        budget: form.budget === "" ? null : Number(form.budget),
        status: form.status,
        is_public: form.is_public,
        cover_image_url: form.cover_image_url || null,
        form_schema: form.form_schema,
      };
      if (editing) {
        const { error } = await supabase.from("programs").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        payload.created_by = user?.id ?? null;
        const { error } = await supabase.from("programs").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? "수정되었습니다" : "등록되었습니다" });
      onSaved();
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "저장 실패", description: e.message, variant: "destructive" }),
  });

  const addField = () => {
    setForm((f) => ({
      ...f,
      form_schema: [...f.form_schema, { key: `q${f.form_schema.length + 1}`, label: "새 질문", type: "text", required: false }],
    }));
  };

  const updateField = (idx: number, patch: Partial<FormField>) => {
    setForm((f) => ({
      ...f,
      form_schema: f.form_schema.map((q, i) => (i === idx ? { ...q, ...patch } : q)),
    }));
  };

  const removeField = (idx: number) => {
    setForm((f) => ({ ...f, form_schema: f.form_schema.filter((_, i) => i !== idx) }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "프로그램 수정" : "프로그램 등록"}</DialogTitle>
          <DialogDescription>제목과 상태는 필수이며, 신청 폼은 학생에게 표시되는 추가 질문입니다.</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }}
          className="space-y-5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="제목 *" className="sm:col-span-2">
              <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            <Field label="설명" className="sm:col-span-2">
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="카테고리"><Input placeholder="특강 / 캠프 / 워크숍" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
            <Field label="장소"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
            <Field label="정원(빈칸=무제한)"><Input type="number" min={0} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></Field>
            <Field label="예산(원)"><Input type="number" min={0} value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></Field>
            <Field label="시작일시"><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></Field>
            <Field label="종료일시"><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></Field>
            <Field label="모집 시작"><Input type="datetime-local" value={form.apply_starts_at} onChange={(e) => setForm({ ...form, apply_starts_at: e.target.value })} /></Field>
            <Field label="모집 마감"><Input type="datetime-local" value={form.apply_ends_at} onChange={(e) => setForm({ ...form, apply_ends_at: e.target.value })} /></Field>
            <Field label="담당자명"><Input value={form.manager_name} onChange={(e) => setForm({ ...form, manager_name: e.target.value })} /></Field>
            <Field label="연락처"><Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></Field>
            <Field label="대표 이미지 URL" className="sm:col-span-2">
              <Input value={form.cover_image_url} onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })} />
            </Field>
            <Field label="상태 *">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="공개 여부">
              <Select value={form.is_public ? "1" : "0"} onValueChange={(v) => setForm({ ...form, is_public: v === "1" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">공개 (학생에게 노출)</SelectItem>
                  <SelectItem value="0">비공개</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="border-2 border-border/60 rounded-md p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">신청 폼 질문</h3>
                <p className="text-xs text-muted-foreground">학생이 신청 시 답해야 할 추가 질문입니다.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addField}>
                <Plus className="h-4 w-4 mr-1" /> 질문 추가
              </Button>
            </div>
            {form.form_schema.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">추가 질문 없이 기본 정보(이름·연락처)만 받습니다.</p>
            )}
            {form.form_schema.map((q, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-start border-b border-border/60 pb-3 last:border-b-0 last:pb-0">
                <div className="col-span-12 sm:col-span-1 flex items-center justify-center pt-2 text-muted-foreground">
                  <GripVertical className="h-4 w-4" />
                </div>
                <div className="col-span-12 sm:col-span-4">
                  <Label className="text-[11px] text-muted-foreground">질문 라벨</Label>
                  <Input value={q.label} onChange={(e) => updateField(idx, { label: e.target.value })} />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <Label className="text-[11px] text-muted-foreground">유형</Label>
                  <Select value={q.type} onValueChange={(v: any) => updateField(idx, { type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">단답</SelectItem>
                      <SelectItem value="textarea">서술</SelectItem>
                      <SelectItem value="select">선택</SelectItem>
                      <SelectItem value="number">숫자</SelectItem>
                      <SelectItem value="checkbox">동의(체크박스)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <Label className="text-[11px] text-muted-foreground">필수</Label>
                  <Select value={q.required ? "1" : "0"} onValueChange={(v) => updateField(idx, { required: v === "1" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">선택</SelectItem>
                      <SelectItem value="1">필수</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-12 sm:col-span-1 flex sm:justify-end pt-5">
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeField(idx)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                {q.type === "select" && (
                  <div className="col-span-12 sm:col-start-2 sm:col-span-10">
                    <Label className="text-[11px] text-muted-foreground">선택 옵션(쉼표로 구분)</Label>
                    <Input
                      value={(q.options ?? []).join(", ")}
                      onChange={(e) => updateField(idx, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                      placeholder="예: 1학년, 2학년, 3학년"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
            <Button type="submit" disabled={saveMutation.isPending}>{editing ? "수정" : "등록"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}