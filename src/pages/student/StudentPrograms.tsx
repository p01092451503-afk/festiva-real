import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, MapPin, Users2, Search, ClipboardList, CheckCircle2 } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useFeatureModules } from "@/hooks/useFeatureModules";
import { Navigate } from "react-router-dom";

type FormField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number" | "checkbox";
  required: boolean;
  options?: string[];
};

type Program = {
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
  status: string;
  form_schema: FormField[] | any;
  cover_image_url: string | null;
};

type Application = {
  id: string;
  program_id: string;
  status: string;
  created_at: string;
};

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  open: { label: "모집중", variant: "default" },
  closed: { label: "마감", variant: "secondary" },
  completed: { label: "종료", variant: "outline" },
};

const APP_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "신청 대기", variant: "outline" },
  approved: { label: "승인", variant: "default" },
  rejected: { label: "반려", variant: "destructive" },
  waitlisted: { label: "대기열", variant: "secondary" },
  cancelled: { label: "취소", variant: "secondary" },
};

const formatRange = (start?: string | null, end?: string | null) => {
  if (!start && !end) return "일정 미정";
  const fmt = (s?: string | null) => (s ? new Date(s).toLocaleDateString("ko-KR") : "?");
  return `${fmt(start)} ~ ${fmt(end)}`;
};

const isApplyOpen = (p: Program) => {
  if (p.status !== "open") return false;
  const now = Date.now();
  if (p.apply_starts_at && new Date(p.apply_starts_at).getTime() > now) return false;
  if (p.apply_ends_at && new Date(p.apply_ends_at).getTime() < now) return false;
  return true;
};

export default function StudentPrograms() {
  const { user, profile } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { isEnabled, isLoading: modulesLoading } = useFeatureModules();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Program | null>(null);
  const [applying, setApplying] = useState<Program | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [applicantName, setApplicantName] = useState("");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [applicantPhone, setApplicantPhone] = useState("");

  const { data: programs = [], isLoading } = useQuery({
    queryKey: ["student_programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .eq("is_public", true)
        .in("status", ["open", "closed", "completed"])
        .order("starts_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Program[];
    },
  });

  const { data: myApps = [] } = useQuery({
    queryKey: ["student_program_apps", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_applications")
        .select("id, program_id, status, created_at")
        .eq("applicant_user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as Application[];
    },
  });

  const appMap = useMemo(() => {
    const m: Record<string, Application> = {};
    myApps.forEach((a) => (m[a.program_id] = a));
    return m;
  }, [myApps]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return programs.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return [p.title, p.category, p.location, p.description]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [programs, search, statusFilter]);

  const openApply = (p: Program) => {
    setApplying(p);
    setSelected(null);
    const initial: Record<string, any> = {};
    (Array.isArray(p.form_schema) ? (p.form_schema as FormField[]) : []).forEach((f) => {
      initial[f.key] = f.type === "checkbox" ? false : "";
    });
    setAnswers(initial);
    setApplicantName(profile?.full_name || "");
    setApplicantEmail(user?.email || "");
    setApplicantPhone(profile?.phone_number || "");
  };

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!applying || !user) throw new Error("로그인이 필요합니다");
      const schema = Array.isArray(applying.form_schema) ? (applying.form_schema as FormField[]) : [];
      for (const f of schema) {
        if (f.required) {
          const v = answers[f.key];
          if (v === undefined || v === null || v === "" || v === false) {
            throw new Error(`필수 항목을 입력해주세요: ${f.label}`);
          }
        }
      }
      if (!applicantName.trim()) throw new Error("신청자 이름을 입력해주세요");
      const { error } = await supabase.from("program_applications").insert({
        program_id: applying.id,
        applicant_user_id: user.id,
        applicant_name: applicantName.trim(),
        applicant_email: applicantEmail.trim() || null,
        applicant_phone: applicantPhone.trim() || null,
        answers,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "신청이 접수되었습니다", description: "관리자 승인 후 참여가 확정됩니다." });
      setApplying(null);
      qc.invalidateQueries({ queryKey: ["student_program_apps"] });
    },
    onError: (e: any) => {
      toast({ title: "신청 실패", description: e.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (appId: string) => {
      const { error } = await supabase
        .from("program_applications")
        .update({ status: "cancelled" })
        .eq("id", appId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "신청이 취소되었습니다" });
      qc.invalidateQueries({ queryKey: ["student_program_apps"] });
    },
    onError: (e: any) => toast({ title: "취소 실패", description: e.message, variant: "destructive" }),
  });

  if (!modulesLoading && !isEnabled("programs")) {
    return <Navigate to="/" replace />;
  }

  const renderField = (f: FormField) => {
    const v = answers[f.key];
    const set = (val: any) => setAnswers((a) => ({ ...a, [f.key]: val }));
    switch (f.type) {
      case "textarea":
        return <Textarea value={v ?? ""} onChange={(e) => set(e.target.value)} rows={3} />;
      case "number":
        return <Input type="number" value={v ?? ""} onChange={(e) => set(e.target.value)} />;
      case "select":
        return (
          <Select value={v ?? ""} onValueChange={set}>
            <SelectTrigger>
              <SelectValue placeholder="선택" />
            </SelectTrigger>
            <SelectContent>
              {(f.options ?? []).map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "checkbox":
        return (
          <div className="flex items-center gap-2 pt-2">
            <Checkbox checked={!!v} onCheckedChange={(c) => set(!!c)} />
            <span className="text-sm text-muted-foreground">동의합니다</span>
          </div>
        );
      default:
        return <Input value={v ?? ""} onChange={(e) => set(e.target.value)} />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 min-w-0">
        <header className="space-y-1">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-muted-foreground" />
            <h1 className="text-xl sm:text-2xl font-semibold">프로그램 신청</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            워크숍·캠프·특강 등 사업단에서 운영하는 프로그램에 신청하세요.
          </p>
        </header>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="프로그램명·카테고리·장소 검색"
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
              <SelectItem value="open">모집중</SelectItem>
              <SelectItem value="closed">마감</SelectItem>
              <SelectItem value="completed">종료</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">불러오는 중…</p>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              조건에 맞는 프로그램이 없습니다.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => {
              const app = appMap[p.id];
              const canApply = isApplyOpen(p) && !app;
              return (
                <Card key={p.id} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug line-clamp-2">{p.title}</CardTitle>
                      <Badge variant={STATUS_LABEL[p.status]?.variant ?? "outline"} className="whitespace-nowrap">
                        {STATUS_LABEL[p.status]?.label ?? p.status}
                      </Badge>
                    </div>
                    {p.category && (
                      <p className="text-xs text-muted-foreground">{p.category}</p>
                    )}
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 flex-1">
                    <div className="space-y-1.5 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <CalendarRange className="w-4 h-4" />
                        <span>{formatRange(p.starts_at, p.ends_at)}</span>
                      </div>
                      {p.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          <span className="truncate">{p.location}</span>
                        </div>
                      )}
                      {p.capacity && (
                        <div className="flex items-center gap-2">
                          <Users2 className="w-4 h-4" />
                          <span>정원 {p.capacity}명</span>
                        </div>
                      )}
                    </div>
                    {p.description && (
                      <p className="text-sm line-clamp-2 text-foreground/80">{p.description}</p>
                    )}
                    <div className="mt-auto flex items-center gap-2 pt-2">
                      {app && (
                        <Badge variant={APP_STATUS[app.status]?.variant ?? "outline"}>
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          {APP_STATUS[app.status]?.label ?? app.status}
                        </Badge>
                      )}
                      <div className="ml-auto flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSelected(p)}>
                          자세히
                        </Button>
                        {canApply ? (
                          <Button size="sm" onClick={() => openApply(p)}>
                            신청하기
                          </Button>
                        ) : app && app.status === "pending" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => cancelMutation.mutate(app.id)}
                            disabled={cancelMutation.isPending}
                          >
                            신청 취소
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 상세 보기 */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.title}</DialogTitle>
                <DialogDescription>{selected.category || "프로그램 상세"}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Info label="운영 기간" value={formatRange(selected.starts_at, selected.ends_at)} />
                  <Info
                    label="신청 기간"
                    value={formatRange(selected.apply_starts_at, selected.apply_ends_at)}
                  />
                  <Info label="장소" value={selected.location || "미정"} />
                  <Info label="정원" value={selected.capacity ? `${selected.capacity}명` : "제한 없음"} />
                  <Info label="담당자" value={selected.manager_name || "-"} />
                  <Info label="연락처" value={selected.contact || "-"} />
                </div>
                {selected.description && (
                  <div>
                    <Label className="text-xs text-muted-foreground">설명</Label>
                    <p className="whitespace-pre-wrap mt-1">{selected.description}</p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>
                  닫기
                </Button>
                {isApplyOpen(selected) && !appMap[selected.id] && (
                  <Button onClick={() => openApply(selected)}>신청하기</Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 신청 폼 */}
      <Dialog open={!!applying} onOpenChange={(o) => !o && setApplying(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          {applying && (
            <>
              <DialogHeader>
                <DialogTitle>{applying.title} 신청</DialogTitle>
                <DialogDescription>
                  신청자 정보와 추가 항목을 작성해주세요. 관리자 승인 후 참여가 확정됩니다.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>
                      이름 <span className="text-destructive">*</span>
                    </Label>
                    <Input value={applicantName} onChange={(e) => setApplicantName(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>이메일</Label>
                      <Input value={applicantEmail} onChange={(e) => setApplicantEmail(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>연락처</Label>
                      <Input value={applicantPhone} onChange={(e) => setApplicantPhone(e.target.value)} />
                    </div>
                  </div>
                </div>

                {Array.isArray(applying.form_schema) && applying.form_schema.length > 0 && (
                  <div className="space-y-3 border-t pt-4">
                    <p className="text-sm font-medium">추가 신청 항목</p>
                    {(applying.form_schema as FormField[]).map((f) => (
                      <div key={f.key} className="space-y-1.5">
                        <Label>
                          {f.label}
                          {f.required && <span className="text-destructive ml-1">*</span>}
                        </Label>
                        {renderField(f)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setApplying(null)}>
                  취소
                </Button>
                <Button onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending}>
                  {applyMutation.isPending ? "제출 중…" : "신청 제출"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}