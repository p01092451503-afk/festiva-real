import { useMemo, useState } from "react";
import { useTableSort, sortRows } from "@/hooks/useTableSort";
import TablePagination, { usePagination } from "@/components/table/TablePagination";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, Plus, Trash2, Check, Wallet, X, FileSpreadsheet, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { todayStamp } from "@/lib/exportCsv";

const won = (n: number) => `${Number(n || 0).toLocaleString()}원`;
const fmtD = (v?: string | null) => (v ? new Date(v).toLocaleDateString("ko-KR") : "-");

const STATUS: Record<string, string> = {
  pending: "정산대기",
  approved: "승인",
  rejected: "반려",
  paid: "지급완료",
};

type Calc = {
  gross: number;
  refund: number;
  net: number;
  orderCount: number;
  enrollmentCount: number;
};

const EMPTY_CALC: Calc = { gross: 0, refund: 0, net: 0, orderCount: 0, enrollmentCount: 0 };

/** 강사 정산: 기간별 매출·환불·수강 데이터 집계 → 배분율 적용 → 승인/반려/지급 관리 */
const AdminSettlements = () => {
  const qc = useQueryClient();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    instructor_id: "",
    course_id: "",
    period_start: monthStart,
    period_end: today,
    share_type: "percent",
    share_value: "70",
    memo: "",
  });
  const [calc, setCalc] = useState<Calc>(EMPTY_CALC);
  const [calculating, setCalculating] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: instructors = [] } = useQuery({
    queryKey: ["settlement-instructors"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "teacher");
      const ids = (roles || []).map((r: any) => r.user_id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", ids);
      return (data as any[]) || [];
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["settlement-courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, title, instructor_id").order("title");
      return (data as any[]) || [];
    },
  });

  const { data: settlements = [] } = useQuery({
    queryKey: ["instructor-settlements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instructor_settlements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const instructorName = (id: string) =>
    instructors.find((i) => i.user_id === id)?.full_name || instructors.find((i) => i.user_id === id)?.email || "-";
  const courseTitle = (id?: string | null) => (id ? courses.find((c) => c.id === id)?.title ?? "-" : "전체 과정");

  const run = (fn: () => Promise<any>, msg: string, keys: string[]) =>
    fn()
      .then(() => {
        toast.success(msg);
        keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      })
      .catch((e: any) => toast.error(e.message));

  const targetCourseIds = useMemo(
    () =>
      form.course_id
        ? [form.course_id]
        : courses.filter((c) => c.instructor_id === form.instructor_id).map((c) => c.id),
    [form.course_id, form.instructor_id, courses],
  );

  /** 기간 내 결제완료 매출 · 환불액 · 수강신청 건수를 집계 */
  const calcGross = async () => {
    if (!form.instructor_id) return toast.error("강사를 먼저 선택하세요.");
    if (targetCourseIds.length === 0) return toast.error("해당 강사에게 배정된 과정이 없습니다.");
    const from = `${form.period_start}T00:00:00`;
    const to = `${form.period_end}T23:59:59`;
    setCalculating(true);
    try {
      const { data: paidOrders, error: oErr } = await supabase
        .from("orders")
        .select("id")
        .eq("status", "paid")
        .gte("paid_at", from)
        .lte("paid_at", to);
      if (oErr) throw oErr;
      const orderIds = (paidOrders || []).map((o: any) => o.id);

      let gross = 0;
      let orderCount = 0;
      if (orderIds.length > 0) {
        const { data: items, error: iErr } = await supabase
          .from("order_items")
          .select("price_at_purchase, course_id, order_id")
          .in("order_id", orderIds)
          .in("course_id", targetCourseIds);
        if (iErr) throw iErr;
        gross = (items || []).reduce((s: number, it: any) => s + Number(it.price_at_purchase || 0), 0);
        orderCount = new Set((items || []).map((it: any) => it.order_id)).size;
      }

      const { data: refunds, error: rErr } = await supabase
        .from("refund_requests")
        .select("final_amount, course_id, status, processed_at")
        .in("course_id", targetCourseIds)
        .in("status", ["approved", "completed"])
        .gte("processed_at", from)
        .lte("processed_at", to);
      if (rErr) throw rErr;
      const refund = (refunds || []).reduce((s: number, r: any) => s + Number(r.final_amount || 0), 0);

      const { count: enrollmentCount, error: eErr } = await supabase
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .in("course_id", targetCourseIds)
        .gte("created_at", from)
        .lte("created_at", to);
      if (eErr) throw eErr;

      setCalc({
        gross,
        refund,
        net: Math.max(0, gross - refund),
        orderCount,
        enrollmentCount: enrollmentCount ?? 0,
      });
      toast.success("기간 매출·환불·수강 데이터를 집계했습니다.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCalculating(false);
    }
  };

  const settleAmount = useMemo(() => {
    if (form.share_type === "percent") return Math.round((calc.net * (Number(form.share_value) || 0)) / 100);
    return Number(form.share_value) || 0;
  }, [calc.net, form.share_type, form.share_value]);

  const addSettlement = () =>
    run(async () => {
      if (!form.instructor_id) throw new Error("강사를 선택하세요.");
      const { error } = await supabase.from("instructor_settlements").insert({
        instructor_id: form.instructor_id,
        course_id: form.course_id || null,
        period_start: form.period_start,
        period_end: form.period_end,
        gross_amount: calc.gross,
        refund_amount: calc.refund,
        order_count: calc.orderCount,
        enrollment_count: calc.enrollmentCount,
        share_type: form.share_type,
        share_value: Number(form.share_value) || 0,
        settle_amount: settleAmount,
        memo: form.memo.trim() || null,
      });
      if (error) throw error;
      setCalc(EMPTY_CALC);
      setForm((f) => ({ ...f, memo: "" }));
    }, "정산 건이 생성되었습니다.", ["instructor-settlements"]);

  const setStatus = (id: string, status: string, reason?: string) =>
    run(async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("instructor_settlements")
        .update({
          status,
          reject_reason: status === "rejected" ? reason ?? null : null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: auth?.user?.id ?? null,
          paid_at: status === "paid" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    }, "상태가 변경되었습니다.", ["instructor-settlements"]);

  const submitReject = () => {
    if (!rejectReason.trim()) return toast.error("반려 사유를 입력하세요.");
    setStatus(rejectTarget.id, "rejected", rejectReason.trim());
    setRejectTarget(null);
    setRejectReason("");
  };

  const remove = (id: string) =>
    run(async () => {
      const { error } = await supabase.from("instructor_settlements").delete().eq("id", id);
      if (error) throw error;
    }, "삭제되었습니다.", ["instructor-settlements"]);

  const filtered = useMemo(
    () => (statusFilter === "all" ? settlements : settlements.filter((s) => s.status === statusFilter)),
    [settlements, statusFilter],
  );

  // 정렬 + 페이지 나눔
  const { sort, toggleSort } = useTableSort({ defaultKey: "period_start", defaultDir: "desc" });
  const sorted = useMemo(
    () =>
      sortRows(filtered, sort, {
        instructor: (s: any) => instructorName(s.instructor_id) || "",
        course: (s: any) => courseTitle(s.course_id) || "",
        period_start: (s: any) => s.period_start || "",
        settle_amount: (s: any) => Number(s.settle_amount || 0),
        status: (s: any) => s.status || "",
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, sort],
  );
  const { page, setPage, pageSize, setPageSize, total, totalPages, pageRows } = usePagination(sorted, 20);


  /** 엑셀(.xlsx) 다운로드 */
  const exportExcel = () => {
    if (filtered.length === 0) return toast.error("내보낼 정산 내역이 없습니다.");
    const rows = filtered.map((s) => ({
      강사: instructorName(s.instructor_id),
      과정: courseTitle(s.course_id),
      정산기간: `${s.period_start} ~ ${s.period_end}`,
      "매출(원)": Number(s.gross_amount || 0),
      "환불(원)": Number(s.refund_amount || 0),
      "순매출(원)": Number(s.gross_amount || 0) - Number(s.refund_amount || 0),
      결제건수: Number(s.order_count || 0),
      수강건수: Number(s.enrollment_count || 0),
      배분: s.share_type === "percent" ? `${s.share_value}%` : `${Number(s.share_value).toLocaleString()}원`,
      "정산금액(원)": Number(s.settle_amount || 0),
      상태: STATUS[s.status] ?? s.status,
      반려사유: s.reject_reason ?? "",
      지급일: s.paid_at ? fmtD(s.paid_at) : "",
      메모: s.memo ?? "",
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = Object.keys(rows[0]).map((k) => ({ wch: Math.max(10, k.length + 4) }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "강사정산");
    XLSX.writeFile(book, `강사정산_${todayStamp()}.xlsx`);
    toast.success("엑셀 파일을 다운로드했습니다.");
  };

  const totalPending = settlements
    .filter((s) => s.status === "pending" || s.status === "approved")
    .reduce((sum, s) => sum + Number(s.settle_amount || 0), 0);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2">
              <Calculator className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
              강사 정산
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              기간별 매출·환불·수강 데이터를 집계해 배분율을 적용하고, 승인·반려 및 지급을 관리합니다.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              미지급 합계 <strong className="text-foreground">{won(totalPending)}</strong>
            </span>
            <Button variant="outline" onClick={exportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              엑셀 다운로드
            </Button>
          </div>
        </div>

        <div className="border rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium">새 정산 생성</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0">
              <Label className="text-xs">강사</Label>
              <Select
                value={form.instructor_id}
                onValueChange={(v) => {
                  setForm({ ...form, instructor_id: v, course_id: "" });
                  setCalc(EMPTY_CALC);
                }}
              >
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {instructors.map((i) => (
                    <SelectItem key={i.user_id} value={i.user_id}>{i.full_name || i.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <Label className="text-xs">과정(선택)</Label>
              <Select
                value={form.course_id || "all"}
                onValueChange={(v) => {
                  setForm({ ...form, course_id: v === "all" ? "" : v });
                  setCalc(EMPTY_CALC);
                }}
              >
                <SelectTrigger><SelectValue placeholder="전체 과정" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 과정</SelectItem>
                  {courses
                    .filter((c) => !form.instructor_id || c.instructor_id === form.instructor_id)
                    .map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <Label className="text-xs">시작일</Label>
              <Input type="date" value={form.period_start} onChange={(e) => { setForm({ ...form, period_start: e.target.value }); setCalc(EMPTY_CALC); }} />
            </div>
            <div className="min-w-0">
              <Label className="text-xs">종료일</Label>
              <Input type="date" value={form.period_end} onChange={(e) => { setForm({ ...form, period_end: e.target.value }); setCalc(EMPTY_CALC); }} />
            </div>
            <div className="min-w-0">
              <Label className="text-xs">배분 방식</Label>
              <Select value={form.share_type} onValueChange={(v) => setForm({ ...form, share_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">순매출 비율(%)</SelectItem>
                  <SelectItem value="fixed">직접입력(원)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <Label className="text-xs">배분값</Label>
              <Input type="number" value={form.share_value} onChange={(e) => setForm({ ...form, share_value: e.target.value })} />
            </div>
            <div className="min-w-0 sm:col-span-2">
              <Label className="text-xs">메모</Label>
              <Input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={calcGross} disabled={calculating}>
              <RefreshCw className={`h-4 w-4 mr-1 ${calculating ? "animate-spin" : ""}`} aria-hidden="true" />
              데이터 집계
            </Button>
            <Button onClick={addSettlement} disabled={calc.gross === 0 && calc.enrollmentCount === 0}>
              <Plus className="h-4 w-4 mr-1" />정산 생성
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6 border-t pt-3">
            {[
              ["매출", won(calc.gross)],
              ["환불", won(calc.refund)],
              ["순매출", won(calc.net)],
              ["결제건수", `${calc.orderCount}건`],
              ["수강신청", `${calc.enrollmentCount}건`],
              ["정산 예정액", won(settleAmount)],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-semibold text-foreground truncate">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-xs whitespace-nowrap">상태 필터</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{filtered.length}건</span>
        </div>

        <div className="border rounded-lg divide-y">
          {filtered.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">정산 내역이 없습니다.</p>
          )}
          {filtered.map((s) => (
            <div key={s.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 border-b-2 border-border/80 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="font-medium">{instructorName(s.instructor_id)}</span>
                  <Badge variant="secondary" className="whitespace-nowrap">{courseTitle(s.course_id)}</Badge>
                  <Badge
                    variant={s.status === "paid" ? "default" : s.status === "rejected" ? "destructive" : "outline"}
                    className="whitespace-nowrap"
                  >
                    {STATUS[s.status] ?? s.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {s.period_start} ~ {s.period_end} · 매출 {won(s.gross_amount)}
                  {Number(s.refund_amount) > 0 ? ` · 환불 ${won(s.refund_amount)}` : ""} · 결제 {s.order_count ?? 0}건 · 수강{" "}
                  {s.enrollment_count ?? 0}건 ·{" "}
                  {s.share_type === "percent" ? `${s.share_value}%` : won(s.share_value)} → 정산{" "}
                  <strong className="text-foreground">{won(s.settle_amount)}</strong>
                  {s.paid_at ? ` · 지급 ${fmtD(s.paid_at)}` : ""}
                </p>
                {s.reject_reason && <p className="text-xs text-destructive mt-1">반려 사유: {s.reject_reason}</p>}
                {s.memo && <p className="text-xs text-muted-foreground mt-1">{s.memo}</p>}
              </div>
              <div className="flex gap-2 flex-wrap">
                {(s.status === "pending" || s.status === "rejected") && (
                  <Button variant="outline" size="sm" onClick={() => setStatus(s.id, "approved")}>
                    <Check className="h-4 w-4 mr-1" />승인
                  </Button>
                )}
                {s.status !== "paid" && s.status !== "rejected" && (
                  <Button variant="outline" size="sm" onClick={() => { setRejectTarget(s); setRejectReason(""); }}>
                    <X className="h-4 w-4 mr-1" />반려
                  </Button>
                )}
                {s.status === "approved" && (
                  <Button size="sm" onClick={() => setStatus(s.id, "paid")}>지급완료</Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => remove(s.id)} aria-label="삭제">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>정산 반려</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">반려 사유</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="예) 환불 건 반영 후 재정산 필요"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>취소</Button>
            <Button variant="destructive" onClick={submitReject}>반려 처리</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminSettlements;
