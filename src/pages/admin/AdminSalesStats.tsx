import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, FileSpreadsheet, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useTableSort, sortRows } from "@/hooks/useTableSort";
import SortHeader from "@/components/table/SortHeader";
import TablePagination, { usePagination } from "@/components/table/TablePagination";

const won = (n: number) => `${Number(n || 0).toLocaleString()}원`;
const fmtDT = (v?: string | null) => (v ? new Date(v).toLocaleString("ko-KR") : "-");

const ORDER_STATUS: Record<string, string> = {
  pending: "결제대기",
  paid: "결제완료",
  cancelled: "취소",
  refunded: "환불",
  failed: "실패",
};

const REFUND_STATUS: Record<string, string> = {
  pending: "접수",
  approved: "승인",
  rejected: "반려",
  completed: "환불완료",
};

const download = (rows: any[], sheetName: string, fileName: string) => {
  if (rows.length === 0) {
    toast.error("내보낼 데이터가 없습니다.");
    return;
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName);
  XLSX.writeFile(wb, fileName);
  toast.success("엑셀 파일을 내려받았습니다.");
};

/** 통계 5종: 주문 / 주문항목 / 매출 / 환불 / 구독 */
const AdminSalesStats = () => {
  const monthAgo = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [statusFilter, setStatusFilter] = useState("all");
  const [unit, setUnit] = useState<"day" | "month">("day");

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["sales-stats", from, to],
    queryFn: async () => {
      const start = `${from}T00:00:00`;
      const end = `${to}T23:59:59`;
      const [ordersRes, refundsRes, coursesRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, order_number, user_id, status, total_amount, discount_amount, final_amount, payment_method, created_at, paid_at, order_items(id, course_id, price_at_purchase)")
          .gte("created_at", start)
          .lte("created_at", end)
          .order("created_at", { ascending: false })
          .limit(3000),
        supabase
          .from("refund_requests")
          .select("id, order_id, user_id, course_id, paid_amount, final_amount, refund_percent, status, reason, created_at, processed_at")
          .gte("created_at", start)
          .lte("created_at", end)
          .order("created_at", { ascending: false })
          .limit(2000),
        supabase.from("courses").select("id, title, price"),
      ]);
      if (ordersRes.error) throw ordersRes.error;

      const orders = ordersRes.data || [];
      const userIds = Array.from(
        new Set([...orders.map((o) => o.user_id), ...(refundsRes.data || []).map((r) => r.user_id)].filter(Boolean)),
      );
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds)
        : { data: [] as any[] };

      return {
        orders,
        refunds: refundsRes.data || [],
        courseMap: new Map((coursesRes.data || []).map((c) => [c.id, c.title])),
        userMap: new Map((profiles || []).map((p) => [p.user_id, p])),
      };
    },
  });

  const orders = data?.orders || [];
  const refunds = data?.refunds || [];
  const courseMap = data?.courseMap || new Map();
  const userMap = data?.userMap || new Map();

  const filteredOrders = useMemo(
    () => (statusFilter === "all" ? orders : orders.filter((o) => o.status === statusFilter)),
    [orders, statusFilter],
  );

  const paidOrders = useMemo(() => orders.filter((o) => o.status === "paid"), [orders]);

  const summary = useMemo(() => {
    const gross = paidOrders.reduce((s, o) => s + (o.final_amount || 0), 0);
    const refundAmt = refunds
      .filter((r) => r.status === "completed")
      .reduce((s, r) => s + (r.final_amount || 0), 0);
    return {
      orderCount: orders.length,
      paidCount: paidOrders.length,
      gross,
      refundAmt,
      net: gross - refundAmt,
      itemCount: paidOrders.reduce((s, o) => s + (o.order_items?.length || 0), 0),
    };
  }, [orders, paidOrders, refunds]);

  // 주문항목 통계 (강의별 집계)
  const itemStats = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>();
    paidOrders.forEach((o) =>
      (o.order_items || []).forEach((it: any) => {
        const cur = map.get(it.course_id) || { count: 0, amount: 0 };
        map.set(it.course_id, { count: cur.count + 1, amount: cur.amount + (it.price_at_purchase || 0) });
      }),
    );
    return Array.from(map.entries())
      .map(([course_id, v]) => ({ course_id, title: courseMap.get(course_id) || "(삭제된 강의)", ...v }))
      .sort((a, b) => b.amount - a.amount);
  }, [paidOrders, courseMap]);

  // 매출 추이
  const revenueSeries = useMemo(() => {
    const map = new Map<string, { amount: number; count: number; discount: number }>();
    paidOrders.forEach((o) => {
      const base = (o.paid_at || o.created_at).slice(0, unit === "day" ? 10 : 7);
      const cur = map.get(base) || { amount: 0, count: 0, discount: 0 };
      map.set(base, {
        amount: cur.amount + (o.final_amount || 0),
        count: cur.count + 1,
        discount: cur.discount + (o.discount_amount || 0),
      });
    });
    return Array.from(map.entries())
      .map(([period, v]) => ({ period, ...v }))
      .sort((a, b) => (a.period < b.period ? 1 : -1));
  }, [paidOrders, unit]);

  const maxRevenue = Math.max(1, ...revenueSeries.map((r) => r.amount));

  const refundStats = useMemo(() => {
    const byStatus = new Map<string, { count: number; amount: number }>();
    refunds.forEach((r) => {
      const cur = byStatus.get(r.status) || { count: 0, amount: 0 };
      byStatus.set(r.status, { count: cur.count + 1, amount: cur.amount + (r.final_amount || 0) });
    });
    return Array.from(byStatus.entries()).map(([status, v]) => ({ status, ...v }));
  }, [refunds]);

  const userName = (id: string) => userMap.get(id)?.full_name || "(알 수 없음)";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-semibold sm:text-2xl">
              <BarChart3 className="h-6 w-6" />
              매출·주문 통계
            </h1>
            <p className="mt-1 text-muted-foreground">
              주문·주문항목·매출·환불·구독 5종 통계를 기간별로 조회하고 엑셀로 내보냅니다.
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            새로고침
          </Button>
        </div>

        <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-4">
          <div>
            <Label>시작일</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>종료일</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label>주문 상태</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {Object.entries(ORDER_STATUS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>매출 집계 단위</Label>
            <Select value={unit} onValueChange={(v) => setUnit(v as "day" | "month")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="day">일별</SelectItem>
                <SelectItem value="month">월별</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "주문 건수", value: `${summary.orderCount.toLocaleString()}건` },
            { label: "결제완료", value: `${summary.paidCount.toLocaleString()}건` },
            { label: "총 매출", value: won(summary.gross) },
            { label: "환불액", value: won(summary.refundAmt) },
            { label: "순매출", value: won(summary.net) },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-lg font-semibold">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="orders">
          <TabsList className="flex-wrap">
            <TabsTrigger value="orders">주문</TabsTrigger>
            <TabsTrigger value="items">주문항목</TabsTrigger>
            <TabsTrigger value="revenue">매출</TabsTrigger>
            <TabsTrigger value="refunds">환불</TabsTrigger>
            <TabsTrigger value="subs">구독</TabsTrigger>
          </TabsList>

          {/* 주문 통계 */}
          <TabsContent value="orders" className="space-y-3 pt-4">
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() =>
                  download(
                    filteredOrders.map((o) => ({
                      주문번호: o.order_number,
                      주문자: userName(o.user_id),
                      상태: ORDER_STATUS[o.status] || o.status,
                      상품수: o.order_items?.length || 0,
                      정가합계: o.total_amount,
                      할인: o.discount_amount,
                      결제금액: o.final_amount,
                      결제수단: o.payment_method || "-",
                      주문일시: fmtDT(o.created_at),
                      결제일시: fmtDT(o.paid_at),
                    })),
                    "주문통계",
                    `주문통계_${from}_${to}.xlsx`,
                  )
                }
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />엑셀 내보내기
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3 font-medium">주문번호</th>
                    <th className="p-3 font-medium">주문자</th>
                    <th className="p-3 font-medium">상태</th>
                    <th className="p-3 font-medium">상품수</th>
                    <th className="p-3 font-medium">결제금액</th>
                    <th className="p-3 font-medium">결제수단</th>
                    <th className="p-3 font-medium">주문일시</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">주문 내역이 없습니다.</td></tr>
                  ) : (
                    filteredOrders.slice(0, 300).map((o) => (
                      <tr key={o.id} className="border-b-2 border-border/80 last:border-0">
                        <td className="whitespace-nowrap p-3">{o.order_number}</td>
                        <td className="p-3">{userName(o.user_id)}</td>
                        <td className="p-3"><Badge variant="outline">{ORDER_STATUS[o.status] || o.status}</Badge></td>
                        <td className="p-3">{o.order_items?.length || 0}</td>
                        <td className="whitespace-nowrap p-3">{won(o.final_amount)}</td>
                        <td className="p-3">{o.payment_method || "-"}</td>
                        <td className="whitespace-nowrap p-3">{fmtDT(o.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* 주문항목 통계 */}
          <TabsContent value="items" className="space-y-3 pt-4">
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() =>
                  download(
                    itemStats.map((i) => ({ 강의명: i.title, 판매건수: i.count, 매출액: i.amount })),
                    "주문항목통계",
                    `주문항목통계_${from}_${to}.xlsx`,
                  )
                }
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />엑셀 내보내기
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3 font-medium">강의명</th>
                    <th className="p-3 font-medium">판매건수</th>
                    <th className="p-3 font-medium">매출액</th>
                    <th className="p-3 font-medium">비중</th>
                  </tr>
                </thead>
                <tbody>
                  {itemStats.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">판매 내역이 없습니다.</td></tr>
                  ) : (
                    itemStats.map((i) => (
                      <tr key={i.course_id} className="border-b-2 border-border/80 last:border-0">
                        <td className="p-3">{i.title}</td>
                        <td className="p-3">{i.count.toLocaleString()}건</td>
                        <td className="whitespace-nowrap p-3">{won(i.amount)}</td>
                        <td className="p-3">
                          {summary.gross > 0 ? `${((i.amount / summary.gross) * 100).toFixed(1)}%` : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* 매출 통계 */}
          <TabsContent value="revenue" className="space-y-3 pt-4">
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() =>
                  download(
                    revenueSeries.map((r) => ({
                      기간: r.period,
                      결제건수: r.count,
                      할인액: r.discount,
                      매출액: r.amount,
                    })),
                    "매출통계",
                    `매출통계_${from}_${to}.xlsx`,
                  )
                }
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />엑셀 내보내기
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3 font-medium">기간</th>
                    <th className="p-3 font-medium">결제건수</th>
                    <th className="p-3 font-medium">할인액</th>
                    <th className="p-3 font-medium">매출액</th>
                    <th className="p-3 font-medium">추이</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueSeries.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">매출 내역이 없습니다.</td></tr>
                  ) : (
                    revenueSeries.map((r) => (
                      <tr key={r.period} className="border-b-2 border-border/80 last:border-0">
                        <td className="whitespace-nowrap p-3">{r.period}</td>
                        <td className="p-3">{r.count.toLocaleString()}건</td>
                        <td className="whitespace-nowrap p-3">{won(r.discount)}</td>
                        <td className="whitespace-nowrap p-3 font-medium">{won(r.amount)}</td>
                        <td className="p-3">
                          <div className="h-2 w-full min-w-[80px] rounded bg-muted">
                            <div
                              className="h-2 rounded bg-primary"
                              style={{ width: `${(r.amount / maxRevenue) * 100}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* 환불 통계 */}
          <TabsContent value="refunds" className="space-y-3 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {refundStats.map((s) => (
                  <Badge key={s.status} variant="outline">
                    {REFUND_STATUS[s.status] || s.status} {s.count}건 · {won(s.amount)}
                  </Badge>
                ))}
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  download(
                    refunds.map((r) => ({
                      신청일: fmtDT(r.created_at),
                      신청자: userName(r.user_id),
                      강의: courseMap.get(r.course_id) || "-",
                      결제금액: r.paid_amount,
                      환불액: r.final_amount,
                      환불율: `${Number(r.refund_percent || 0)}%`,
                      상태: REFUND_STATUS[r.status] || r.status,
                      사유: r.reason || "-",
                      처리일: fmtDT(r.processed_at),
                    })),
                    "환불통계",
                    `환불통계_${from}_${to}.xlsx`,
                  )
                }
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />엑셀 내보내기
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3 font-medium">신청일</th>
                    <th className="p-3 font-medium">신청자</th>
                    <th className="p-3 font-medium">강의</th>
                    <th className="p-3 font-medium">결제금액</th>
                    <th className="p-3 font-medium">환불액</th>
                    <th className="p-3 font-medium">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">환불 내역이 없습니다.</td></tr>
                  ) : (
                    refunds.map((r) => (
                      <tr key={r.id} className="border-b-2 border-border/80 last:border-0">
                        <td className="whitespace-nowrap p-3">{fmtDT(r.created_at)}</td>
                        <td className="p-3">{userName(r.user_id)}</td>
                        <td className="p-3">{courseMap.get(r.course_id) || "-"}</td>
                        <td className="whitespace-nowrap p-3">{won(r.paid_amount)}</td>
                        <td className="whitespace-nowrap p-3">{won(r.final_amount)}</td>
                        <td className="p-3"><Badge variant="outline">{REFUND_STATUS[r.status] || r.status}</Badge></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* 구독 통계 */}
          <TabsContent value="subs" className="pt-4">
            <div className="rounded-lg border p-8 text-center text-muted-foreground">
              정기구독 상품은 5단계(확장 상품)에서 도입될 예정입니다. 도입 후 구독 신규·해지·재청구 통계가 이 탭에
              표시됩니다.
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminSalesStats;
