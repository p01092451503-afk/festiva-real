import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, Plus, Trash2, Check, Wallet } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { downloadCsv, todayStamp } from "@/lib/exportCsv";

const won = (n: number) => `${Number(n || 0).toLocaleString()}원`;
const fmtD = (v?: string | null) => (v ? new Date(v).toLocaleDateString("ko-KR") : "-");

const STATUS: Record<string, string> = { pending: "정산대기", approved: "승인", paid: "지급완료" };

/** 강사 정산: 기간별 매출 집계 → 배분율 적용 → 지급 상태 관리 */
const AdminSettlements = () => {
  const qc = useQueryClient();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    instructor_id: "",
    course_id: "",
    period_start: monthStart,
    period_end: today,
    gross_amount: "0",
    share_type: "percent",
    share_value: "70",
    memo: "",
  });

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

  /** 기간 내 결제완료 주문에서 해당 강사(또는 과정)의 매출을 합산 */
  const calcGross = () =>
    run(async () => {
      if (!form.instructor_id) throw new Error("강사를 먼저 선택하세요.");
      const targetCourseIds = form.course_id
        ? [form.course_id]
        : courses.filter((c) => c.instructor_id === form.instructor_id).map((c) => c.id);
      if (targetCourseIds.length === 0) throw new Error("해당 강사에게 배정된 과정이 없습니다.");

      const { data: paidOrders, error: oErr } = await supabase
        .from("orders")
        .select("id, paid_at, status")
        .eq("status", "paid")
        .gte("paid_at", `${form.period_start}T00:00:00`)
        .lte("paid_at", `${form.period_end}T23:59:59`);
      if (oErr) throw oErr;
      const orderIds = (paidOrders || []).map((o: any) => o.id);
      if (orderIds.length === 0) {
        setForm((f) => ({ ...f, gross_amount: "0" }));
        return;
      }
      const { data: items, error: iErr } = await supabase
        .from("order_items")
        .select("price_at_purchase, course_id, order_id")
        .in("order_id", orderIds)
        .in("course_id", targetCourseIds);
      if (iErr) throw iErr;
      const total = (items || []).reduce((s: number, it: any) => s + Number(it.price_at_purchase || 0), 0);
      setForm((f) => ({ ...f, gross_amount: String(total) }));
    }, "기간 매출을 집계했습니다.", []);

  const settleAmount = (() => {
    const gross = Number(form.gross_amount) || 0;
    return form.share_type === "percent"
      ? Math.round((gross * (Number(form.share_value) || 0)) / 100)
      : Number(form.share_value) || 0;
  })();

  const addSettlement = () =>
    run(async () => {
      if (!form.instructor_id) throw new Error("강사를 선택하세요.");
      const { error } = await supabase.from("instructor_settlements").insert({
        instructor_id: form.instructor_id,
        course_id: form.course_id || null,
        period_start: form.period_start,
        period_end: form.period_end,
        gross_amount: Number(form.gross_amount) || 0,
        share_type: form.share_type,
        share_value: Number(form.share_value) || 0,
        settle_amount: settleAmount,
        memo: form.memo.trim() || null,
      });
      if (error) throw error;
      setForm((f) => ({ ...f, gross_amount: "0", memo: "" }));
    }, "정산 건이 생성되었습니다.", ["instructor-settlements"]);

  const setStatus = (id: string, status: string) =>
    run(async () => {
      const { error } = await supabase
        .from("instructor_settlements")
        .update({ status, paid_at: status === "paid" ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    }, "상태가 변경되었습니다.", ["instructor-settlements"]);

  const remove = (id: string) =>
    run(async () => {
      const { error } = await supabase.from("instructor_settlements").delete().eq("id", id);
      if (error) throw error;
    }, "삭제되었습니다.", ["instructor-settlements"]);

  const exportCsv = () =>
    downloadCsv(`강사정산_${todayStamp()}`, settlements, [
      { header: "강사", value: (r: any) => instructorName(r.instructor_id) },
      { header: "과정", value: (r: any) => courseTitle(r.course_id) },
      { header: "정산기간", value: (r: any) => `${r.period_start} ~ ${r.period_end}` },
      { header: "매출", value: (r: any) => r.gross_amount },
      { header: "배분", value: (r: any) => (r.share_type === "percent" ? `${r.share_value}%` : `${r.share_value}원`) },
      { header: "정산금액", value: (r: any) => r.settle_amount },
      { header: "상태", value: (r: any) => STATUS[r.status] ?? r.status },
      { header: "지급일", value: (r: any) => fmtD(r.paid_at) },
    ]);

  const totalPending = settlements
    .filter((s) => s.status !== "paid")
    .reduce((sum, s) => sum + Number(s.settle_amount || 0), 0);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2">
              <Calculator className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
              강사 정산
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              기간별 매출을 집계해 배분율을 적용하고, 지급 상태를 관리합니다.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              미지급 합계 <strong className="text-foreground">{won(totalPending)}</strong>
            </span>
            <Button variant="outline" onClick={exportCsv}>엑셀 내보내기</Button>
          </div>
        </div>

        <div className="border rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium">새 정산 생성</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0">
              <Label className="text-xs">강사</Label>
              <Select value={form.instructor_id} onValueChange={(v) => setForm({ ...form, instructor_id: v })}>
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
              <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v })}>
                <SelectTrigger><SelectValue placeholder="전체 과정" /></SelectTrigger>
                <SelectContent>
                  {courses
                    .filter((c) => !form.instructor_id || c.instructor_id === form.instructor_id)
                    .map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <Label className="text-xs">시작일</Label>
              <Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} />
            </div>
            <div className="min-w-0">
              <Label className="text-xs">종료일</Label>
              <Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} />
            </div>
            <div className="min-w-0">
              <Label className="text-xs">기간 매출(원)</Label>
              <div className="flex gap-2">
                <Input type="number" value={form.gross_amount} onChange={(e) => setForm({ ...form, gross_amount: e.target.value })} />
                <Button variant="outline" onClick={calcGross} className="whitespace-nowrap">자동 집계</Button>
              </div>
            </div>
            <div className="min-w-0">
              <Label className="text-xs">배분 방식</Label>
              <Select value={form.share_type} onValueChange={(v) => setForm({ ...form, share_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">비율(%)</SelectItem>
                  <SelectItem value="fixed">직접입력(원)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <Label className="text-xs">배분값</Label>
              <Input type="number" value={form.share_value} onChange={(e) => setForm({ ...form, share_value: e.target.value })} />
            </div>
            <div className="min-w-0">
              <Label className="text-xs">메모</Label>
              <Input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              정산 예정액 <strong className="text-foreground">{won(settleAmount)}</strong>
            </span>
            <Button onClick={addSettlement}><Plus className="h-4 w-4 mr-1" />정산 생성</Button>
          </div>
        </div>

        <div className="border rounded-lg divide-y">
          {settlements.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">정산 내역이 없습니다.</p>
          )}
          {settlements.map((s) => (
            <div key={s.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 border-b-2 border-border/80 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="font-medium">{instructorName(s.instructor_id)}</span>
                  <Badge variant="secondary" className="whitespace-nowrap">{courseTitle(s.course_id)}</Badge>
                  <Badge variant={s.status === "paid" ? "default" : "outline"} className="whitespace-nowrap">
                    {STATUS[s.status] ?? s.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {s.period_start} ~ {s.period_end} · 매출 {won(s.gross_amount)} ·{" "}
                  {s.share_type === "percent" ? `${s.share_value}%` : won(s.share_value)} → 정산{" "}
                  <strong className="text-foreground">{won(s.settle_amount)}</strong>
                  {s.paid_at ? ` · 지급 ${fmtD(s.paid_at)}` : ""}
                </p>
                {s.memo && <p className="text-xs text-muted-foreground mt-1">{s.memo}</p>}
              </div>
              <div className="flex gap-2">
                {s.status === "pending" && (
                  <Button variant="outline" size="sm" onClick={() => setStatus(s.id, "approved")}>
                    <Check className="h-4 w-4 mr-1" />승인
                  </Button>
                )}
                {s.status !== "paid" && (
                  <Button size="sm" onClick={() => setStatus(s.id, "paid")}>지급완료</Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => remove(s.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminSettlements;
