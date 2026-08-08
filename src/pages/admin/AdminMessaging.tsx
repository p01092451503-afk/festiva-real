import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Plus, Trash2, Play, Power, Pencil, Eye } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

const CHANNELS = [
  { value: "email", label: "이메일" },
  { value: "sms", label: "SMS" },
  { value: "alimtalk", label: "알림톡" },
  { value: "system", label: "앱 알림" },
];

const CONDITIONS = [
  { value: "not_started", label: "미수강(진도 0%)" },
  { value: "incomplete", label: "미완료(수강 중)" },
  { value: "progress_below", label: "진도율 미달(%)" },
  { value: "inactive_days", label: "미접속 일수" },
];

const NEEDS_THRESHOLD = ["progress_below", "inactive_days"];

const VARIABLES = ["{{name}}", "{{course}}", "{{progress}}"];

const channelLabel = (v: string) => CHANNELS.find((c) => c.value === v)?.label ?? v;
const conditionLabel = (v: string) => CONDITIONS.find((c) => c.value === v)?.label ?? v;
const fmtDT = (v?: string | null) => (v ? new Date(v).toLocaleString("ko-KR") : "-");

type TemplateForm = { id?: string; name: string; channel: string; subject: string; body: string };
type RuleForm = {
  id?: string;
  name: string;
  condition_type: string;
  threshold: string;
  channel: string;
  template_id: string;
  course_id: string;
  cooldown_days: string;
};

const EMPTY_TPL: TemplateForm = { name: "", channel: "email", subject: "", body: "" };
const EMPTY_RULE: RuleForm = {
  name: "",
  condition_type: "not_started",
  threshold: "50",
  channel: "system",
  template_id: "",
  course_id: "",
  cooldown_days: "7",
};

/** 발송 템플릿 관리 · 학습독려 자동화 · 발송 로그 */
const AdminMessaging = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState("templates");
  const [tplForm, setTplForm] = useState<TemplateForm>(EMPTY_TPL);
  const [tplOpen, setTplOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState<RuleForm>(EMPTY_RULE);
  const [ruleOpen, setRuleOpen] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ["message-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_templates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["nudge-courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, title").order("title");
      return (data as any[]) || [];
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

  /* ---------- 템플릿 ---------- */
  const openNewTpl = () => { setTplForm(EMPTY_TPL); setTplOpen(true); };
  const openEditTpl = (t: any) => {
    setTplForm({ id: t.id, name: t.name, channel: t.channel, subject: t.subject ?? "", body: t.body });
    setTplOpen(true);
  };

  const saveTemplate = () =>
    run(async () => {
      if (!tplForm.name.trim() || !tplForm.body.trim()) throw new Error("템플릿명과 본문을 입력하세요.");
      const payload = {
        name: tplForm.name.trim(),
        channel: tplForm.channel,
        subject: tplForm.subject.trim() || null,
        body: tplForm.body,
        variables: detectVars(`${tplForm.body} ${tplForm.subject}`),
      };
      const { error } = tplForm.id
        ? await supabase.from("message_templates").update(payload).eq("id", tplForm.id)
        : await supabase.from("message_templates").insert(payload);
      if (error) throw error;
      setTplOpen(false);
      setTplForm(EMPTY_TPL);
    }, tplForm.id ? "템플릿이 수정되었습니다." : "템플릿이 추가되었습니다.", ["message-templates"]);

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

  const previewBody = (text: string) =>
    text
      .replace(/\{\{\s*name\s*\}\}/g, "홍길동")
      .replace(/\{\{\s*course\s*\}\}/g, "실무 영어 회화")
      .replace(/\{\{\s*progress\s*\}\}/g, "35");

  /* ---------- 학습독려 규칙 ---------- */
  const openNewRule = () => { setRuleForm(EMPTY_RULE); setRuleOpen(true); };
  const openEditRule = (r: any) => {
    setRuleForm({
      id: r.id,
      name: r.name,
      condition_type: r.condition_type,
      threshold: String(r.threshold ?? 0),
      channel: r.channel,
      template_id: r.template_id ?? "",
      course_id: r.course_id ?? "",
      cooldown_days: String(r.cooldown_days ?? 7),
    });
    setRuleOpen(true);
  };

  const saveRule = () =>
    run(async () => {
      if (!ruleForm.name.trim()) throw new Error("규칙명을 입력하세요.");
      const payload = {
        name: ruleForm.name.trim(),
        condition_type: ruleForm.condition_type,
        threshold: NEEDS_THRESHOLD.includes(ruleForm.condition_type) ? Number(ruleForm.threshold) || 0 : 0,
        channel: ruleForm.channel,
        template_id: ruleForm.template_id || null,
        course_id: ruleForm.course_id || null,
        cooldown_days: Number(ruleForm.cooldown_days) || 0,
      };
      const { error } = ruleForm.id
        ? await supabase.from("learning_nudge_rules").update(payload).eq("id", ruleForm.id)
        : await supabase.from("learning_nudge_rules").insert(payload);
      if (error) throw error;
      setRuleOpen(false);
      setRuleForm(EMPTY_RULE);
    }, ruleForm.id ? "규칙이 수정되었습니다." : "규칙이 추가되었습니다.", ["nudge-rules"]);

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

  const invokeNudge = (ruleId: string, dryRun: boolean) =>
    run(async () => {
      const { data, error } = await supabase.functions.invoke("run-learning-nudge", {
        body: { rule_id: ruleId, dry_run: dryRun },
      });
      if (error) throw error;
      const first = data?.results?.[0];
      if (dryRun) {
        toast.message(`발송 대상 ${first?.would_send ?? 0}명`);
      } else {
        toast.message(`대상 ${first?.targets ?? 0}명 중 ${data?.sent ?? 0}명 발송 완료`);
      }
    }, dryRun ? "대상자를 확인했습니다." : "학습독려 발송을 실행했습니다.", ["nudge-rules", "message-logs"]);

  const successRate = logs.length
    ? Math.round((logs.filter((l) => l.status === "sent").length / logs.length) * 100)
    : 0;

  const courseTitle = (id?: string | null) => (id ? courses.find((c) => c.id === id)?.title ?? "-" : "전체 과정");

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
            발송 관리
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            이메일·SMS·알림톡·앱 알림 템플릿을 만들고 수정하며, 미수강·미완료 학습자에게 자동으로 발송합니다.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="templates">발송 템플릿</TabsTrigger>
            <TabsTrigger value="nudge">학습독려 자동화</TabsTrigger>
            <TabsTrigger value="logs">발송 로그</TabsTrigger>
          </TabsList>

          {/* 템플릿 */}
          <TabsContent value="templates" className="space-y-4 pt-4">
            <div className="flex justify-between items-center gap-3">
              <p className="text-xs text-muted-foreground">
                사용 가능한 변수: {VARIABLES.join(" · ")}
              </p>
              <Button onClick={openNewTpl}><Plus className="h-4 w-4 mr-1" />템플릿 추가</Button>
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
                    <Button variant="outline" size="sm" onClick={() => openEditTpl(t)}>
                      <Pencil className="h-4 w-4 mr-1" />수정
                    </Button>
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

          {/* 학습독려 */}
          <TabsContent value="nudge" className="space-y-4 pt-4">
            <div className="flex justify-between items-center gap-3">
              <p className="text-xs text-muted-foreground">
                조건에 해당하는 수강생에게 자동 발송됩니다. 재발송 방지 기간 내 중복 발송은 제외됩니다.
              </p>
              <Button onClick={openNewRule}><Plus className="h-4 w-4 mr-1" />규칙 추가</Button>
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
                      <Badge variant="outline" className="whitespace-nowrap">{courseTitle(r.course_id)}</Badge>
                      {!r.is_active && <Badge variant="outline">중지</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {conditionLabel(r.condition_type)}
                      {NEEDS_THRESHOLD.includes(r.condition_type) ? ` · 기준 ${r.threshold}` : ""}
                      {` · 재발송 방지 ${r.cooldown_days ?? 0}일`}
                      {` · 최근 실행 ${fmtDT(r.last_run_at)}`}
                      {r.last_run_at ? ` (${r.last_sent_count ?? 0}건)` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => invokeNudge(r.id, true)}>
                      <Eye className="h-4 w-4 mr-1" />대상 확인
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => invokeNudge(r.id, false)}>
                      <Play className="h-4 w-4 mr-1" />지금 발송
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEditRule(r)}>
                      <Pencil className="h-4 w-4 mr-1" />수정
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

          {/* 로그 */}
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
                    <p className="text-xs text-muted-foreground truncate">
                      {l.recipient_address || l.recipient_user_id || "-"} · {fmtDT(l.sent_at)}
                      {l.source ? ` · ${l.source}` : ""}
                      {l.error_message ? ` · ${l.error_message}` : ""}
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

      {/* 템플릿 작성/수정 */}
      <Dialog open={tplOpen} onOpenChange={setTplOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{tplForm.id ? "템플릿 수정" : "새 템플릿"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <Label className="text-xs">템플릿명</Label>
                <Input value={tplForm.name} onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })} />
              </div>
              <div className="min-w-0">
                <Label className="text-xs">채널</Label>
                <Select value={tplForm.channel} onValueChange={(v) => setTplForm({ ...tplForm, channel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">제목(이메일·알림 제목)</Label>
              <Input value={tplForm.subject} onChange={(e) => setTplForm({ ...tplForm, subject: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">본문 · 변수 {VARIABLES.join(" ")}</Label>
              <Textarea
                rows={5}
                value={tplForm.body}
                onChange={(e) => setTplForm({ ...tplForm, body: e.target.value })}
                placeholder="{{name}}님, {{course}} 과정 진도율이 {{progress}}%입니다. 학습을 이어가 주세요."
              />
            </div>
            {tplForm.body && (
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-[11px] text-muted-foreground mb-1">미리보기</p>
                {tplForm.subject && <p className="text-sm font-medium">{previewBody(tplForm.subject)}</p>}
                <p className="text-sm whitespace-pre-wrap">{previewBody(tplForm.body)}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTplOpen(false)}>취소</Button>
            <Button onClick={saveTemplate}>{tplForm.id ? "수정 저장" : "추가"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 규칙 작성/수정 */}
      <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{ruleForm.id ? "학습독려 규칙 수정" : "새 학습독려 규칙"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <Label className="text-xs">규칙명</Label>
                <Input value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })} />
              </div>
              <div className="min-w-0">
                <Label className="text-xs">트리거 조건</Label>
                <Select value={ruleForm.condition_type} onValueChange={(v) => setRuleForm({ ...ruleForm, condition_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {NEEDS_THRESHOLD.includes(ruleForm.condition_type) && (
                <div className="min-w-0">
                  <Label className="text-xs">기준값</Label>
                  <Input type="number" value={ruleForm.threshold} onChange={(e) => setRuleForm({ ...ruleForm, threshold: e.target.value })} />
                </div>
              )}
              <div className="min-w-0">
                <Label className="text-xs">발송 채널</Label>
                <Select value={ruleForm.channel} onValueChange={(v) => setRuleForm({ ...ruleForm, channel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0">
                <Label className="text-xs">템플릿</Label>
                <Select value={ruleForm.template_id} onValueChange={(v) => setRuleForm({ ...ruleForm, template_id: v })}>
                  <SelectTrigger><SelectValue placeholder="기본 문구 사용" /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0">
                <Label className="text-xs">대상 과정</Label>
                <Select value={ruleForm.course_id} onValueChange={(v) => setRuleForm({ ...ruleForm, course_id: v })}>
                  <SelectTrigger><SelectValue placeholder="전체 과정" /></SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0">
                <Label className="text-xs">재발송 방지(일)</Label>
                <Input type="number" value={ruleForm.cooldown_days} onChange={(e) => setRuleForm({ ...ruleForm, cooldown_days: e.target.value })} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              활성화된 규칙은 매일 오전 9시(한국시간)에 자동 실행됩니다.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleOpen(false)}>취소</Button>
            <Button onClick={saveRule}>{ruleForm.id ? "수정 저장" : "추가"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminMessaging;
