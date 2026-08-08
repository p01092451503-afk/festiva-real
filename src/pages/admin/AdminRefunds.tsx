import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Receipt, Plus, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

const fmt = (v?: string | null) => (v ? new Date(v).toLocaleDateString("ko-KR") : "-");
const won = (n: number) => `${Number(n || 0).toLocaleString()}원`;

/** 환불 규정(구간별 환불율) 및 환불 요청 처리 */
const AdminRefunds = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState("requests");
  const [policyForm, setPolicyForm] = useState({ name: "", basis: "days" });
  const [selectedPolicy, setSelectedPolicy] = useState<string>("");
  const [ruleForm, setRuleForm] = useState({ from_value: "0", to_value: "", refund_percent: "100" });
  const [note, setNote] = useState<Record<string, string>>({});

  const { data: policies = [] } = useQuery({
    queryKey: ["refund-policies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("refund_policies").select("*").order("created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: rules = [] } = useQuery({
    queryKey: ["refund-policy-rules", selectedPolicy],
    enabled: !!selectedPolicy,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("refund_policy_rules").select("*").eq("policy_id", selectedPolicy)
        .order("order_index").order("from_value");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["refund-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("refund_requests")
        .select("*, courses(title), profiles:user_id(full_name, email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const run = (fn: () => Promise<any>, msg: string, keys: any[]) =>
    fn()
      .then(() => {
        toast.success(msg);
        keys.forEach((k) => qc.invalidateQueries({ queryKey: Array.isArray(k) ? k : [k] }));
      })
      .catch((e: any) => toast.error(e.message));

  const addPolicy = () =>
    run(async () => {
      if (!policyForm.name.trim()) throw new Error("규정명을 입력하세요.");
      const { error } = await supabase.from("refund_policies").insert({
        name: policyForm.name.trim(), basis: policyForm.basis,
      });
      if (error) throw error;
      setPolicyForm({ name: "", basis: "days" });
    }, "환불 규정이 추가되었습니다.", ["refund-policies"]);

  const setDefault = (id: string) =>
    run(async () => {
      await supabase.from("refund_policies").update({ is_default: false }).neq("id", id);
      const { error } = await supabase.from("refund_policies").update({ is_default: true }).eq("id", id);
      if (error) throw error;
    }, "기본 규정으로 설정되었습니다.", ["refund-policies"]);

  const addRule = () =>
    run(async () => {
      if (!selectedPolicy) throw new Error("규정을 먼저 선택하세요.");
      const { error } = await supabase.from("refund_policy_rules").insert({
        policy_id: selectedPolicy,
        from_value: Number(ruleForm.from_value) || 0,
        to_value: ruleForm.to_value === "" ? null : Number(ruleForm.to_value),
        refund_percent: Number(ruleForm.refund_percent) || 0,
        order_index: rules.length,
      });
      if (error) throw error;
      setRuleForm({ from_value: "0", to_value: "", refund_percent: "100" });
    }, "구간이 추가되었습니다.", [["refund-policy-rules", selectedPolicy]]);

  const decide = (row: any, approve: boolean) =>
    run(async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("refund_requests").update({
        status: approve ? "approved" : "rejected",
        final_amount: approve ? row.calculated_amount : 0,
        admin_note: note[row.id] ?? row.admin_note,
        processed_by: u.user?.id ?? null,
        processed_at: new Date().toISOString(),
      }).eq("id", row.id);
      if (error) throw error;
      if (approve && row.enrollment_id) {
        await supabase.from("enrollments").update({ status: "rejected" }).eq("id", row.enrollment_id);
      }
    }, approve ? "환불이 승인되었습니다." : "환불이 반려되었습니다.", ["refund-requests"]);

  const del = (table: "refund_policies" | "refund_policy_rules", id: string, key: any) =>
    run(async () => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    }, "삭제되었습니다.", [key]);

  const basisLabel = (b: string) => (b === "progress" ? "진도율(%)" : "경과일(일)");

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <Receipt className="h-6 w-6" /> 환불 관리
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            경과일 또는 진도율 구간별 환불 규정을 설정하고, 환불 요청을 처리합니다.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="requests">환불 요청 ({requests.filter((r) => r.status === "requested").length})</TabsTrigger>
            <TabsTrigger value="policies">환불 규정</TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="space-y-3">
            <div className="border rounded-xl divide-y">
              {requests.map((r) => (
                <div key={r.id} className="p-4 space-y-2 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{r.profiles?.full_name || "-"}</span>
                    <span className="text-xs text-muted-foreground truncate">{r.profiles?.email}</span>
                    <Badge variant="outline" className="whitespace-nowrap">{r.courses?.title || "-"}</Badge>
                    <Badge
                      variant={r.status === "requested" ? "default" : r.status === "approved" ? "secondary" : "outline"}
                      className="whitespace-nowrap"
                    >
                      {r.status === "requested" ? "접수" : r.status === "approved" ? "승인" : "반려"}
                    </Badge>
                    <span className="ml-auto text-xs text-muted-foreground">{fmt(r.created_at)}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    결제 {won(r.paid_amount)} · 환불율 {r.refund_percent}% · 예상 환불 {won(r.calculated_amount)}
                    {" · "}경과 {r.elapsed_days}일 · 진도 {Math.round(Number(r.progress_percent) || 0)}%
                  </div>
                  {r.reason && <p className="text-sm">사유: {r.reason}</p>}
                  {r.status === "requested" && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Textarea
                        value={note[r.id] ?? ""}
                        onChange={(e) => setNote({ ...note, [r.id]: e.target.value })}
                        placeholder="관리자 메모"
                        className="min-h-[38px] flex-1"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => decide(r, true)}><Check className="h-4 w-4 mr-1" /> 승인</Button>
                        <Button size="sm" variant="outline" onClick={() => decide(r, false)}><X className="h-4 w-4 mr-1" /> 반려</Button>
                      </div>
                    </div>
                  )}
                  {r.admin_note && r.status !== "requested" && (
                    <p className="text-xs text-muted-foreground">메모: {r.admin_note}</p>
                  )}
                </div>
              ))}
              {requests.length === 0 && <p className="p-6 text-sm text-muted-foreground text-center">환불 요청이 없습니다.</p>}
            </div>
          </TabsContent>

          <TabsContent value="policies" className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3 items-end">
              <div className="min-w-0">
                <Label>규정명</Label>
                <Input value={policyForm.name} onChange={(e) => setPolicyForm({ ...policyForm, name: e.target.value })} placeholder="예) 일반 환불 규정" />
              </div>
              <div className="min-w-0">
                <Label>기준</Label>
                <Select value={policyForm.basis} onValueChange={(v) => setPolicyForm({ ...policyForm, basis: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">경과일 기준</SelectItem>
                    <SelectItem value="progress">진도율 기준</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addPolicy}><Plus className="h-4 w-4 mr-1" /> 규정 추가</Button>
            </div>

            <div className="border rounded-xl divide-y">
              {policies.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3 min-w-0">
                  <span className="font-medium truncate">{p.name}</span>
                  <Badge variant="outline" className="whitespace-nowrap">{basisLabel(p.basis)}</Badge>
                  {p.is_default && <Badge className="whitespace-nowrap">기본</Badge>}
                  <div className="ml-auto flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setSelectedPolicy(p.id)}>구간 설정</Button>
                    {!p.is_default && <Button size="sm" variant="ghost" onClick={() => setDefault(p.id)}>기본으로</Button>}
                    <Button size="sm" variant="ghost" onClick={() => del("refund_policies", p.id, "refund-policies")}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {policies.length === 0 && <p className="p-6 text-sm text-muted-foreground text-center">등록된 규정이 없습니다.</p>}
            </div>

            {selectedPolicy && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold">
                  구간 설정 — {policies.find((p) => p.id === selectedPolicy)?.name}
                </h2>
                <div className="grid gap-3 sm:grid-cols-4 items-end">
                  <div className="min-w-0">
                    <Label>시작 값(이상)</Label>
                    <Input type="number" value={ruleForm.from_value} onChange={(e) => setRuleForm({ ...ruleForm, from_value: e.target.value })} />
                  </div>
                  <div className="min-w-0">
                    <Label>끝 값(미만, 비우면 무제한)</Label>
                    <Input type="number" value={ruleForm.to_value} onChange={(e) => setRuleForm({ ...ruleForm, to_value: e.target.value })} />
                  </div>
                  <div className="min-w-0">
                    <Label>환불율(%)</Label>
                    <Input type="number" value={ruleForm.refund_percent} onChange={(e) => setRuleForm({ ...ruleForm, refund_percent: e.target.value })} />
                  </div>
                  <Button onClick={addRule}><Plus className="h-4 w-4 mr-1" /> 구간 추가</Button>
                </div>
                <div className="border rounded-xl divide-y">
                  {rules.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 p-3 min-w-0">
                      <span className="truncate">
                        {r.from_value} ~ {r.to_value ?? "∞"}
                      </span>
                      <Badge variant="secondary" className="whitespace-nowrap">{r.refund_percent}% 환불</Badge>
                      <Button size="sm" variant="ghost" className="ml-auto"
                        onClick={() => del("refund_policy_rules", r.id, ["refund-policy-rules", selectedPolicy])}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {rules.length === 0 && <p className="p-6 text-sm text-muted-foreground text-center">구간이 없습니다.</p>}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminRefunds;
