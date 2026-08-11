import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, Plus, Trash2, Power, Ticket, Timer, Minus } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  { value: "completion", label: "수료 과정 수 도달" },
  { value: "first_purchase", label: "첫 구매 시" },
  { value: "purchase_amount", label: "누적 결제금액 도달" },
  { value: "points", label: "누적 포인트 도달" },
];

const NEEDS_VALUE = ["completion", "purchase_amount", "points"];

const UC_STATUS: Record<string, string> = { active: "사용가능", used: "사용완료", expired: "만료" };

const label = (list: { value: string; label: string }[], v: string) =>
  list.find((i) => i.value === v)?.label ?? v;
const fmt = (v?: string | null) => (v ? new Date(v).toLocaleDateString("ko-KR") : "-");

/** 포인트 정책 · 자동쿠폰 규칙 · 발급 쿠폰(만료/사용) 관리 */
const AdminPoints = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState("points");
  const [pf, setPf] = useState({
    name: "", action_type: "purchase", earn_type: "percent", earn_value: "1",
    max_per_action: "", expire_days: "365",
  });
  const [cf, setCf] = useState({
    name: "", trigger_type: "signup", coupon_id: "", valid_days: "30",
    condition_value: "0", once_per_user: true,
  });
  const [manual, setManual] = useState({ user_id: "", points: "", description: "", mode: "earn" });
  const [ucFilter, setUcFilter] = useState("all");

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

  const { data: issued = [] } = useQuery({
    queryKey: ["user-coupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_coupons").select("*").order("issued_at", { ascending: false }).limit(300);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["points-members"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, email").order("full_name").limit(500);
      return (data as any[]) || [];
    },
  });

  const memberName = (id: string) => {
    const m = members.find((x) => x.user_id === id);
    return m?.full_name || m?.email || id.slice(0, 8);
  };
  const couponName = (id: string) => coupons.find((c) => c.id === id)?.name || coupons.find((c) => c.id === id)?.code || "-";

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

  /** 정책 기반 적립 / 차감 수동 실행 */
  const applyManual = () =>
    run(async () => {
      if (!manual.user_id) throw new Error("회원을 선택하세요.");
      const pts = Number(manual.points) || 0;
      if (pts <= 0) throw new Error("포인트를 입력하세요.");
      if (manual.mode === "earn") {
        const { error } = await supabase.rpc("award_points", {
          p_user_id: manual.user_id,
          p_points: pts,
          p_action_type: "admin_grant",
          p_description: manual.description.trim() || "관리자 지급",
        });
        if (error) throw error;
        await supabase.rpc("evaluate_auto_coupons", { _user_id: manual.user_id, _trigger: "points" });
      } else {
        const { error } = await supabase.rpc("spend_points", {
          _user_id: manual.user_id,
          _points: pts,
          _description: manual.description.trim() || "관리자 차감",
        });
        if (error) throw error;
      }
      setManual({ ...manual, points: "", description: "" });
    }, "포인트가 반영되었습니다.", ["point-history-recent", "user-coupons"]);

  const addAutoRule = () =>
    run(async () => {
      if (!cf.name.trim()) throw new Error("규칙명을 입력하세요.");
      if (!cf.coupon_id) throw new Error("발급할 쿠폰을 선택하세요.");
      const { error } = await supabase.from("auto_coupon_rules").insert({
        name: cf.name.trim(),
        trigger_type: cf.trigger_type,
        coupon_id: cf.coupon_id,
        valid_days: Number(cf.valid_days) || 30,
        condition_value: NEEDS_VALUE.includes(cf.trigger_type) ? Number(cf.condition_value) || 0 : 0,
        once_per_user: cf.once_per_user,
      });
      if (error) throw error;
      setCf({ name: "", trigger_type: "signup", coupon_id: "", valid_days: "30", condition_value: "0", once_per_user: true });
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

  /** 지금 조건 충족 회원에게 즉시 발급 */
  const issueNow = (rule: any) =>
    run(async () => {
      const targets = members.map((m) => m.user_id);
      if (targets.length === 0) throw new Error("대상 회원이 없습니다.");
      let issuedCount = 0;
      for (const uid of targets) {
        const { data, error } = await supabase.rpc("evaluate_auto_coupons", {
          _user_id: uid,
          _trigger: rule.trigger_type,
        });
        if (error) throw error;
        issuedCount += Number(data || 0);
      }
      if (issuedCount === 0) throw new Error("조건을 충족한 신규 대상이 없습니다.");
    }, "조건 충족 회원에게 쿠폰을 발급했습니다.", ["auto-coupon-rules", "user-coupons"]);

  const expireNow = () =>
    run(async () => {
      const { error } = await supabase.functions.invoke("run-point-expiry");
      if (error) throw error;
    }, "만료 처리를 실행했습니다.", ["point-history-recent", "user-coupons"]);

  const markUsed = (id: string) =>
    run(async () => {
      const { error } = await supabase.rpc("use_user_coupon", { _user_coupon_id: id });
      if (error) throw error;
    }, "사용 처리되었습니다.", ["user-coupons"]);

  const revokeCoupon = (id: string) =>
    run(async () => {
      const { error } = await supabase.from("user_coupons").delete().eq("id", id);
      if (error) throw error;
    }, "발급 쿠폰을 회수했습니다.", ["user-coupons"]);

  const { sort: issuedSort, setSort: setIssuedSort } = useTableSort({ defaultKey: "issued", defaultDir: "desc", paramPrefix: "uc" });
  const { sort: historySort, setSort: setHistorySort } = useTableSort({ defaultKey: "created", defaultDir: "desc", paramPrefix: "ph" });

  const filteredIssued = useMemo(() => {
    const base = ucFilter === "all" ? issued : issued.filter((c) => c.status === ucFilter);
    return sortRows(base as any[], issuedSort, {
      issued: (c: any) => (c.issued_at ? new Date(c.issued_at).getTime() : null),
      expires: (c: any) => (c.expires_at ? new Date(c.expires_at).getTime() : null),
      name: (c: any) => memberName(c.user_id) || "",
      status: (c: any) => c.status || "",
    });
  }, [issued, ucFilter, issuedSort, memberName]);

  const issuedPage = usePagination(filteredIssued, 20);

  const sortedHistory = useMemo(
    () =>
      sortRows(history as any[], historySort, {
        created: (h: any) => (h.created_at ? new Date(h.created_at).getTime() : null),
        points: (h: any) => Number(h.points) || 0,
      }),
    [history, historySort],
  );
  const historyPage = usePagination(sortedHistory, 20);


  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2">
              <Coins className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
              포인트 · 자동쿠폰
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              적립·차감 규칙과 조건별 자동 쿠폰 발급을 관리하고, 만료·사용 처리를 확인합니다.
            </p>
          </div>
          <Button variant="outline" onClick={expireNow}>
            <Timer className="h-4 w-4 mr-1" />만료 처리 실행
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="points">포인트 정책</TabsTrigger>
            <TabsTrigger value="coupons">자동쿠폰 규칙</TabsTrigger>
            <TabsTrigger value="issued">발급 쿠폰</TabsTrigger>
            <TabsTrigger value="history">이용내역</TabsTrigger>
          </TabsList>

          <TabsContent value="points" className="space-y-6 pt-4">
            <div className="border rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium">새 포인트 적립 규칙</p>
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

            <div className="border rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium">포인트 수동 적립 · 차감</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="min-w-0">
                  <Label className="text-xs">회원</Label>
                  <Select value={manual.user_id} onValueChange={(v) => setManual({ ...manual, user_id: v })}>
                    <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || m.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0">
                  <Label className="text-xs">구분</Label>
                  <Select value={manual.mode} onValueChange={(v) => setManual({ ...manual, mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="earn">적립</SelectItem>
                      <SelectItem value="spend">차감</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0">
                  <Label className="text-xs">포인트</Label>
                  <Input type="number" value={manual.points} onChange={(e) => setManual({ ...manual, points: e.target.value })} />
                </div>
                <div className="min-w-0">
                  <Label className="text-xs">사유</Label>
                  <Input value={manual.description} onChange={(e) => setManual({ ...manual, description: e.target.value })} />
                </div>
              </div>
              <Button variant="outline" onClick={applyManual}>
                {manual.mode === "earn" ? <Plus className="h-4 w-4 mr-1" /> : <Minus className="h-4 w-4 mr-1" />}
                반영
              </Button>
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
                    <Button variant="ghost" size="sm" onClick={() => removePolicy(p.id)} aria-label="삭제">
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
                {NEEDS_VALUE.includes(cf.trigger_type) && (
                  <div className="min-w-0">
                    <Label className="text-xs">
                      {cf.trigger_type === "purchase_amount" ? "기준 결제금액(원)" : cf.trigger_type === "points" ? "기준 포인트(P)" : "기준 수료 과정 수"}
                    </Label>
                    <Input type="number" value={cf.condition_value} onChange={(e) => setCf({ ...cf, condition_value: e.target.value })} />
                  </div>
                )}
                <div className="min-w-0 flex items-end gap-2 pb-1">
                  <Switch checked={cf.once_per_user} onCheckedChange={(v) => setCf({ ...cf, once_per_user: v })} id="once" />
                  <Label htmlFor="once" className="text-xs">1인 1회만 발급</Label>
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
                      {couponName(r.coupon_id)} · 유효 {r.valid_days}일
                      {Number(r.condition_value) > 0 ? ` · 기준 ${Number(r.condition_value).toLocaleString()}` : ""}
                      {r.once_per_user ? " · 1인 1회" : " · 중복 발급"} · 누적 발급 {r.issued_count ?? 0}건
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => issueNow(r)}>지금 발급</Button>
                    <Button variant="outline" size="sm" onClick={() => toggleAutoRule(r.id, !r.is_active)}>
                      <Power className="h-4 w-4 mr-1" />{r.is_active ? "중지" : "시작"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => removeAutoRule(r.id)} aria-label="삭제">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="issued" className="space-y-4 pt-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">상태</Label>
              <Select value={ucFilter} onValueChange={setUcFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {Object.entries(UC_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">{filteredIssued.length}건</span>
            </div>

            <div className="border rounded-lg divide-y">
              {filteredIssued.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">발급된 쿠폰이 없습니다.</p>
              )}
              {filteredIssued.map((c) => (
                <div key={c.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 border-b-2 border-border/80 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Ticket className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <span className="font-medium">{memberName(c.user_id)}</span>
                      <Badge variant="secondary" className="whitespace-nowrap">{couponName(c.coupon_id)}</Badge>
                      <Badge
                        variant={c.status === "used" ? "default" : c.status === "expired" ? "destructive" : "outline"}
                        className="whitespace-nowrap"
                      >
                        {UC_STATUS[c.status] ?? c.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      발급 {fmt(c.issued_at)} · 만료 {fmt(c.expires_at)}
                      {c.used_at ? ` · 사용 ${fmt(c.used_at)}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {c.status === "active" && (
                      <Button variant="outline" size="sm" onClick={() => markUsed(c.id)}>사용 처리</Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => revokeCoupon(c.id)} aria-label="회수">
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
                      {h.expires_at ? ` · ${fmt(h.expires_at)} 소멸예정` : ""}
                      {h.expired_at ? " · 소멸 완료" : ""}
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
