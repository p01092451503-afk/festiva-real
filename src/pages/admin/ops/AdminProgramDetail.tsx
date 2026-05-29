import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarRange, CheckCircle2, XCircle, Download, Plus } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const APP_STATUS: Record<string, { label: string; variant: any }> = {
  pending: { label: "대기", variant: "outline" },
  approved: { label: "승인", variant: "default" },
  rejected: { label: "반려", variant: "destructive" },
  waitlisted: { label: "대기열", variant: "secondary" },
  cancelled: { label: "취소", variant: "secondary" },
};

const ATT_STATUS: Record<string, string> = {
  present: "출석",
  late: "지각",
  absent: "결석",
  excused: "공결",
};

export default function AdminProgramDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [reviewTarget, setReviewTarget] = useState<any>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewStatus, setReviewStatus] = useState<string>("approved");

  const [sessionLabel, setSessionLabel] = useState("본 회차");
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: program } = useQuery({
    queryKey: ["admin_program", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("programs").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: applications = [] } = useQuery({
    queryKey: ["admin_program_apps", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_applications")
        .select("*")
        .eq("program_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["admin_program_att", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_attendance")
        .select("*")
        .eq("program_id", id!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const approved = useMemo(() => applications.filter((a: any) => a.status === "approved"), [applications]);

  const sessions = useMemo(() => {
    const set = new Map<string, { date: string; label: string }>();
    attendance.forEach((a: any) => {
      const key = `${a.session_date}|${a.session_label}`;
      set.set(key, { date: a.session_date, label: a.session_label });
    });
    return Array.from(set.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [attendance]);

  const attMap = useMemo(() => {
    const m = new Map<string, string>();
    attendance.forEach((a: any) => m.set(`${a.application_id}|${a.session_date}|${a.session_label}`, a.status));
    return m;
  }, [attendance]);

  const reviewMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("program_applications").update({
        status: reviewStatus,
        review_note: reviewNote || null,
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      }).eq("id", reviewTarget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "처리되었습니다" });
      setReviewTarget(null); setReviewNote("");
      qc.invalidateQueries({ queryKey: ["admin_program_apps", id] });
      qc.invalidateQueries({ queryKey: ["admin_program_app_counts"] });
    },
    onError: (e: any) => toast({ title: "처리 실패", description: e.message, variant: "destructive" }),
  });

  const addSessionMutation = useMutation({
    mutationFn: async () => {
      if (approved.length === 0) throw new Error("승인된 신청자가 없습니다.");
      const rows = approved.map((a: any) => ({
        program_id: id!,
        application_id: a.id,
        session_date: sessionDate,
        session_label: sessionLabel,
        status: "absent",
      }));
      const { error } = await supabase.from("program_attendance").upsert(rows, {
        onConflict: "application_id,session_date,session_label",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "회차가 추가되었습니다" });
      qc.invalidateQueries({ queryKey: ["admin_program_att", id] });
    },
    onError: (e: any) => toast({ title: "추가 실패", description: e.message, variant: "destructive" }),
  });

  const setAttendanceMutation = useMutation({
    mutationFn: async ({ application_id, session_date, session_label, status }: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("program_attendance").upsert({
        program_id: id!,
        application_id,
        session_date,
        session_label,
        status,
        checked_in_at: status === "present" || status === "late" ? new Date().toISOString() : null,
        checked_by: user?.id ?? null,
      }, { onConflict: "application_id,session_date,session_label" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_program_att", id] }),
    onError: (e: any) => toast({ title: "저장 실패", description: e.message, variant: "destructive" }),
  });

  const exportCsv = () => {
    const headers = ["status", "applicant_name", "applicant_email", "applicant_phone", "created_at", "review_note", "answers"];
    const rows = applications.map((a: any) => [
      APP_STATUS[a.status]?.label ?? a.status,
      a.applicant_name, a.applicant_email ?? "", a.applicant_phone ?? "",
      new Date(a.created_at).toLocaleString("ko-KR"), a.review_note ?? "",
      JSON.stringify(a.answers ?? {}),
    ]);
    const csv = "\ufeff" + [headers, ...rows].map((r) =>
      r.map((v) => {
        const s = v == null ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(",")
    ).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${program?.title ?? "program"}-applications.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!program) {
    return <DashboardLayout><div className="text-sm text-muted-foreground">불러오는 중…</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/programs")} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> 프로그램 목록
          </Button>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <CalendarRange className="h-6 w-6 mt-0.5" />
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{program.title}</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                  {[program.category, program.location, program.manager_name].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            <Badge variant="outline">정원 {program.capacity ?? "∞"} · 승인 {approved.length} · 신청 {applications.length}</Badge>
          </div>
        </div>

        <Tabs defaultValue="apps">
          <TabsList>
            <TabsTrigger value="apps">신청자 ({applications.length})</TabsTrigger>
            <TabsTrigger value="att">출석</TabsTrigger>
            <TabsTrigger value="info">개요</TabsTrigger>
          </TabsList>

          <TabsContent value="apps" className="space-y-3">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download className="h-4 w-4 mr-1.5" /> CSV 내보내기
              </Button>
            </div>
            <div className="border-2 border-border/60 rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[90px]">상태</TableHead>
                    <TableHead>신청자</TableHead>
                    <TableHead>연락처</TableHead>
                    <TableHead className="w-[140px]">신청일시</TableHead>
                    <TableHead className="w-[180px] text-right">처리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">아직 신청자가 없습니다.</TableCell></TableRow>
                  )}
                  {applications.map((a: any) => (
                    <TableRow key={a.id} className="border-b-2 border-border/60">
                      <TableCell><Badge variant={APP_STATUS[a.status]?.variant ?? "outline"}>{APP_STATUS[a.status]?.label ?? a.status}</Badge></TableCell>
                      <TableCell>
                        <div className="font-medium">{a.applicant_name}</div>
                        {Object.keys(a.answers ?? {}).length > 0 && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {Object.entries(a.answers).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div>{a.applicant_email ?? "—"}</div>
                        <div>{a.applicant_phone ?? "—"}</div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("ko-KR")}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => { setReviewTarget(a); setReviewStatus("approved"); setReviewNote(a.review_note ?? ""); }}>
                          <CheckCircle2 className="h-4 w-4 mr-1" /> 승인
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setReviewTarget(a); setReviewStatus("rejected"); setReviewNote(a.review_note ?? ""); }}>
                          <XCircle className="h-4 w-4 mr-1" /> 반려
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="att" className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-end gap-2 border-2 border-border/60 rounded-md p-3">
              <div className="flex-1 min-w-0">
                <Label className="text-xs text-muted-foreground">회차 일자</Label>
                <Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
              </div>
              <div className="flex-1 min-w-0">
                <Label className="text-xs text-muted-foreground">회차 명칭</Label>
                <Input value={sessionLabel} onChange={(e) => setSessionLabel(e.target.value)} placeholder="예: 1회차 오리엔테이션" />
              </div>
              <Button size="sm" onClick={() => addSessionMutation.mutate()} disabled={addSessionMutation.isPending || approved.length === 0}>
                <Plus className="h-4 w-4 mr-1" /> 회차 추가
              </Button>
            </div>

            {approved.length === 0 && (
              <p className="text-xs text-muted-foreground">승인된 신청자가 있어야 출석을 관리할 수 있습니다.</p>
            )}

            {sessions.length > 0 && (
              <div className="border-2 border-border/60 rounded-md overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">참가자</TableHead>
                      {sessions.map((s) => (
                        <TableHead key={`${s.date}|${s.label}`} className="text-center">
                          <div>{s.date}</div>
                          <div className="text-[10px] font-normal text-muted-foreground">{s.label}</div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approved.map((a: any) => (
                      <TableRow key={a.id} className="border-b-2 border-border/60">
                        <TableCell className="font-medium">{a.applicant_name}</TableCell>
                        {sessions.map((s) => {
                          const key = `${a.id}|${s.date}|${s.label}`;
                          const status = attMap.get(key) ?? "absent";
                          return (
                            <TableCell key={key} className="text-center">
                              <Select
                                value={status}
                                onValueChange={(v) => setAttendanceMutation.mutate({
                                  application_id: a.id,
                                  session_date: s.date,
                                  session_label: s.label,
                                  status: v,
                                })}
                              >
                                <SelectTrigger className="h-8 w-24 mx-auto"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {Object.entries(ATT_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="info" className="space-y-3 text-sm">
            <Info label="설명">{program.description || "—"}</Info>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-6">
              <Info label="카테고리">{program.category || "—"}</Info>
              <Info label="장소">{program.location || "—"}</Info>
              <Info label="정원">{program.capacity ?? "무제한"}</Info>
              <Info label="예산">{program.budget ? Number(program.budget).toLocaleString() + "원" : "—"}</Info>
              <Info label="기간">{fmtRange(program.starts_at, program.ends_at)}</Info>
              <Info label="모집기간">{fmtRange(program.apply_starts_at, program.apply_ends_at)}</Info>
              <Info label="담당자">{program.manager_name || "—"}</Info>
              <Info label="연락처">{program.contact || "—"}</Info>
              <Info label="공개">{program.is_public ? "공개" : "비공개"}</Info>
            </div>
          </TabsContent>
        </Tabs>

        {/* Review dialog */}
        <Dialog open={!!reviewTarget} onOpenChange={(o) => !o && setReviewTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>신청 처리 — {reviewTarget?.applicant_name}</DialogTitle>
              <DialogDescription>처리 결과와 메모를 입력하세요. 학생에게는 메모가 전달되지 않습니다.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">처리 결과</Label>
                <Select value={reviewStatus} onValueChange={setReviewStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">승인</SelectItem>
                    <SelectItem value="rejected">반려</SelectItem>
                    <SelectItem value="waitlisted">대기열</SelectItem>
                    <SelectItem value="pending">대기로 되돌리기</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">관리자 메모(내부용)</Label>
                <Textarea rows={3} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewTarget(null)}>취소</Button>
              <Button onClick={() => reviewMutation.mutate()} disabled={reviewMutation.isPending}>저장</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-muted-foreground uppercase">{label}</div>
      <div className="mt-0.5 whitespace-pre-wrap">{children}</div>
    </div>
  );
}

function fmtRange(a: string | null, b: string | null) {
  if (!a && !b) return "—";
  const f = (v: string | null) => (v ? new Date(v).toLocaleString("ko-KR") : "—");
  return `${f(a)} ~ ${f(b)}`;
}