import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export type IaProjectRecord = {
  id: string;
  title: string;
  partner_company: string | null;
  partner_contact: string | null;
  partner_email: string | null;
  partner_phone: string | null;
  description: string | null;
  category: string | null;
  cohort: string | null;
  starts_at: string | null;
  ends_at: string | null;
  budget: number | null;
  status: string;
  progress: number;
  lead_teacher_id: string | null;
  lead_teacher_name: string | null;
  manager_name: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_OPTIONS = [
  { value: "planning", label: "기획" },
  { value: "active", label: "진행중" },
  { value: "on_hold", label: "보류" },
  { value: "completed", label: "완료" },
  { value: "cancelled", label: "취소" },
];

const defaults = {
  title: "",
  partner_company: "",
  partner_contact: "",
  partner_email: "",
  partner_phone: "",
  description: "",
  category: "",
  cohort: "",
  starts_at: "",
  ends_at: "",
  budget: "" as any,
  status: "planning",
  progress: 0,
  lead_teacher_name: "",
  manager_name: "",
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: IaProjectRecord | null;
  onSaved: () => void;
}

export default function IaProjectFormDialog({ open, onOpenChange, editing, onSaved }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState(defaults);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        title: editing.title || "",
        partner_company: editing.partner_company || "",
        partner_contact: editing.partner_contact || "",
        partner_email: editing.partner_email || "",
        partner_phone: editing.partner_phone || "",
        description: editing.description || "",
        category: editing.category || "",
        cohort: editing.cohort || "",
        starts_at: editing.starts_at ?? "",
        ends_at: editing.ends_at ?? "",
        budget: editing.budget ?? ("" as any),
        status: editing.status || "planning",
        progress: editing.progress ?? 0,
        lead_teacher_name: editing.lead_teacher_name || "",
        manager_name: editing.manager_name || "",
      });
    } else {
      setForm(defaults);
    }
  }, [editing, open]);

  const set = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("프로젝트 제목을 입력해주세요");
      const payload = {
        title: form.title.trim(),
        partner_company: form.partner_company || null,
        partner_contact: form.partner_contact || null,
        partner_email: form.partner_email || null,
        partner_phone: form.partner_phone || null,
        description: form.description || null,
        category: form.category || null,
        cohort: form.cohort || null,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
        budget: form.budget === "" ? null : Number(form.budget),
        status: form.status,
        progress: Math.max(0, Math.min(100, Number(form.progress) || 0)),
        lead_teacher_name: form.lead_teacher_name || null,
        manager_name: form.manager_name || null,
      };
      if (editing) {
        const { error } = await supabase.from("ia_projects").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ia_projects").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? "수정되었습니다" : "프로젝트가 추가되었습니다" });
      onSaved();
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "저장 실패", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "프로젝트 수정" : "새 산학프로젝트"}</DialogTitle>
          <DialogDescription>기업 정보, 기간, 담당자, 진척률을 입력하세요.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>프로젝트명 <span className="text-destructive">*</span></Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>카테고리</Label>
              <Input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="예: AI, 캡스톤, 인턴십" />
            </div>
            <div className="space-y-1.5">
              <Label>차수/기수</Label>
              <Input value={form.cohort} onChange={(e) => set("cohort", e.target.value)} placeholder="예: 2026-1" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>협력 기업</Label>
              <Input value={form.partner_company} onChange={(e) => set("partner_company", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>기업 담당자</Label>
              <Input value={form.partner_contact} onChange={(e) => set("partner_contact", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>기업 이메일</Label>
              <Input value={form.partner_email} onChange={(e) => set("partner_email", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>기업 연락처</Label>
              <Input value={form.partner_phone} onChange={(e) => set("partner_phone", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>시작일</Label>
              <Input type="date" value={form.starts_at} onChange={(e) => set("starts_at", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>종료일</Label>
              <Input type="date" value={form.ends_at} onChange={(e) => set("ends_at", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>예산 (원)</Label>
              <Input type="number" value={form.budget} onChange={(e) => set("budget", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>진척률 (%)</Label>
              <Input type="number" min={0} max={100} value={form.progress} onChange={(e) => set("progress", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>담당 교수/멘토</Label>
              <Input value={form.lead_teacher_name} onChange={(e) => set("lead_teacher_name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>사업단 담당자</Label>
              <Input value={form.manager_name} onChange={(e) => set("manager_name", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>상태</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>설명</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "저장 중…" : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}