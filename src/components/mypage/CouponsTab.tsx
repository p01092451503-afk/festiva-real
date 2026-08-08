import { useQuery } from "@tanstack/react-query";
import { Ticket } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";

const statusLabel: Record<string, string> = {
  issued: "사용 가능",
  available: "사용 가능",
  used: "사용 완료",
  expired: "기간 만료",
};

const CouponsTab = () => {
  const { user } = useUser();

  const { data: coupons = [] } = useQuery({
    queryKey: ["my-coupons", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_coupons")
        .select("*, coupons(name, code, discount_type, discount_value, min_order_amount, max_discount_amount)")
        .eq("user_id", user!.id)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const isUsable = (c: any) =>
    (c.status === "issued" || c.status === "available") &&
    (!c.expires_at || new Date(c.expires_at).getTime() > Date.now());

  const usable = coupons.filter(isUsable);
  const others = coupons.filter((c: any) => !isUsable(c));

  const renderCoupon = (c: any, dim = false) => {
    const co = c.coupons || {};
    const value = co.discount_type === "percentage" ? `${co.discount_value}%` : `${(co.discount_value ?? 0).toLocaleString()}원`;
    return (
      <Card key={c.id} className={`p-4 flex items-center justify-between gap-4 ${dim ? "opacity-60" : ""}`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold text-foreground">{value}</span>
            <code className="text-[11px] font-mono bg-secondary px-2 py-0.5 rounded">{co.code}</code>
          </div>
          <p className="text-sm text-foreground mt-1 truncate">{co.name || "쿠폰"}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {co.min_order_amount ? `${co.min_order_amount.toLocaleString()}원 이상 사용 · ` : ""}
            {c.expires_at ? `${new Date(c.expires_at).toLocaleDateString("ko-KR")}까지` : "기한 없음"}
          </p>
        </div>
        <Badge variant={dim ? "secondary" : "default"} className="shrink-0 whitespace-nowrap">
          {statusLabel[c.status] || c.status}
        </Badge>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">쿠폰함</h2>
        <p className="text-sm text-muted-foreground">보유한 할인 쿠폰을 확인하고 결제 시 사용할 수 있습니다.</p>
      </div>

      {coupons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="h-14 w-14 rounded-full bg-accent flex items-center justify-center">
            <Ticket className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">보유한 쿠폰이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {usable.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">사용 가능 {usable.length}장</h3>
              {usable.map((c: any) => renderCoupon(c))}
            </div>
          )}
          {others.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">사용·만료 {others.length}장</h3>
              {others.map((c: any) => renderCoupon(c, true))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CouponsTab;
