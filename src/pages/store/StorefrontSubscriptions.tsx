import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CreditCard, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import StorefrontHeader from "@/components/StorefrontHeader";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const won = (n: number) => `${(n || 0).toLocaleString("ko-KR")}원`;
const periodLabel = (p: string, i: number) => {
  const unit = p === "year" ? "년" : p === "week" ? "주" : "개월";
  return i > 1 ? `${i}${unit}` : `1${unit}`;
};

const StorefrontSubscriptions = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["subscription-plans-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: mySub } = useQuery({
    queryKey: ["my-subscription", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", user!.id)
        .in("status", ["active", "trialing"])
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const subscribe = async (plan: any) => {
    if (!user) {
      toast.error("로그인이 필요합니다.");
      navigate("/auth");
      return;
    }
    if (mySub) {
      toast.error("이미 이용 중인 구독이 있습니다. 마이페이지에서 관리하세요.");
      return;
    }
    setBusy(plan.id);
    try {
      const interval = plan.billing_interval || 1;
      const now = new Date();
      const end = new Date(now);
      if (plan.billing_period === "year") end.setFullYear(end.getFullYear() + interval);
      else if (plan.billing_period === "week") end.setDate(end.getDate() + 7 * interval);
      else end.setMonth(end.getMonth() + interval);

      const trial = plan.trial_days || 0;
      const { error } = await supabase.from("user_subscriptions").insert({
        user_id: user.id,
        plan_id: plan.id,
        status: trial > 0 ? "trialing" : "active",
        started_at: now.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: end.toISOString(),
        next_billing_at: (trial > 0
          ? new Date(now.getTime() + trial * 86400000)
          : end).toISOString(),
      });
      if (error) throw error;
      toast.success(trial > 0 ? `${trial}일 무료 체험이 시작되었습니다.` : "구독이 시작되었습니다.");
      qc.invalidateQueries({ queryKey: ["my-subscription"] });
    } catch (e: any) {
      toast.error(e.message || "구독 신청에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <StorefrontHeader />
      <main className="max-w-5xl mx-auto px-4 py-10">
        <header className="mb-8">
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> 구독 멤버십
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            정기 구독으로 포함된 강의를 기간 내내 무제한으로 수강하세요.
          </p>
        </header>

        {mySub && (
          <div className="mb-6 rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">현재 이용 중인 구독이 있습니다.</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                이용 종료일 {new Date(mySub.current_period_end).toLocaleDateString("ko-KR")}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/student/orders")}>
              구독 관리
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-80 rounded-xl" />)}
          </div>
        ) : plans.length === 0 ? (
          <div className="py-24 text-center text-sm text-muted-foreground">준비 중인 요금제가 없습니다.</div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-3">
            {plans.map((plan: any, idx: number) => {
              const benefits: string[] = Array.isArray(plan.benefits) ? plan.benefits : [];
              const featured = idx === 1;
              return (
                <section
                  key={plan.id}
                  className={`rounded-xl border p-6 flex flex-col min-w-0 ${featured ? "border-primary shadow-sm" : ""}`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold">{plan.name}</h2>
                    {featured && <Badge className="whitespace-nowrap">추천</Badge>}
                    {plan.trial_days > 0 && (
                      <Badge variant="secondary" className="whitespace-nowrap">{plan.trial_days}일 무료</Badge>
                    )}
                  </div>
                  {plan.description && (
                    <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                  )}
                  <p className="mt-4 text-2xl font-semibold">
                    {won(plan.price)}
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}/ {periodLabel(plan.billing_period, plan.billing_interval || 1)}
                    </span>
                  </p>
                  <ul className="mt-4 space-y-2 text-sm flex-1">
                    {benefits.map((b, i) => (
                      <li key={i} className="flex gap-2">
                        <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                        <span className="min-w-0">{String(b)}</span>
                      </li>
                    ))}
                    {(plan.included_course_ids?.length || 0) > 0 && (
                      <li className="flex gap-2">
                        <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                        <span>포함 강의 {plan.included_course_ids.length}개 무제한 수강</span>
                      </li>
                    )}
                  </ul>
                  <Button
                    className="mt-6 gap-1.5"
                    disabled={busy === plan.id || !!mySub}
                    onClick={() => subscribe(plan)}
                  >
                    <CreditCard className="h-4 w-4" />
                    {mySub ? "구독 중" : busy === plan.id ? "처리 중..." : plan.trial_days > 0 ? "무료로 시작하기" : "구독하기"}
                  </Button>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default StorefrontSubscriptions;
