import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Search, Upload, Download, Pencil, Trash2, Eye } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Beneficiary = {
  id: string;
  student_no: string;
  full_name: string;
  dept_name: string | null;
  grade: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  program_name: string | null;
  track: string | null;
  cohort: string | null;
  income_bracket: number | null;
  is_vulnerable: boolean;
  vulnerable_type: string | null;
  nationality: string | null;
  gender: string | null;
  birth_year: number | null;
  enrolled_on: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  active: "활동중",
  inactive: "휴면",
  graduated: "수료",
  withdrawn: "이탈",
};

const emptyForm: Partial<Beneficiary> = {
  student_no: "",
  full_name: "",
  dept_name: "",
  grade: "",
  contact_phone: "",
  contact_email: "",
  program_name: "",
  track: "",
  cohort: "",
  income_bracket: null,
  is_vulnerable: false,
  vulnerable_type: "",
  nationality: "",
  gender: "",
  birth_year: null,
  enrolled_on: null,
  status: "active",
  notes: "",
};

// Minimal CSV parser (handles quoted fields with commas and "" escapes)
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((r) =>
      r
        .map((v) => {
          const s = v == null ? "" : String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\r\n");
}

const CSV_HEADERS = [
  "student_no", "full_name", "dept_name", "grade",
  "contact_phone", "contact_email",
  "program_name", "track", "cohort",
  "income_bracket", "is_vulnerable", "vulnerable_type",
  "nationality", "gender", "birth_year",
  "enrolled_on", "status", "notes",
];

export default function AdminBeneficiaries() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [programFilter, setProgramFilter] = useState<string>("all");
  const [cohortFilter, setCohortFilter] = useState<string>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<Beneficiary | null>(null);
  const [form, setForm] = useState<Partial<Beneficiary>>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Beneficiary | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["beneficiary_students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beneficiary_students")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Beneficiary[];
    },
  });

  const programs = useMemo(() => Array.from(new Set(rows.map((r) => r.program_name).filter(Boolean))) as string[], [rows]);
  const cohorts = useMemo(() => Array.from(new Set(rows.map((r) => r.cohort).filter(Boolean))) as string[], [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (programFilter !== "all" && r.program_name !== programFilter) return false;
      if (cohortFilter !== "all" && r.cohort !== cohortFilter) return false;
      if (!q) return true;
      return [r.student_no, r.full_name, r.dept_name, r.contact_email, r.contact_phone, r.program_name, r.track, r.cohort]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, search, statusFilter, programFilter, cohortFilter]);

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<Beneficiary>) => {
      const clean: any = { ...payload };
      // empty strings -> null for optional fields
      Object.keys(clean).forEach((k) => {
        if (clean[k] === "") clean[k] = null;
      });
      if (clean.income_bracket != null) clean.income_bracket = Number(clean.income_bracket);
      if (clean.birth_year != null) clean.birth_year = Number(clean.birth_year);
      if (editing) {
        const { error } = await supabase.from("beneficiary_students").update(clean).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("beneficiary_students").insert(clean);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? "수정되었습니다" : "등록되었습니다" });
      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["beneficiary_students"] });
    },
    onError: (e: any) => toast({ title: "저장 실패", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("beneficiary_students").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "삭제되었습니다" });
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["beneficiary_students"] });
    },
    onError: (e: any) => toast({ title: "삭제 실패", description: e.message, variant: "destructive" }),
  });

  const csvImportMutation = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length < 2) throw new Error("CSV에 데이터가 없습니다.");
      const header = parsed[0].map((h) => h.trim());
      const records = parsed.slice(1).map((line) => {
        const obj: any = {};
        header.forEach((h, idx) => {
          let v: any = (line[idx] ?? "").trim();
          if (v === "") v = null;
          if (h === "income_bracket" && v != null) v = Number(v);
          if (h === "birth_year" && v != null) v = Number(v);
          if (h === "is_vulnerable") v = v === "true" || v === "1" || v === "Y" || v === "y";
          obj[h] = v;
        });
        return obj;
      });
      const valid = records.filter((r) => r.student_no && r.full_name);
      if (valid.length === 0) throw new Error("student_no, full_name 컬럼이 필요합니다.");
      const { error } = await supabase
        .from("beneficiary_students")
        .upsert(valid, { onConflict: "student_no" });
      if (error) throw error;
      return valid.length;
    },
    onSuccess: (n) => {
      toast({ title: "CSV 업로드 완료", description: `${n}건 등록/갱신` });
      qc.invalidateQueries({ queryKey: ["beneficiary_students"] });
    },
    onError: (e: any) => toast({ title: "CSV 업로드 실패", description: e.message, variant: "destructive" }),
  });

  const handleCsvExport = () => {
    const data: (string | number | null)[][] = [CSV_HEADERS];
    filtered.forEach((r) => {
      data.push(CSV_HEADERS.map((h) => (r as any)[h] ?? ""));
    });
    const csv = "\ufeff" + toCsv(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `beneficiaries-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvTemplate = () => {
    const csv = "\ufeff" + toCsv([CSV_HEADERS, [
      "20250001", "홍길동", "경영학과", "3",
      "010-0000-0000", "hong@example.com",
      "산학협력선도사업", "AI트랙", "1기",
      "5", "false", "",
      "KR", "M", "2002",
      "2025-03-01", "active", "",
    ]]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "beneficiaries-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (r: Beneficiary) => {
    setEditing(r);
    setForm(r);
    setFormOpen(true);
  };

  const openDetail = (r: Beneficiary) => {
    setEditing(r);
    setDetailOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Users className="h-6 w-6 text-foreground mt-0.5" />
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">수혜학생 DB</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                지원사업 대상 학생을 등록·검색하고 CSV로 일괄 관리할 수 있습니다.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) csvImportMutation.mutate(f);
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" onClick={handleCsvTemplate}>
              <Download className="h-4 w-4 mr-1.5" /> 템플릿
            </Button>
            <Button variant="outline" size="sm" onClick={handleCsvExport}>
              <Download className="h-4 w-4 mr-1.5" /> CSV 내보내기
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={csvImportMutation.isPending}>
              <Upload className="h-4 w-4 mr-1.5" /> CSV 업로드
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" /> 학생 등록
            </Button>
          </div>
        </header>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="학번, 이름, 학과, 이메일, 사업명 등으로 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="상태" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={programFilter} onValueChange={setProgramFilter}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="사업명" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 사업</SelectItem>
              {programs.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={cohortFilter} onValueChange={setCohortFilter}>
            <SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="기수" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 기수</SelectItem>
              {cohorts.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs text-muted-foreground">
          전체 {rows.length}명 · 필터 결과 {filtered.length}명
        </div>

        <div className="border-2 border-border/60 rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">학번</TableHead>
                <TableHead>이름</TableHead>
                <TableHead>학과/학년</TableHead>
                <TableHead>사업명 / 트랙 / 기수</TableHead>
                <TableHead>연락처</TableHead>
                <TableHead className="w-[80px]">상태</TableHead>
                <TableHead className="w-[140px] text-right">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">불러오는 중…</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">데이터가 없습니다. 상단의 “학생 등록” 또는 “CSV 업로드”로 시작하세요.</TableCell></TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.id} className="border-b-2 border-border/60">
                  <TableCell className="font-mono text-xs">{r.student_no}</TableCell>
                  <TableCell className="font-medium">
                    <button className="hover:underline text-left" onClick={() => openDetail(r)}>{r.full_name}</button>
                    {r.is_vulnerable && <Badge variant="outline" className="ml-2">취약</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[r.dept_name, r.grade ? `${r.grade}학년` : null].filter(Boolean).join(" · ") || "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {[r.program_name, r.track, r.cohort].filter(Boolean).join(" · ") || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div>{r.contact_phone || "—"}</div>
                    <div className="text-xs">{r.contact_email || ""}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === "active" ? "default" : "secondary"}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openDetail(r)} title="상세">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)} title="수정">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(r)} title="삭제">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Create / Edit Dialog */}
        <Dialog open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) { setEditing(null); setForm(emptyForm); } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "수혜학생 수정" : "수혜학생 등록"}</DialogTitle>
              <DialogDescription>학번과 이름은 필수입니다. 그 외 항목은 비워둘 수 있습니다.</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              <Field label="학번 *">
                <Input required value={form.student_no ?? ""} onChange={(e) => setForm({ ...form, student_no: e.target.value })} />
              </Field>
              <Field label="이름 *">
                <Input required value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </Field>
              <Field label="학과">
                <Input value={form.dept_name ?? ""} onChange={(e) => setForm({ ...form, dept_name: e.target.value })} />
              </Field>
              <Field label="학년">
                <Input value={form.grade ?? ""} onChange={(e) => setForm({ ...form, grade: e.target.value })} />
              </Field>
              <Field label="연락처">
                <Input value={form.contact_phone ?? ""} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
              </Field>
              <Field label="이메일">
                <Input type="email" value={form.contact_email ?? ""} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
              </Field>
              <Field label="지원사업명">
                <Input value={form.program_name ?? ""} onChange={(e) => setForm({ ...form, program_name: e.target.value })} />
              </Field>
              <Field label="트랙">
                <Input value={form.track ?? ""} onChange={(e) => setForm({ ...form, track: e.target.value })} />
              </Field>
              <Field label="기수">
                <Input value={form.cohort ?? ""} onChange={(e) => setForm({ ...form, cohort: e.target.value })} />
              </Field>
              <Field label="소득분위(0~10)">
                <Input type="number" min={0} max={10} value={form.income_bracket ?? ""} onChange={(e) => setForm({ ...form, income_bracket: e.target.value === "" ? null : Number(e.target.value) })} />
              </Field>
              <Field label="취약계층 여부">
                <Select value={form.is_vulnerable ? "true" : "false"} onValueChange={(v) => setForm({ ...form, is_vulnerable: v === "true" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">해당 없음</SelectItem>
                    <SelectItem value="true">해당</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="취약계층 유형">
                <Input value={form.vulnerable_type ?? ""} onChange={(e) => setForm({ ...form, vulnerable_type: e.target.value })} />
              </Field>
              <Field label="국적">
                <Input value={form.nationality ?? ""} onChange={(e) => setForm({ ...form, nationality: e.target.value })} />
              </Field>
              <Field label="성별">
                <Input value={form.gender ?? ""} onChange={(e) => setForm({ ...form, gender: e.target.value })} />
              </Field>
              <Field label="출생년도">
                <Input type="number" value={form.birth_year ?? ""} onChange={(e) => setForm({ ...form, birth_year: e.target.value === "" ? null : Number(e.target.value) })} />
              </Field>
              <Field label="등록일">
                <Input type="date" value={form.enrolled_on ?? ""} onChange={(e) => setForm({ ...form, enrolled_on: e.target.value || null })} />
              </Field>
              <Field label="상태">
                <Select value={form.status ?? "active"} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="sm:col-span-2">
                <Label className="text-xs font-medium text-muted-foreground">메모</Label>
                <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <DialogFooter className="sm:col-span-2 mt-2">
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>취소</Button>
                <Button type="submit" disabled={saveMutation.isPending}>{editing ? "수정" : "등록"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Detail Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing?.full_name} <span className="text-sm font-normal text-muted-foreground ml-2">{editing?.student_no}</span></DialogTitle>
              <DialogDescription>수혜학생 상세 정보</DialogDescription>
            </DialogHeader>
            {editing && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-sm">
                <Info label="학과">{editing.dept_name ?? "—"}</Info>
                <Info label="학년">{editing.grade ?? "—"}</Info>
                <Info label="상태"><Badge variant={editing.status === "active" ? "default" : "secondary"}>{STATUS_LABEL[editing.status] ?? editing.status}</Badge></Info>
                <Info label="연락처">{editing.contact_phone ?? "—"}</Info>
                <Info label="이메일">{editing.contact_email ?? "—"}</Info>
                <Info label="등록일">{editing.enrolled_on ?? "—"}</Info>
                <Info label="사업명">{editing.program_name ?? "—"}</Info>
                <Info label="트랙">{editing.track ?? "—"}</Info>
                <Info label="기수">{editing.cohort ?? "—"}</Info>
                <Info label="소득분위">{editing.income_bracket ?? "—"}</Info>
                <Info label="취약계층">{editing.is_vulnerable ? `해당 (${editing.vulnerable_type ?? "-"})` : "해당 없음"}</Info>
                <Info label="국적">{editing.nationality ?? "—"}</Info>
                <Info label="성별">{editing.gender ?? "—"}</Info>
                <Info label="출생년도">{editing.birth_year ?? "—"}</Info>
                <Info label="등록일시">{new Date(editing.created_at).toLocaleDateString("ko-KR")}</Info>
                {editing.notes && (
                  <div className="col-span-full">
                    <Label className="text-xs font-medium text-muted-foreground">메모</Label>
                    <p className="text-sm whitespace-pre-wrap mt-1">{editing.notes}</p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailOpen(false)}>닫기</Button>
              <Button onClick={() => { setDetailOpen(false); if (editing) openEdit(editing); }}>수정</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirm */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>학생을 삭제하시겠습니까?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget?.full_name} ({deleteTarget?.student_no})의 마스터 정보가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-muted-foreground uppercase">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}