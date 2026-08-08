import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Loader2, Check } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

const statusLabel: Record<string, string> = {
  active: "이용중",
  trialing: "체험중",
  canceled: "해지됨",
  paused: "일시정지",
  expired: "만료",
  past_due: "결제 실패",
};

const SubscriptionTab = () => {
  const { user } = useUser();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: subs = [] } = useQuery({
    queryKey: ["my-subscriptions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("*, subscription_plans(name, price, billing_period, billing_interval, benefits)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["my-subscription-invoices", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_invoices")
        .select("*")
        .eq("user_id", user!.id)
        .order("billing_date", { ascending: false })
        .limit(24);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const setCancelAtPeriodEnd = async (id: string, value: boolean) => {
    setBusyId(id);
    try {
      const { error } = await supabase
        .from("user_subscriptions")
        .update({
          cancel_at_period_end: value,
          canceled_at: value ? new Date().toISOString() : null,
          cancel_reason: value ? "사용자 해지 신청" : null,
        })
        .eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["my-subscriptions"] });
      toast({ title: value ? "해지 신청이 접수되었습니다" : "구독이 유지됩니다" });
    } catch (e: any) {
      toast({ title: "오류", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">구독 멤버십</h2>
        <p className="text-sm text-muted-foreground">이용중인 멤버십과 결제 내역을 관리합니다.</p>
      </div>

      {subs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="h-14 w-14 rounded-full bg-accent flex items-center justify-center">
            <CreditCard className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">이용중인 멤버십이 없습니다.</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/store/subscriptions")}>멤버십 둘러보기</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {subs.map((s: any) => {
            const plan = s.subscription_plans || {};
            const benefits: string[] = Array.isArray(plan.benefits) ? plan.benefits : [];
            const active = s.status === "active" || s.status === "trialing";
            return (
              <Card key={s.id} className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-foreground">{plan.name || "멤버십"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(plan.price ?? 0).toLocaleString()}원 / {plan.billing_interval || 1}
                      {plan.billing_period === "year" ? "년" : "개월"}
                    </p>
                  </div>
                  <Badge variant={active ? "default" : "secondary"} className="shrink-0 whitespace-nowrap">
                    {statusLabel[s.status] || s.status}
                  </Badge>
                </div>

                {benefits.length > 0 && (
                  <ul className="space-y-1">
                    {benefits.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" /> <span>{String(b)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground pt-3 border-t border-border">
                  <div>
                    <p>현재 이용기간</p>
                    <p className="text-foreground mt-0.5">
                      {new Date(s.current_period_start).toLocaleDateString("ko-KR")} ~ {new Date(s.current_period_end).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                  <div>
                    <p>다음 결제일</p>
                    <p className="text-foreground mt-0.5">
                      {s.cancel_at_period_end ? "해지 예정 (자동결제 없음)" : s.next_billing_at ? new Date(s.next_billing_at).toLocaleDateString("ko-KR") : "-"}
                    </p>
                  </div>
                </div>

                {active && (
                  <div className="flex justify-end">
                    {s.cancel_at_period_end ? (
                      <Button size="sm" variant="outline" className="rounded-lg" disabled={busyId === s.id} onClick={() => setCancelAtPeriodEnd(s.id, false)}>
                        {busyId === s.id && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />} 해지 취소
                      </Button>
                    ) : (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="rounded-lg text-destructive">구독 해지</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>구독을 해지하시겠어요?</AlertDialogTitle>
                            <AlertDialogDescription>
                              현재 이용기간({new Date(s.current_period_end).toLocaleDateString("ko-KR")})까지는 그대로 이용하실 수 있으며, 이후 자동결제가 중단됩니다.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>돌아가기</AlertDialogCancel>
                            <AlertDialogAction onClick={() => setCancelAtPeriodEnd(s.id, true)}>해지 신청</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {invoices.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">결제 내역</h3>
          <div className="divide-y divide-border border-t border-b border-border/80">
            {invoices.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{inv.cycle_no}회차</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(inv.billing_date).toLocaleDateString("ko-KR")}
                    {inv.failure_reason ? ` · ${inv.failure_reason}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-foreground">{(inv.amount ?? 0).toLocaleString()}원</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{inv.status === "paid" ? "결제 완료" : inv.status === "failed" ? "결제 실패" : inv.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionTab;
