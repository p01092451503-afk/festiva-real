import { useEffect, useState } from "react";
import { Bell, Save, Info } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { useFeatureModules } from "@/hooks/useFeatureModules";

const SETTINGS_LS_KEY = "closed-lms-sms-settings";

export default function AdminSmsSettings() {
  const { isEnabled, isLoading: modulesLoading } = useFeatureModules();
  const qc = useQueryClient();

  const [provider, setProvider] = useState("aligo");
  const [apiKey, setApiKey] = useState("");
  const [userId, setUserId] = useState("");
  const [sender, setSender] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_LS_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        setApiKey(s.api_key ?? "");
        setUserId(s.user_id ?? "");
        setSender(s.sender ?? "");
      }
    } catch {}
  }, []);

  const { data: templates = [] } = useQuery({
    queryKey: ["sms-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_templates")
        .select("*")
        .order("template_key");
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!modulesLoading && !isEnabled("closed_lms")) return <Navigate to="/admin" replace />;

  const saveCreds = () => {
    localStorage.setItem(SETTINGS_LS_KEY, JSON.stringify({ api_key: apiKey, user_id: userId, sender }));
    toast.success("설정이 저장되었습니다 (브라우저에 임시 저장 — API 연동 시 보안 저장소로 이전)");
  };

  const updateTemplate = async (id: string, body_template: string) => {
    const { error } = await supabase.from("sms_templates").update({ body_template }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("템플릿이 저장되었습니다");
    qc.invalidateQueries({ queryKey: ["sms-templates"] });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 min-w-0">
        <header className="space-y-1">
          <div className="flex items-center gap-2">
            <Bell className="w-6 h-6 text-muted-foreground" />
            <h1 className="text-xl sm:text-2xl font-semibold">SMS 설정</h1>
          </div>
          <p className="text-muted-foreground mt-1">알리고 SMS 발송 설정 및 메시지 템플릿을 관리합니다.</p>
        </header>

        <section className="stat-card space-y-4">
          <h2 className="font-medium">발신 정보 (알리고)</h2>
          <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 bg-muted/40 rounded border border-border/60">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              현재 API 연동은 <strong>준비 중</strong>입니다. 입력 값은 향후 안전한 비밀 저장소로 이전되며, 그 전에는 mock 발송으로 동작합니다.
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>제공자</Label>
              <Input value={provider} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>발신번호</Label>
              <Input value={sender} onChange={(e) => setSender(e.target.value)} placeholder="0212345678" />
            </div>
            <div className="space-y-1.5">
              <Label>알리고 User ID</Label>
              <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="aligo_id" />
            </div>
            <div className="space-y-1.5">
              <Label>알리고 API Key</Label>
              <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="api key" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveCreds}><Save className="w-4 h-4 mr-1" /> 저장</Button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-medium">메시지 템플릿</h2>
          <p className="text-xs text-muted-foreground">
            치환 변수: <code>{"{이름}"}</code> <code>{"{강의명}"}</code> <code>{"{링크}"}</code> <code>{"{아이디}"}</code> <code>{"{비번}"}</code> <code>{"{만료일}"}</code> <code>{"{사이트}"}</code>
          </p>
          {templates.map((t: any) => (
            <TemplateCard key={t.id} tpl={t} onSave={updateTemplate} />
          ))}
        </section>
      </div>
    </DashboardLayout>
  );
}

function TemplateCard({ tpl, onSave }: { tpl: any; onSave: (id: string, b: string) => void }) {
  const [body, setBody] = useState(tpl.body_template);
  return (
    <div className="stat-card space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-sm">{tpl.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{tpl.description}</p>
        </div>
        <code className="text-[10px] text-muted-foreground">{tpl.template_key}</code>
      </div>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className="font-mono text-xs" />
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => onSave(tpl.id, body)}>
          <Save className="w-3.5 h-3.5 mr-1" /> 저장
        </Button>
      </div>
    </div>
  );
}