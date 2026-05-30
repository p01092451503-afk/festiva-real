import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Receipt, Search, RotateCcw, DollarSign, ShoppingCart, CreditCard, TrendingUp,
  ChevronDown, ChevronUp, ExternalLink, Smartphone, Building2, Wallet, X,
  CheckCircle2, Trash2, Ban, UserX, Calendar, Download, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import RichStatCard from "@/components/admin/stats/RichStatCard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { Navigate } from "react-router-dom";

const statusColor: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  paid: "bg-emerald-500 text-white dark:bg-emerald-500 dark:text-white",
  cancelled: "bg-destructive/10 text-destructive",
  refunded: "bg-amber-500 text-white dark:bg-amber-500 dark:text-white",
};

const paymentMethodIcon: Record<string, React.ElementType> = {
  "카드": CreditCard,
  "간편결제": Wallet,
  "계좌이체": Building2,
  "가상계좌": Building2,
  "휴대폰": Smartphone,
};

const AdminOrders = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: siteSettings, isLoading: settingsLoading } = useSiteSettings();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [detailOrder, setDetailOrder] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState("");

  const statusLabel: Record<string, string> = {
    pending: t("adminOrders.statusPending"),
    paid: t("adminOrders.statusPaid"),
    cancelled: t("adminOrders.statusCancelled"),
    refunded: t("adminOrders.statusRefunded"),
  };

  const paymentMethodLabel = (order: any): string => {
    if (!order.payment_method) return "-";
    if (order.payment_method === "간편결제" && order.easy_pay_provider) {
      return `${order.easy_pay_provider}`;
    }
    if (order.payment_method === "카드" && order.card_company) {
      return `${order.card_company} ${order.card_type || t("adminOrders.card")}`;
    }
    return order.payment_method;
  };

  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(id, course_id, price_at_purchase, courses(title))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const userIds = [...new Set(orders.map((o: any) => o.user_id))];
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-order-profiles", userIds],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });
  const profileMap = new Map(profiles.map((p: any) => [p.user_id, p]));

  const refundMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ status: "refunded", cancel_reason: reason || null, cancelled_at: new Date().toISOString() })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({ title: t("adminOrders.refundSuccess") });
      setCancelReason("");
    },
    onError: (e: any) => toast({ title: t("adminOrders.refundFailed"), description: e.message, variant: "destructive" }),
  });

  // 입금 확인 + 수강 승인 (무통장입금 등)
  const approveEnrollMutation = useMutation({
    mutationFn: async (order: any) => {
      const nowIso = new Date().toISOString();
      // 1. 주문 상태 업데이트
      const { error: orderErr } = await supabase
        .from("orders")
        .update({ status: "paid", paid_at: nowIso })
        .eq("id", order.id);
      if (orderErr) throw orderErr;

      // 2. 주문 항목별 enrollment 생성/업데이트 (approved)
      const items = order.order_items || [];
      for (const item of items) {
        const { data: existing } = await supabase
          .from("enrollments")
          .select("id")
          .eq("user_id", order.user_id)
          .eq("course_id", item.course_id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("enrollments")
            .update({ status: "approved", order_id: order.id, reviewed_at: nowIso })
            .eq("id", existing.id);
        } else {
          await supabase.from("enrollments").insert({
            user_id: order.user_id,
            course_id: item.course_id,
            order_id: order.id,
            status: "approved",
            reviewed_at: nowIso,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({ title: t("adminOrders.approveEnrollSuccess") });
    },
    onError: (e: any) => toast({ title: t("adminOrders.approveEnrollFailed"), description: e.message, variant: "destructive" }),
  });

  // 주문 취소 (소프트)
  const cancelOrderMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ status: "cancelled", cancel_reason: reason || null, cancelled_at: new Date().toISOString() })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({ title: t("adminOrders.cancelOrderSuccess") });
      setCancelReason("");
    },
    onError: (e: any) => toast({ title: t("adminOrders.failed"), description: e.message, variant: "destructive" }),
  });

  // 주문 영구 삭제 (하드)
  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      // 미사용 enrollments(진행도 0) 정리
      await supabase
        .from("enrollments")
        .delete()
        .eq("order_id", orderId)
        .eq("progress", 0);
      // order_items 삭제
      await supabase.from("order_items").delete().eq("order_id", orderId);
      // order 삭제
      const { error } = await supabase.from("orders").delete().eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({ title: t("adminOrders.deleteOrderSuccess") });
      setDetailOrder(null);
    },
    onError: (e: any) => toast({ title: t("adminOrders.deleteOrderFailed"), description: e.message, variant: "destructive" }),
  });

  const filtered = orders.filter((o: any) => {
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    const matchMethod = methodFilter === "all" || o.payment_method === methodFilter;
    const p = profileMap.get(o.user_id);
    const matchSearch = !search ||
      o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      p?.email?.toLowerCase().includes(search.toLowerCase()) ||
      p?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.card_approve_no?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch && matchMethod;
  });

  const paidOrders = orders.filter((o: any) => o.status === "paid");
  const totalRevenue = paidOrders.reduce((s: number, o: any) => s + (o.final_amount || 0), 0);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthRevenue = paidOrders
    .filter((o: any) => o.paid_at && new Date(o.paid_at) >= monthStart)
    .reduce((s: number, o: any) => s + (o.final_amount || 0), 0);

  const paymentMethods = [...new Set(orders.map((o: any) => o.payment_method).filter(Boolean))];

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }) : "-";

  // B2C 기능이 비활성화된 경우 결제 관리 페이지 접근 차단
  if (!settingsLoading && siteSettings && siteSettings.b2c_enabled === false) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2">
            <Receipt className="h-6 w-6" /> {t("adminOrders.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("adminOrders.subtitle")}</p>
        </div>

        {/* KPI Cards — visualized */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <RichStatCard
            label={t("adminOrders.totalRevenue")}
            value={`${totalRevenue.toLocaleString()}원`}
            icon={DollarSign}
            tone="emerald"
            visual="sparkline"
            sparklineValues={[3, 5, 4, 7, 6, 8, 9]}
          />
          <RichStatCard
            label={t("adminOrders.monthRevenue")}
            value={`${monthRevenue.toLocaleString()}원`}
            icon={TrendingUp}
            tone="indigo"
            visual="bar"
            barValue={totalRevenue > 0 ? Math.min(100, (monthRevenue / totalRevenue) * 100) : 0}
            barCaption={totalRevenue > 0 ? `전체 매출 대비 ${Math.round((monthRevenue / totalRevenue) * 100)}%` : undefined}
          />
          <RichStatCard
            label={t("adminOrders.totalOrders")}
            value={orders.length}
            icon={ShoppingCart}
            tone="violet"
            visual="dots"
            dotsActive={Math.min(7, orders.length)}
            dotsTotal={7}
          />
          <RichStatCard
            label={t("adminOrders.paidCount")}
            value={paidOrders.length}
            icon={CreditCard}
            tone="sky"
            visual="ring"
            ringValue={orders.length > 0 ? Math.round((paidOrders.length / orders.length) * 100) : 0}
            sub={orders.length > 0 ? `${Math.round((paidOrders.length / orders.length) * 100)}%` : "0%"}
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("adminOrders.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 rounded-xl" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 rounded-xl h-10"><SelectValue placeholder={t("adminOrders.colStatus")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("adminOrders.allStatus")}</SelectItem>
              <SelectItem value="paid">{t("adminOrders.statusPaid")}</SelectItem>
              <SelectItem value="pending">{t("adminOrders.statusPending")}</SelectItem>
              <SelectItem value="cancelled">{t("adminOrders.statusCancelled")}</SelectItem>
              <SelectItem value="refunded">{t("adminOrders.statusRefunded")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-36 rounded-xl h-10"><SelectValue placeholder={t("adminOrders.colMethod")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("adminOrders.allMethod")}</SelectItem>
              {paymentMethods.map((m: string) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Desktop Table */}
        <div className="stat-card !p-0 overflow-x-auto hidden md:block">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{t("adminOrders.colOrderNo")}</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{t("adminOrders.colOrderer")}</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{t("adminOrders.colCourse")}</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{t("adminOrders.colMethod")}</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">{t("adminOrders.colAmount")}</th>
                <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3">{t("adminOrders.colDate")}</th>
                <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3">{t("adminOrders.colStatus")}</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">{t("adminOrders.colManage")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order: any) => {
                const p = profileMap.get(order.user_id);
                const items = order.order_items || [];
                const names = items.map((i: any) => i.courses?.title).filter(Boolean);
                const label = names.length > 1 ? `${names[0]} ${t("adminOrders.andMore", { count: names.length - 1 })}` : names[0] || "-";
                const MethodIcon = paymentMethodIcon[order.payment_method] || CreditCard;

                return (
                  <tr
                    key={order.id}
                    className="border-b border-border last:border-0 hover:bg-secondary/20 cursor-pointer transition-colors"
                    onClick={() => setDetailOrder(order)}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{order.order_number}</td>
                    <td className="px-4 py-3">
                      {p ? (
                        <>
                          <p className="text-sm text-foreground">{p.full_name || "-"}</p>
                          <p className="text-xs text-muted-foreground">{p.email || "-"}</p>
                        </>
                      ) : (
                        <div className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-2 py-1 rounded-md">
                          <UserX className="h-3 w-3" />
                          {t("adminOrders.guestUser")}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground truncate max-w-[200px]">{label}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-foreground">
                        <MethodIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{paymentMethodLabel(order)}</span>
                      </div>
                      {order.card_installment_months > 0 && (
                        <span className="text-[10px] text-muted-foreground">{t("adminOrders.monthInstallment", { months: order.card_installment_months })}{order.card_is_interest_free ? ` (${t("adminOrders.interestFree")})` : ""}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-foreground">{order.final_amount?.toLocaleString()}원</td>
                    <td className="px-4 py-3 text-center text-xs text-muted-foreground">{formatDate(order.paid_at)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap ${statusColor[order.status] || "bg-muted text-muted-foreground"}`}>
                        {statusLabel[order.status] || order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {order.status === "pending" && p && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-green-600 hover:text-green-700">
                                <CheckCircle2 className="h-3.5 w-3.5" /> {t("adminOrders.approveEnroll")}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t("adminOrders.approveEnroll")}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t("adminOrders.approveEnrollConfirm", { orderNumber: order.order_number })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => approveEnrollMutation.mutate(order)}>
                                  {t("adminOrders.approveEnroll")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        {order.status === "paid" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-orange-600">
                                <RotateCcw className="h-3.5 w-3.5" /> {t("adminOrders.refund")}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t("adminOrders.refundProcess")}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t("adminOrders.refundConfirm", { orderNumber: order.order_number })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <Textarea
                                placeholder={t("adminOrders.refundReasonPlaceholder")}
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                className="min-h-[80px]"
                              />
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setCancelReason("")}>{t("common.cancel")}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => refundMutation.mutate({ orderId: order.id, reason: cancelReason })}>
                                  {t("adminOrders.refundProcess")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        {order.status === "pending" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" title={t("adminOrders.cancelOrder")}>
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t("adminOrders.cancelOrder")}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t("adminOrders.cancelOrderConfirm", { orderNumber: order.order_number })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <Textarea
                                placeholder={t("adminOrders.cancelReasonPlaceholder")}
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                className="min-h-[80px]"
                              />
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setCancelReason("")}>{t("common.cancel")}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => cancelOrderMutation.mutate({ orderId: order.id, reason: cancelReason })}>
                                  {t("adminOrders.cancelOrder")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" title={t("adminOrders.deleteOrder")}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-destructive">{t("adminOrders.deleteOrder")}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("adminOrders.deleteOrderConfirm", { orderNumber: order.order_number })}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => deleteOrderMutation.mutate(order.id)}
                              >
                                {t("adminOrders.deleteOrder")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-sm text-muted-foreground">{t("adminOrders.noOrders")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-2">
          {filtered.map((order: any) => {
            const p = profileMap.get(order.user_id);
            const items = order.order_items || [];
            const names = items.map((i: any) => i.courses?.title).filter(Boolean);
            const label = names.length > 1 ? `${names[0]} ${t("adminOrders.andMore", { count: names.length - 1 })}` : names[0] || "-";
            const MethodIcon = paymentMethodIcon[order.payment_method] || CreditCard;

            return (
              <button
                key={order.id}
                type="button"
                onClick={() => setDetailOrder(order)}
                className="stat-card !p-3 w-full text-left hover:bg-secondary/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono text-muted-foreground truncate">{order.order_number}</p>
                    <p className="text-sm font-semibold text-foreground truncate mt-0.5">
                      {p ? (p.full_name || "-") : t("adminOrders.guestUser")}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{label}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-lg whitespace-nowrap ${statusColor[order.status] || "bg-muted text-muted-foreground"}`}>
                      {statusLabel[order.status] || order.status}
                    </span>
                    <p className="text-sm font-bold text-foreground mt-1">{order.final_amount?.toLocaleString()}원</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
                    <MethodIcon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{paymentMethodLabel(order)}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">{formatDate(order.paid_at)}</span>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="stat-card !p-8 text-center text-sm text-muted-foreground">{t("adminOrders.noOrders")}</div>
          )}
        </div>
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={!!detailOrder} onOpenChange={() => setDetailOrder(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" /> {t("adminOrders.orderDetail")}
            </DialogTitle>
          </DialogHeader>
          {detailOrder && <OrderDetail order={detailOrder} profile={profileMap.get(detailOrder.user_id)} />}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

const OrderDetail = ({ order, profile }: { order: any; profile: any }) => {
  const { t } = useTranslation();
  const formatDateTime = (d: string | null) => d ? new Date(d).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "-";
  const items = order.order_items || [];

  const statusLabel: Record<string, string> = {
    pending: t("adminOrders.statusPending"),
    paid: t("adminOrders.statusPaid"),
    cancelled: t("adminOrders.statusCancelled"),
    refunded: t("adminOrders.statusRefunded"),
  };

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: t("adminOrders.orderNo"), value: order.order_number },
    { label: t("adminOrders.orderer"), value: <div><p className="text-sm font-medium">{profile?.full_name || "-"}</p><p className="text-xs text-muted-foreground">{profile?.email || "-"}</p></div> },
    { label: t("adminOrders.status"), value: <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg ${statusColor[order.status]}`}>{statusLabel[order.status]}</span> },
    { label: t("adminOrders.orderDate"), value: formatDateTime(order.created_at) },
    { label: t("adminOrders.paymentDate"), value: formatDateTime(order.paid_at) },
  ];

  // Payment method details
  if (order.payment_method) {
    rows.push({ label: t("adminOrders.paymentMethod"), value: order.payment_method });
  }
  if (order.payment_method === "카드") {
    if (order.card_company) rows.push({ label: t("adminOrders.cardCompany"), value: `${order.card_company} (${order.card_type || "-"} / ${order.card_owner_type || "-"})` });
    if (order.card_number) rows.push({ label: t("adminOrders.cardNumber"), value: order.card_number });
    if (order.card_approve_no) rows.push({ label: t("adminOrders.approvalNo"), value: order.card_approve_no });
    if (order.card_installment_months !== undefined) {
      rows.push({ label: t("adminOrders.installment"), value: order.card_installment_months === 0 ? t("adminOrders.lumpSum") : `${t("adminOrders.monthInstallment", { months: order.card_installment_months })}${order.card_is_interest_free ? ` (${t("adminOrders.interestFree")})` : ""}` });
    }
  }
  if (order.payment_method === "간편결제" && order.easy_pay_provider) {
    rows.push({ label: t("adminOrders.easyPay"), value: order.easy_pay_provider });
    if (order.easy_pay_discount_amount > 0) rows.push({ label: t("adminOrders.easyPayDiscount"), value: `${order.easy_pay_discount_amount.toLocaleString()}원` });
  }
  if ((order.payment_method === "계좌이체" || order.payment_method === "가상계좌") && order.bank_name) {
    rows.push({ label: t("adminOrders.bank"), value: `${order.bank_name} (${order.bank_code || "-"})` });
  }
  if (order.payment_method === "휴대폰" && order.mobile_carrier) {
    rows.push({ label: t("adminOrders.carrier"), value: order.mobile_carrier });
  }
  if (order.toss_approved_at) rows.push({ label: t("adminOrders.tossApprovalTime"), value: formatDateTime(order.toss_approved_at) });

  // Amounts
  rows.push({ label: t("adminOrders.productAmount"), value: `${order.total_amount?.toLocaleString()}원` });
  if (order.discount_amount > 0) rows.push({ label: t("adminOrders.discount"), value: `-${order.discount_amount?.toLocaleString()}원` });
  if (order.vat > 0) rows.push({ label: t("adminOrders.vat"), value: `${order.vat?.toLocaleString()}원` });
  rows.push({ label: t("adminOrders.finalAmount"), value: <span className="font-bold">{order.final_amount?.toLocaleString()}원</span> });

  // Cancel info
  if (order.cancel_reason) rows.push({ label: t("adminOrders.cancelReason"), value: order.cancel_reason });
  if (order.cancelled_at) rows.push({ label: t("adminOrders.cancelDate"), value: formatDateTime(order.cancelled_at) });

  // Receipt
  if (order.receipt_url) {
    rows.push({
      label: t("adminOrders.receipt"),
      value: (
        <a href={order.receipt_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          {t("adminOrders.viewReceipt")} <ExternalLink className="h-3 w-3" />
        </a>
      ),
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-0">
        {rows.map((r, i) => (
          <div key={i} className="flex items-start py-2.5 border-b border-border last:border-0">
            <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">{r.label}</span>
            <div className="flex-1 text-sm text-foreground">{r.value}</div>
          </div>
        ))}
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{t("adminOrders.orderItems")}</p>
          <div className="space-y-1.5">
            {items.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between border border-border rounded-lg p-3">
                <span className="text-sm text-foreground truncate flex-1">{item.courses?.title || "-"}</span>
                <span className="text-sm text-muted-foreground shrink-0 ml-3">{item.price_at_purchase?.toLocaleString()}원</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {order.toss_payment_key && (
        <div className="pt-2 border-t border-border">
          <p className="text-[10px] text-muted-foreground">Payment Key: {order.toss_payment_key}</p>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;
