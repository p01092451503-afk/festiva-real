import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";

const statusLabel: Record<string, string> = {
  pending: "접수됨",
  approved: "승인",
  rejected: "반려",
  completed: "환불 완료",
};

interface RefundTarget {
  orderId: string;
  courseId: string;
  courseTitle: string;
  paidAmount: number;
  elapsedDays: number;
  progressPercent: number;
}

const RefundsTab = () => {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<RefundTarget | null>(null);
  const [reason, setReason] = useState("");
  const [calc, setCalc] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: orders = [] } = useQuery({
    queryKey: ["my-refundable-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, paid_at, created_at, final_amount, order_items(id, course_id, price_at_purchase, courses(title))")
        .eq("user_id", user!.id)
        .in("status", ["paid", "completed"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["my-enrollments-progress", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("course_id, progress")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["my-refund-requests", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("refund_requests")
        .select("*, courses(title)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const requestedCourseIds = useMemo(
    () => new Set(requests.filter((r: any) => r.status !== "rejected").map((r: any) => r.course_id)),
    [requests],
  );

  const progressByCourse = useMemo(() => {
    const m = new Map<string, number>();
    enrollments.forEach((e: any) => m.set(e.course_id, Number(e.progress || 0)));
    return m;
  }, [enrollments]);

  const openRefund = async (order: any, item: any) => {
    const base = order.paid_at || order.created_at;
    const elapsedDays = Math.max(0, Math.floor((Date.now() - new Date(base).getTime()) / 86400000));
    const t: RefundTarget = {
      orderId: order.id,
      courseId: item.course_id,
      courseTitle: item.courses?.title || "-",
      paidAmount: item.price_at_purchase || 0,
      elapsedDays,
      progressPercent: progressByCourse.get(item.course_id) ?? 0,
    };
    setTarget(t);
    setReason("");
    setCalc(null);
    setIsCalculating(true);
    try {
      const { data, error } = await supabase.rpc("calculate_refund_amount", {
        p_course_id: t.courseId,
        p_paid_amount: t.paidAmount,
        p_elapsed_days: t.elapsedDays,
        p_progress_percent: t.progressPercent,
      });
      if (error) throw error;
      setCalc(data);
    } catch (e: any) {
      toast({ title: "환불액 계산 실패", description: e.message, variant: "destructive" });
    } finally {
      setIsCalculating(false);
    }
  };

  const submit = async () => {
    if (!target || !user) return;
    setIsSubmitting(true);
    try {
      const refundPercent = Number(calc?.refund_percent ?? 100);
      const amount = Number(calc?.refund_amount ?? calc?.final_amount ?? target.paidAmount);
      const { error } = await supabase.from("refund_requests").insert({
        user_id: user.id,
        order_id: target.orderId,
        course_id: target.courseId,
        paid_amount: target.paidAmount,
        elapsed_days: target.elapsedDays,
        progress_percent: target.progressPercent,
        refund_percent: refundPercent,
        calculated_amount: amount,
        final_amount: amount,
        is_partial: refundPercent < 100,
        reason,
        status: "pending",
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["my-refund-requests"] });
      toast({ title: "환불 신청이 접수되었습니다", description: "관리자 검토 후 처리됩니다." });
      setTarget(null);
    } catch (e: any) {
      toast({ title: "신청 실패", description: e.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">환불 신청</h2>
        <p className="text-sm text-muted-foreground">결제한 강의의 환불을 신청하고 진행 상태를 확인할 수 있습니다.</p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">환불 가능한 결제</h3>
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="h-14 w-14 rounded-full bg-accent flex items-center justify-center">
              <RotateCcw className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">환불 가능한 결제 내역이 없습니다.</p>
          </div>
        ) : (
          orders.map((order: any) => (
            <Card key={order.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">{order.order_number}</p>
                <p className="text-xs text-muted-foreground">{new Date(order.paid_at || order.created_at).toLocaleDateString("ko-KR")}</p>
              </div>
              <div className="space-y-2">
                {(order.order_items || []).map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{item.courses?.title || "-"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {(item.price_at_purchase ?? 0).toLocaleString()}원 · 진도 {Math.round(progressByCourse.get(item.course_id) ?? 0)}%
                      </p>
                    </div>
                    {requestedCourseIds.has(item.course_id) ? (
                      <Badge variant="secondary" className="shrink-0 whitespace-nowrap">신청됨</Badge>
                    ) : (
                      <Button size="sm" variant="outline" className="rounded-lg shrink-0" onClick={() => openRefund(order, item)}>
                        환불 신청
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))
        )}
      </div>

      {requests.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">신청 내역</h3>
          <div className="divide-y divide-border border-t border-b border-border/80">
            {requests.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{r.courses?.title || "-"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(r.created_at).toLocaleDateString("ko-KR")} · 환불율 {r.refund_percent}%
                    {r.admin_note ? ` · ${r.admin_note}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-foreground">{(r.final_amount ?? 0).toLocaleString()}원</p>
                  <Badge variant={r.status === "completed" || r.status === "approved" ? "default" : "secondary"} className="mt-1 whitespace-nowrap">
                    {statusLabel[r.status] || r.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>환불 신청</DialogTitle></DialogHeader>
          {target && (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{target.courseTitle}</p>
                <p className="text-xs text-muted-foreground">
                  결제금액 {target.paidAmount.toLocaleString()}원 · 경과 {target.elapsedDays}일 · 진도 {Math.round(target.progressPercent)}%
                </p>
              </div>
              <div className="rounded-xl bg-secondary/50 p-4 space-y-1">
                {isCalculating ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> 환불 예상액 계산 중...</p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">환불 예상액 (환불율 {Number(calc?.refund_percent ?? 100)}%)</p>
                    <p className="text-xl font-bold text-foreground">
                      {Number(calc?.refund_amount ?? calc?.final_amount ?? target.paidAmount).toLocaleString()}원
                    </p>
                    {calc?.rule_name && <p className="text-xs text-muted-foreground">적용 규정: {calc.rule_name}</p>}
                    <p className="text-[11px] text-muted-foreground pt-1">실제 환불액은 관리자 검토 후 확정됩니다.</p>
                  </>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-sm text-foreground">환불 사유</p>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="환불 사유를 입력해 주세요." rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>취소</Button>
            <Button onClick={submit} disabled={isSubmitting || isCalculating || !reason.trim()}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}환불 신청
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RefundsTab;
