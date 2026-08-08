import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Plus, Trash2, Play, Power } from "lucide-react";
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

const CHANNELS = [
  { value: "email", label: "이메일" },
  { value: "sms", label: "SMS" },
  { value: "alimtalk", label: "알림톡" },
  { value: "system", label: "시스템 알림" },
];

const CONDITIONS = [
  { value: "progress_below", label: "진도율 미달(%)" },
  { value: "inactive_days", label: "미접속 일수" },
  { value: "deadline_near", label: "종료 임박(일)" },
];

const channelLabel = (v: string) => CHANNELS.find((c) => c.value === v)?.label ?? v;
const fmtDT = (v?: string | null) => (v ? new Date(v).toLocaleString("ko-KR") : "-");

/** 발송 템플릿 · 발송 로그 · 학습독려 자동화 */
const AdminMessaging = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState("templates");
  const [tpl, setTpl] = useState({ name: "", channel: "email", subject: "", body: "" });
  const [rule, setRule] = useState({
    name: "",
    condition_type: "progress_below",
    threshold: "50",
    channel: "system",
    template_id: "",
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["message-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_templates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["message-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_logs").select("*").order("sent_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: rules = [] } = useQuery({
    queryKey: ["nudge-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_nudge_rules").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const run = (fn: () => Promise<any>, msg: string, keys: string[]) =>
    fn()
      .then(() => {
        toast.success(msg);
        keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      })
      .catch((e: any) => toast.error(e.message));

  const detectVars = (text: string) =>
    Array.from(new Set((text.match(/\{\{\s*[\w.]+\s*\}\}/g) || []).map((m) => m.replace(/[{}\s]/g, ""))));

  const addTemplate = () =>
    run(async () => {
      if (!tpl.name.trim() || !tpl.body.trim()) throw new Error("템플릿명과 본문을 입력하세요.");
      const { error } = await supabase.from("message_templates").insert({
        name: tpl.name.trim(),
        channel: tpl.channel,
        subject: tpl.subject.trim() || null,
        body: tpl.body,
        variables: detectVars(tpl.body + " " + tpl.subject),
      });
      if (error) throw error;
      setTpl({ name: "", channel: "email", subject: "", body: "" });
    }, "템플릿이 추가되었습니다.", ["message-templates"]);

  const toggleTemplate = (id: string, next: boolean) =>
    run(async () => {
      const { error } = await supabase.from("message_templates").update({ is_active: next }).eq("id", id);
      if (error) throw error;
    }, "상태가 변경되었습니다.", ["message-templates"]);

  const removeTemplate = (id: string) =>
    run(async () => {
      const { error } = await supabase.from("message_templates").delete().eq("id", id);
      if (error) throw error;
    }, "삭제되었습니다.", ["message-templates"]);

  const addRule = () =>
    run(async () => {
      if (!rule.name.trim()) throw new Error("규칙명을 입력하세요.");
      const { error } = await supabase.from("learning_nudge_rules").insert({
        name: rule.name.trim(),
        condition_type: rule.condition_type,
        threshold: Number(rule.threshold) || 0,
        channel: rule.channel,
        template_id: rule.template_id || null,
      });
      if (error) throw error;
      setRule({ name: "", condition_type: "progress_below", threshold: "50", channel: "system", template_id: "" });
    }, "학습독려 규칙이 추가되었습니다.", ["nudge-rules"]);

  const toggleRule = (id: string, next: boolean) =>
    run(async () => {
      const { error } = await supabase.from("learning_nudge_rules").update({ is_active: next }).eq("id", id);
      if (error) throw error;
    }, "상태가 변경되었습니다.", ["nudge-rules"]);

  const removeRule = (id: string) =>
    run(async () => {
      const { error } = await supabase.from("learning_nudge_rules").delete().eq("id", id);
      if (error) throw error;
    }, "삭제되었습니다.", ["nudge-rules"]);

  const runRule = (id: string) =>
    run(async () => {
      const { data, error } = await supabase.functions.invoke("run-learning-nudge", { body: { rule_id: id } });
      if (error) throw error;
      toast.message(`${data?.sent ?? 0}명에게 발송되었습니다.`);
    }, "학습독려 발송을 실행했습니다.", ["nudge-rules", "message-logs"]);

  const successRate = logs.length
    ? Math.round((logs.filter((l) => l.status === "sent").length / logs.length) * 100)
    : 0;

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
            발송 관리
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            메일·SMS·알림톡 템플릿을 관리하고, 학습독려 자동 발송과 발송 로그를 확인합니다.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="templates">발송 템플릿</TabsTrigger>
            <TabsTrigger value="nudge">학습독려 자동화</TabsTrigger>
            <TabsTrigger value="logs">발송 로그</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="space-y-6 pt-4">
            <div className="border rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium">새 템플릿</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="min-w-0">
                  <Label className="text-xs">템플릿명</Label>
                  <Input value={tpl.name} onChange={(e) => setTpl({ ...tpl, name: e.target.value })} />
                </div>
                <div className="min-w-0">
                  <Label className="text-xs">채널</Label>
                  <Select value={tpl.channel} onValueChange={(v) => setTpl({ ...tpl, channel: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHANNELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0">
                  <Label className="text-xs">제목(메일)</Label>
                  <Input value={tpl.subject} onChange={(e) => setTpl({ ...tpl, subject: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">본문 · 변수는 {"{{name}}"} 형식으로 입력</Label>
                <Textarea
                  rows={4}
                  value={tpl.body}
                  onChange={(e) => setTpl({ ...tpl, body: e.target.value })}
                  placeholder="{{name}}님, {{course}} 진도율이 {{progress}}%입니다. 학습을 이어가 주세요."
                />
              </div>
              <Button onClick={addTemplate}><Plus className="h-4 w-4 mr-1" />템플릿 추가</Button>
            </div>

            <div className="border rounded-lg divide-y">
              {templates.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">등록된 템플릿이 없습니다.</p>
              )}
              {templates.map((t) => (
                <div key={t.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 border-b-2 border-border/80 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{t.name}</span>
                      <Badge variant="secondary" className="whitespace-nowrap">{channelLabel(t.channel)}</Badge>
                      {!t.is_active && <Badge variant="outline">비활성</Badge>}
                    </div>
                    {t.subject && <p className="text-xs text-muted-foreground mt-1">{t.subject}</p>}
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.body}</p>
                    {t.variables?.length > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-1">변수: {t.variables.join(", ")}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => toggleTemplate(t.id, !t.is_active)}>
                      <Power className="h-4 w-4 mr-1" />{t.is_active ? "비활성화" : "활성화"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => removeTemplate(t.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="nudge" className="space-y-6 pt-4">
            <div className="border rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium">새 학습독려 규칙</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="min-w-0">
                  <Label className="text-xs">규칙명</Label>
                  <Input value={rule.name} onChange={(e) => setRule({ ...rule, name: e.target.value })} />
                </div>
                <div className="min-w-0">
                  <Label className="text-xs">조건</Label>
                  <Select value={rule.condition_type} onValueChange={(v) => setRule({ ...rule, condition_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONDITIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0">
                  <Label className="text-xs">기준값</Label>
                  <Input type="number" value={rule.threshold} onChange={(e) => setRule({ ...rule, threshold: e.target.value })} />
                </div>
                <div className="min-w-0">
                  <Label className="text-xs">채널</Label>
                  <Select value={rule.channel} onValueChange={(v) => setRule({ ...rule, channel: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHANNELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0">
                  <Label className="text-xs">템플릿</Label>
                  <Select value={rule.template_id} onValueChange={(v) => setRule({ ...rule, template_id: v })}>
                    <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={addRule}><Plus className="h-4 w-4 mr-1" />규칙 추가</Button>
            </div>

            <div className="border rounded-lg divide-y">
              {rules.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">등록된 규칙이 없습니다.</p>
              )}
              {rules.map((r) => (
                <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 border-b-2 border-border/80 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{r.name}</span>
                      <Badge variant="secondary" className="whitespace-nowrap">{channelLabel(r.channel)}</Badge>
                      {!r.is_active && <Badge variant="outline">중지</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {CONDITIONS.find((c) => c.value === r.condition_type)?.label} · 기준 {r.threshold} · 최근 실행 {fmtDT(r.last_run_at)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => runRule(r.id)}>
                      <Play className="h-4 w-4 mr-1" />지금 발송
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => toggleRule(r.id, !r.is_active)}>
                      <Power className="h-4 w-4 mr-1" />{r.is_active ? "중지" : "시작"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => removeRule(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4 pt-4">
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>최근 {logs.length}건</span>
              <span>성공률 {successRate}%</span>
            </div>
            <div className="border rounded-lg divide-y">
              {logs.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">발송 로그가 없습니다.</p>
              )}
              {logs.map((l) => (
                <div key={l.id} className="p-3 flex items-center gap-3 border-b-2 border-border/80 last:border-b-0">
                  <Badge variant="secondary" className="whitespace-nowrap">{channelLabel(l.channel)}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{l.subject || l.body}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.recipient_address || l.recipient_user_id || "-"} · {fmtDT(l.sent_at)}
                      {l.source ? ` · ${l.source}` : ""}
                    </p>
                  </div>
                  <Badge variant={l.status === "sent" ? "default" : "destructive"} className="whitespace-nowrap">
                    {l.status === "sent" ? "성공" : l.status === "queued" ? "대기" : "실패"}
                  </Badge>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminMessaging;
