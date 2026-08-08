import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Plus, Pencil, Trash2, FileSpreadsheet, CreditCard } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

const PERIODS: Record<string, string> = { monthly: "월간", yearly: "연간", weekly: "주간" };
const SUB_STATUS: Record<string, string> = {
  active: "이용중",
  canceled: "해지",
  paused: "일시정지",
  expired: "만료",
};
const INVOICE_STATUS: Record<string, string> = {
  pending: "결제대기",
  paid: "결제완료",
  failed: "결제실패",
  refunded: "환불",
};

const emptyPlan = {
  id: "",
  name: "",
  description: "",
  price: 0,
  billing_period: "monthly",
  billing_interval: 1,
  trial_days: 0,
  benefits: "",
  is_active: true,
  display_order: 0,
};

const won = (n: number) => `${(n || 0).toLocaleString("ko-KR")}원`;
const fmtD = (v?: string | null) => (v ? new Date(v).toLocaleDateString("ko-KR") : "-");

/** 정기구독 관리: 구독 상품 · 구독 회원 · 회차 결제내역 */
const AdminSubscriptions = () => {
  const qc = useQueryClient();
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [planOpen, setPlanOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: plans = [] } = useQuery({
    queryKey: ["sub-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subscription_plans").select("*").order("display_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: subs = [] } = useQuery({
    queryKey: ["user-subs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("*, subscription_plans(name, price, billing_period)")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const ids = Array.from(new Set((data || []).map((s: any) => s.user_id)));
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("user_id, full_name, email").in("user_id", ids)
        : { data: [] as any[] };
      const pMap = new Map((profiles || []).map((p) => [p.user_id, p]));
      return (data || []).map((s: any) => ({
        ...s,
        userName: pMap.get(s.user_id)?.full_name || "-",
        userEmail: pMap.get(s.user_id)?.email || "-",
      }));
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["sub-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_invoices")
        .select("*")
        .order("billing_date", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });

  const filteredSubs = useMemo(
    () => (statusFilter === "all" ? subs : subs.filter((s: any) => s.status === statusFilter)),
    [subs, statusFilter],
  );

  const stats = useMemo(() => {
    const active = subs.filter((s: any) => s.status === "active");
    const mrr = active.reduce((sum: number, s: any) => {
      const p = s.subscription_plans;
      if (!p) return sum;
      return sum + (p.billing_period === "yearly" ? Math.round(p.price / 12) : p.price);
    }, 0);
    const failed = invoices.filter((i: any) => i.status === "failed").length;
    return { active: active.length, mrr, failed, total: subs.length };
  }, [subs, invoices]);

  const savePlan = async () => {
    if (!planForm.name.trim()) return toast.error("상품명을 입력하세요");
    const payload = {
      name: planForm.name.trim(),
      description: planForm.description || null,
      price: Number(planForm.price) || 0,
      billing_period: planForm.billing_period,
      billing_interval: Number(planForm.billing_interval) || 1,
      trial_days: Number(planForm.trial_days) || 0,
      benefits: planForm.benefits
        ? planForm.benefits.split("\n").map((b) => b.trim()).filter(Boolean)
        : [],
      is_active: planForm.is_active,
      display_order: Number(planForm.display_order) || 0,
    };
    const { error } = planForm.id
      ? await supabase.from("subscription_plans").update(payload).eq("id", planForm.id)
      : await supabase.from("subscription_plans").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("저장되었습니다");
    setPlanOpen(false);
    setPlanForm(emptyPlan);
    qc.invalidateQueries({ queryKey: ["sub-plans"] });
  };

  const removePlan = async (id: string) => {
    const { error } = await supabase.from("subscription_plans").delete().eq("id", id);
    if (error) return toast.error("이용중인 구독이 있어 삭제할 수 없습니다");
    toast.success("삭제되었습니다");
    qc.invalidateQueries({ queryKey: ["sub-plans"] });
  };

  const changeSubStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === "canceled") patch.canceled_at = new Date().toISOString();
    const { error } = await supabase.from("user_subscriptions").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("변경되었습니다");
    qc.invalidateQueries({ queryKey: ["user-subs"] });
  };

  const retryInvoice = async (inv: any) => {
    const { error } = await supabase
      .from("subscription_invoices")
      .update({ status: "pending", retry_count: (inv.retry_count || 0) + 1, failure_reason: null })
      .eq("id", inv.id);
    if (error) return toast.error(error.message);
    toast.success("재청구 대기로 변경했습니다");
    qc.invalidateQueries({ queryKey: ["sub-invoices"] });
  };

  const exportSubs = () => {
    const rows = filteredSubs.map((s: any) => ({
      회원: s.userName,
      이메일: s.userEmail,
      구독상품: s.subscription_plans?.name || "-",
      상태: SUB_STATUS[s.status] || s.status,
      시작일: fmtD(s.started_at),
      현재주기종료: fmtD(s.current_period_end),
      다음결제일: fmtD(s.next_billing_at),
      해지예약: s.cancel_at_period_end ? "예" : "아니오",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "구독회원");
    XLSX.writeFile(wb, `구독회원_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <RefreshCw className="h-5 w-5" /> 정기구독 관리
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            구독 상품과 회원 구독 상태, 회차별 결제내역을 관리합니다.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "이용중 구독", value: `${stats.active}명` },
            { label: "월 환산 매출(MRR)", value: won(stats.mrr) },
            { label: "결제 실패", value: `${stats.failed}건` },
            { label: "전체 구독", value: `${stats.total}건` },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-lg font-semibold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="plans">
          <TabsList>
            <TabsTrigger value="plans">구독 상품</TabsTrigger>
            <TabsTrigger value="members">구독 회원</TabsTrigger>
            <TabsTrigger value="invoices">결제 내역</TabsTrigger>
          </TabsList>

          <TabsContent value="plans" className="mt-4 space-y-3">
            <div className="flex justify-end">
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setPlanForm(emptyPlan);
                  setPlanOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> 구독 상품 추가
              </Button>
            </div>
            <div className="rounded-xl border divide-y">
              {plans.length === 0 && (
                <p className="p-6 text-sm text-muted-foreground text-center">등록된 구독 상품이 없습니다.</p>
              )}
              {plans.map((p: any) => (
                <div key={p.id} className="p-4 flex items-start justify-between gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{p.name}</span>
                      <Badge variant={p.is_active ? "default" : "secondary"} className="whitespace-nowrap">
                        {p.is_active ? "판매중" : "중지"}
                      </Badge>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {won(p.price)} / {PERIODS[p.billing_period] || p.billing_period}
                        {p.billing_interval > 1 ? ` ×${p.billing_interval}` : ""}
                      </span>
                      {p.trial_days > 0 && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          무료체험 {p.trial_days}일
                        </span>
                      )}
                    </div>
                    {p.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                    )}
                    {Array.isArray(p.benefits) && p.benefits.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">혜택: {p.benefits.join(" · ")}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setPlanForm({
                          id: p.id,
                          name: p.name,
                          description: p.description || "",
                          price: p.price,
                          billing_period: p.billing_period,
                          billing_interval: p.billing_interval,
                          trial_days: p.trial_days,
                          benefits: Array.isArray(p.benefits) ? p.benefits.join("\n") : "",
                          is_active: p.is_active,
                          display_order: p.display_order,
                        }) || setPlanOpen(true)
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removePlan(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="members" className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 상태</SelectItem>
                  {Object.entries(SUB_STATUS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportSubs}>
                <FileSpreadsheet className="h-4 w-4" /> 엑셀 다운로드
              </Button>
            </div>
            <div className="rounded-xl border divide-y">
              {filteredSubs.length === 0 && (
                <p className="p-6 text-sm text-muted-foreground text-center">구독 회원이 없습니다.</p>
              )}
              {filteredSubs.map((s: any) => (
                <div key={s.id} className="p-4 flex flex-wrap items-center justify-between gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {s.userName} <span className="text-xs text-muted-foreground">{s.userEmail}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {s.subscription_plans?.name || "-"} · {fmtD(s.current_period_start)} ~ {fmtD(s.current_period_end)}
                      {s.cancel_at_period_end ? " · 기간말 해지예약" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={s.status === "active" ? "default" : "secondary"} className="whitespace-nowrap">
                      {SUB_STATUS[s.status] || s.status}
                    </Badge>
                    <Select value={s.status} onValueChange={(v) => changeSubStatus(s.id, v)}>
                      <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(SUB_STATUS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="invoices" className="mt-4">
            <div className="rounded-xl border divide-y">
              {invoices.length === 0 && (
                <p className="p-6 text-sm text-muted-foreground text-center">결제 내역이 없습니다.</p>
              )}
              {invoices.map((i: any) => (
                <div key={i.id} className="p-4 flex flex-wrap items-center justify-between gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {i.cycle_no}회차 · {won(i.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      청구일 {fmtD(i.billing_date)}
                      {i.paid_at ? ` · 결제 ${fmtD(i.paid_at)}` : ""}
                      {i.failure_reason ? ` · ${i.failure_reason}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={i.status === "paid" ? "default" : i.status === "failed" ? "destructive" : "secondary"}
                      className="whitespace-nowrap"
                    >
                      {INVOICE_STATUS[i.status] || i.status}
                    </Badge>
                    {i.status === "failed" && (
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => retryInvoice(i)}>
                        <CreditCard className="h-3.5 w-3.5" /> 재청구
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{planForm.id ? "구독 상품 수정" : "구독 상품 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>상품명</Label>
              <Input value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>설명</Label>
              <Textarea rows={2} value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} className="mt-1" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>가격(원)</Label>
                <Input type="number" value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: Number(e.target.value) })} className="mt-1" />
              </div>
              <div>
                <Label>결제주기</Label>
                <Select value={planForm.billing_period} onValueChange={(v) => setPlanForm({ ...planForm, billing_period: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PERIODS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>무료체험(일)</Label>
                <Input type="number" value={planForm.trial_days} onChange={(e) => setPlanForm({ ...planForm, trial_days: Number(e.target.value) })} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>혜택 (줄바꿈으로 구분)</Label>
              <Textarea rows={3} value={planForm.benefits} onChange={(e) => setPlanForm({ ...planForm, benefits: e.target.value })} className="mt-1" placeholder={"전 강의 무제한 수강\n자료실 전체 이용"} />
            </div>
            <div className="flex items-center justify-between">
              <Label>판매중</Label>
              <Switch checked={planForm.is_active} onCheckedChange={(v) => setPlanForm({ ...planForm, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanOpen(false)}>취소</Button>
            <Button onClick={savePlan}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminSubscriptions;
