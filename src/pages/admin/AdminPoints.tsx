import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, Plus, Trash2, Power, Ticket } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

const ACTIONS = [
  { value: "signup", label: "회원가입" },
  { value: "purchase", label: "결제(구매)" },
  { value: "review", label: "수강후기 작성" },
  { value: "completion", label: "과정 수료" },
  { value: "attendance", label: "출석/학습" },
];

const TRIGGERS = [
  { value: "signup", label: "회원가입 시" },
  { value: "birthday", label: "생일 축하" },
  { value: "completion", label: "과정 수료 시" },
  { value: "first_purchase", label: "첫 구매 시" },
];

const label = (list: { value: string; label: string }[], v: string) =>
  list.find((i) => i.value === v)?.label ?? v;

/** 포인트 정책 · 자동쿠폰 규칙 관리 */
const AdminPoints = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState("points");
  const [pf, setPf] = useState({
    name: "", action_type: "purchase", earn_type: "percent", earn_value: "1",
    max_per_action: "", expire_days: "365",
  });
  const [cf, setCf] = useState({ name: "", trigger_type: "signup", coupon_id: "", valid_days: "30" });

  const { data: policies = [] } = useQuery({
    queryKey: ["point-policies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("point_policies").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: coupons = [] } = useQuery({
    queryKey: ["coupons-for-auto"],
    queryFn: async () => {
      const { data, error } = await supabase.from("coupons").select("id, code, name").order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const { data: autoRules = [] } = useQuery({
    queryKey: ["auto-coupon-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auto_coupon_rules").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["point-history-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("point_history").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const run = (fn: () => Promise<any>, msg: string, keys: string[]) =>
    fn()
      .then(() => {
        toast.success(msg);
        keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      })
      .catch((e: any) => toast.error(e.message));

  const addPolicy = () =>
    run(async () => {
      if (!pf.name.trim()) throw new Error("정책명을 입력하세요.");
      const { error } = await supabase.from("point_policies").insert({
        name: pf.name.trim(),
        action_type: pf.action_type,
        earn_type: pf.earn_type,
        earn_value: Number(pf.earn_value) || 0,
        max_per_action: pf.max_per_action ? Number(pf.max_per_action) : null,
        expire_days: pf.expire_days ? Number(pf.expire_days) : null,
      });
      if (error) throw error;
      setPf({ name: "", action_type: "purchase", earn_type: "percent", earn_value: "1", max_per_action: "", expire_days: "365" });
    }, "포인트 정책이 추가되었습니다.", ["point-policies"]);

  const togglePolicy = (id: string, next: boolean) =>
    run(async () => {
      const { error } = await supabase.from("point_policies").update({ is_active: next }).eq("id", id);
      if (error) throw error;
    }, "상태가 변경되었습니다.", ["point-policies"]);

  const removePolicy = (id: string) =>
    run(async () => {
      const { error } = await supabase.from("point_policies").delete().eq("id", id);
      if (error) throw error;
    }, "삭제되었습니다.", ["point-policies"]);

  const addAutoRule = () =>
    run(async () => {
      if (!cf.name.trim()) throw new Error("규칙명을 입력하세요.");
      const { error } = await supabase.from("auto_coupon_rules").insert({
        name: cf.name.trim(),
        trigger_type: cf.trigger_type,
        coupon_id: cf.coupon_id || null,
        valid_days: Number(cf.valid_days) || 30,
      });
      if (error) throw error;
      setCf({ name: "", trigger_type: "signup", coupon_id: "", valid_days: "30" });
    }, "자동쿠폰 규칙이 추가되었습니다.", ["auto-coupon-rules"]);

  const toggleAutoRule = (id: string, next: boolean) =>
    run(async () => {
      const { error } = await supabase.from("auto_coupon_rules").update({ is_active: next }).eq("id", id);
      if (error) throw error;
    }, "상태가 변경되었습니다.", ["auto-coupon-rules"]);

  const removeAutoRule = (id: string) =>
    run(async () => {
      const { error } = await supabase.from("auto_coupon_rules").delete().eq("id", id);
      if (error) throw error;
    }, "삭제되었습니다.", ["auto-coupon-rules"]);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2">
            <Coins className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
            포인트 · 자동쿠폰
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            적립 정책과 조건별 자동 쿠폰 발급 규칙을 관리하고, 포인트 이용내역을 확인합니다.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="points">포인트 정책</TabsTrigger>
            <TabsTrigger value="coupons">자동쿠폰</TabsTrigger>
            <TabsTrigger value="history">이용내역</TabsTrigger>
          </TabsList>

          <TabsContent value="points" className="space-y-6 pt-4">
            <div className="border rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium">새 포인트 정책</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <div className="min-w-0">
                  <Label className="text-xs">정책명</Label>
                  <Input value={pf.name} onChange={(e) => setPf({ ...pf, name: e.target.value })} />
                </div>
                <div className="min-w-0">
                  <Label className="text-xs">적립 시점</Label>
                  <Select value={pf.action_type} onValueChange={(v) => setPf({ ...pf, action_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0">
                  <Label className="text-xs">적립 방식</Label>
                  <Select value={pf.earn_type} onValueChange={(v) => setPf({ ...pf, earn_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">결제액 비율(%)</SelectItem>
                      <SelectItem value="fixed">정액(P)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0">
                  <Label className="text-xs">적립값</Label>
                  <Input type="number" value={pf.earn_value} onChange={(e) => setPf({ ...pf, earn_value: e.target.value })} />
                </div>
                <div className="min-w-0">
                  <Label className="text-xs">1회 한도(P)</Label>
                  <Input type="number" value={pf.max_per_action} onChange={(e) => setPf({ ...pf, max_per_action: e.target.value })} />
                </div>
                <div className="min-w-0">
                  <Label className="text-xs">소멸(일)</Label>
                  <Input type="number" value={pf.expire_days} onChange={(e) => setPf({ ...pf, expire_days: e.target.value })} />
                </div>
              </div>
              <Button onClick={addPolicy}><Plus className="h-4 w-4 mr-1" />정책 추가</Button>
            </div>

            <div className="border rounded-lg divide-y">
              {policies.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">등록된 정책이 없습니다.</p>
              )}
              {policies.map((p) => (
                <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 border-b-2 border-border/80 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{p.name}</span>
                      <Badge variant="secondary" className="whitespace-nowrap">{label(ACTIONS, p.action_type)}</Badge>
                      {!p.is_active && <Badge variant="outline">비활성</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {p.earn_type === "percent" ? `결제액의 ${p.earn_value}%` : `${p.earn_value}P 정액`}
                      {p.max_per_action ? ` · 1회 최대 ${Number(p.max_per_action).toLocaleString()}P` : ""}
                      {p.expire_days ? ` · ${p.expire_days}일 후 소멸` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => togglePolicy(p.id, !p.is_active)}>
                      <Power className="h-4 w-4 mr-1" />{p.is_active ? "비활성화" : "활성화"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => removePolicy(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="coupons" className="space-y-6 pt-4">
            <div className="border rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium">새 자동쿠폰 규칙</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="min-w-0">
                  <Label className="text-xs">규칙명</Label>
                  <Input value={cf.name} onChange={(e) => setCf({ ...cf, name: e.target.value })} />
                </div>
                <div className="min-w-0">
                  <Label className="text-xs">발급 조건</Label>
                  <Select value={cf.trigger_type} onValueChange={(v) => setCf({ ...cf, trigger_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TRIGGERS.map((tg) => <SelectItem key={tg.value} value={tg.value}>{tg.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0">
                  <Label className="text-xs">발급 쿠폰</Label>
                  <Select value={cf.coupon_id} onValueChange={(v) => setCf({ ...cf, coupon_id: v })}>
                    <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                    <SelectContent>
                      {coupons.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name || c.code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0">
                  <Label className="text-xs">유효기간(일)</Label>
                  <Input type="number" value={cf.valid_days} onChange={(e) => setCf({ ...cf, valid_days: e.target.value })} />
                </div>
              </div>
              <Button onClick={addAutoRule}><Plus className="h-4 w-4 mr-1" />규칙 추가</Button>
            </div>

            <div className="border rounded-lg divide-y">
              {autoRules.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">등록된 자동쿠폰 규칙이 없습니다.</p>
              )}
              {autoRules.map((r) => (
                <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 border-b-2 border-border/80 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Ticket className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <span className="font-medium">{r.name}</span>
                      <Badge variant="secondary" className="whitespace-nowrap">{label(TRIGGERS, r.trigger_type)}</Badge>
                      {!r.is_active && <Badge variant="outline">중지</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      유효 {r.valid_days}일 · 누적 발급 {r.issued_count ?? 0}건
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => toggleAutoRule(r.id, !r.is_active)}>
                      <Power className="h-4 w-4 mr-1" />{r.is_active ? "중지" : "시작"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => removeAutoRule(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="history" className="pt-4">
            <div className="border rounded-lg divide-y">
              {history.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">포인트 이용내역이 없습니다.</p>
              )}
              {history.map((h) => (
                <div key={h.id} className="p-3 flex items-center gap-3 border-b-2 border-border/80 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{h.description || h.action_type}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleString("ko-KR")}
                    </p>
                  </div>
                  <span className={`text-sm font-medium whitespace-nowrap ${Number(h.points) < 0 ? "text-destructive" : ""}`}>
                    {Number(h.points) > 0 ? "+" : ""}{Number(h.points).toLocaleString()}P
                  </span>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminPoints;
