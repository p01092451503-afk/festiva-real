import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, BellOff, CalendarDays, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { SALE_STATUS_META, saleStatusClass, saleStatusLabel, type SaleStatus } from "@/lib/statusMeta";
import { cn } from "@/lib/utils";

export interface SaleStatusInfo {
  sale_status?: string | null;
  open_scheduled_at?: string | null;
  apply_start_at?: string | null;
  apply_end_at?: string | null;
  operation_start_at?: string | null;
}

export const normalizeSaleStatus = (v?: string | null): SaleStatus =>
  (["open_alert", "presale", "on_sale", "closed", "sold_out"].includes(v || "")
    ? (v as SaleStatus)
    : "on_sale");

/** 신청(구매) 버튼을 눌러도 되는 상태인지 */
export const isPurchasable = (v?: string | null) => {
  const s = normalizeSaleStatus(v);
  return s === "on_sale" || s === "presale";
};

/** 상태별 주 버튼 문구 */
export const saleCtaLabel = (v?: string | null, isFree = false) => {
  switch (normalizeSaleStatus(v)) {
    case "open_alert":
      return "오픈알림 신청";
    case "presale":
      return "사전신청";
    case "closed":
      return "신청마감";
    case "sold_out":
      return "품절";
    default:
      return isFree ? "무료로 시작하기" : "신청하기";
  }
};

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }) : "-";

export const SaleStatusBadge = ({ status, className }: { status?: string | null; className?: string }) => {
  const s = normalizeSaleStatus(status);
  if (s === "on_sale") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        saleStatusClass(s),
        className,
      )}
    >
      {saleStatusLabel(s)}
    </span>
  );
};

interface SaleStatusCtaProps {
  courseId?: string;
  productId?: string;
  info: SaleStatusInfo;
  /** 판매 가능 상태일 때 보여줄 기본 CTA */
  children: React.ReactNode;
  className?: string;
}

/**
 * 상품 5가지 판매 상태(오픈알림·사전신청·신청하기·신청마감·품절)를
 * 고객 화면에서 그대로 반영하는 CTA 영역.
 */
const SaleStatusCta = ({ courseId, productId, info, children, className }: SaleStatusCtaProps) => {
  const status = normalizeSaleStatus(info.sale_status);
  const { user } = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const key = ["open-alert", courseId ?? productId ?? "none", user?.id ?? "anon"];

  const { data: alertState } = useQuery({
    queryKey: key,
    enabled: status === "open_alert" && !!(courseId || productId),
    queryFn: async () => {
      const { data: total } = await supabase.rpc("open_alert_count", {
        _course_id: courseId ?? null,
        _product_id: productId ?? null,
      });
      let mine = false;
      if (user) {
        const q = supabase.from("product_open_alerts").select("id").eq("user_id", user.id).limit(1);
        const { data } = courseId ? await q.eq("course_id", courseId) : await q.eq("product_id", productId!);
        mine = (data?.length ?? 0) > 0;
      }
      return { total: (total as number | null) ?? 0, mine };
    },
  });

  const toggleAlert = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("NO_AUTH");
      if (alertState?.mine) {
        const q = supabase.from("product_open_alerts").delete().eq("user_id", user.id);
        const { error } = courseId ? await q.eq("course_id", courseId) : await q.eq("product_id", productId!);
        if (error) throw error;
        return "off" as const;
      }
      const { error } = await supabase.from("product_open_alerts").insert({
        user_id: user.id,
        course_id: courseId ?? null,
        product_id: productId ?? null,
        contact_email: user.email ?? null,
      });
      if (error) throw error;
      return "on" as const;
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: key });
      toast.success(r === "on" ? "오픈알림을 신청했습니다. 오픈 시 안내드릴게요." : "오픈알림 신청을 취소했습니다.");
    },
    onError: (e: any) => {
      if (e?.message === "NO_AUTH") {
        toast.error("로그인이 필요합니다");
        navigate("/auth");
        return;
      }
      toast.error("처리에 실패했습니다");
    },
  });

  const schedule = useMemo(
    () =>
      [
        { label: "오픈 예정일", value: info.open_scheduled_at },
        { label: "수강 신청일", value: info.apply_start_at },
        { label: "운영 시작", value: info.operation_start_at },
      ].filter((r) => !!r.value),
    [info.open_scheduled_at, info.apply_start_at, info.operation_start_at],
  );

  if (status === "on_sale") return <>{children}</>;

  if (status === "presale") {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2">
          <SaleStatusBadge status={status} />
          <p className="text-xs text-muted-foreground">{SALE_STATUS_META.presale.desc}</p>
        </div>
        {children}
      </div>
    );
  }

  if (status === "open_alert") {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="rounded-xl border border-border p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <SaleStatusBadge status={status} />
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
              <Users className="h-3.5 w-3.5" aria-hidden />
              알림 신청 {(alertState?.total ?? 0).toLocaleString()}명
            </span>
          </div>
          {schedule.length > 0 && (
            <ul className="space-y-1">
              {schedule.map((row) => (
                <li key={row.label} className="flex items-center gap-2 text-xs">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium text-foreground">{fmt(row.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button
          className="w-full h-12 text-base rounded-full font-bold"
          variant={alertState?.mine ? "outline" : "default"}
          onClick={() => toggleAlert.mutate()}
          disabled={toggleAlert.isPending}
        >
          {alertState?.mine ? (
            <>
              <BellOff className="h-4 w-4 mr-2" aria-hidden /> 오픈알림 신청 취소
            </>
          ) : (
            <>
              <BellRing className="h-4 w-4 mr-2" aria-hidden /> 오픈알림 신청
            </>
          )}
        </Button>
      </div>
    );
  }

  // closed / sold_out
  return (
    <div className={cn("space-y-2", className)}>
      <Button className="w-full h-12 text-base rounded-full font-bold" disabled>
        {saleCtaLabel(status)}
      </Button>
      <p className="text-xs text-muted-foreground text-center">{SALE_STATUS_META[status].desc}</p>
    </div>
  );
};

export default SaleStatusCta;
