import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Code2, Plus, Copy, Check, RefreshCw, Power, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layouts/DashboardLayout";

const ALL_GRANTS = ["client_credentials", "password", "authorization_code", "refresh_token"] as const;
const ALL_SCOPES = [
  "member:read", "member:write", "lecture:read",
  "progress:read", "progress:write", "product:read", "order:read",
] as const;

interface OAuthClient {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  grant_types: string[];
  scopes: string[];
  redirect_uris: string[];
  is_active: boolean;
  created_at: string;
}

export default function ApiClients() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [secretView, setSecretView] = useState<{ clientId: string; secret: string } | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["oauth-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oauth_clients" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as OAuthClient[];
    },
  });

  const callAdmin = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("oauth-admin-clients", { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handleRotate = async (clientId: string) => {
    if (!confirm("재발급 시 기존 시크릿은 즉시 무효화되고 발급된 모든 토큰이 폐기됩니다. 진행하시겠습니까?")) return;
    try {
      const res = await callAdmin({ action: "rotate", client_id: clientId });
      setSecretView({ clientId: res.client_id, secret: res.client_secret });
      qc.invalidateQueries({ queryKey: ["oauth-clients"] });
    } catch (e: any) {
      toast({ title: "오류", description: e.message, variant: "destructive" });
    }
  };

  const handleToggle = async (c: OAuthClient) => {
    const { error } = await supabase
      .from("oauth_clients" as any)
      .update({ is_active: !c.is_active })
      .eq("id", c.id);
    if (error) toast({ title: "오류", description: error.message, variant: "destructive" });
    else qc.invalidateQueries({ queryKey: ["oauth-clients"] });
  };

  return (
    <DashboardLayout>
      <div className="px-4 sm:px-6 py-6 min-w-0">
        <div className="flex items-start justify-between mb-6 gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
              <Code2 className="h-6 w-6" /> API 클라이언트
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">외부 시스템 연동을 위한 OAuth2 클라이언트를 관리합니다.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button asChild variant="outline">
              <Link to="/admin/api-docs">
                <BookOpen className="h-4 w-4 mr-1" /> API 문서
              </Link>
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> 클라이언트 추가
            </Button>
          </div>
        </div>

        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-3 font-medium">이름</th>
                <th className="text-left px-4 py-3 font-medium">Client ID</th>
                <th className="text-left px-4 py-3 font-medium">Grant / Scope</th>
                <th className="text-left px-4 py-3 font-medium">상태</th>
                <th className="text-right px-4 py-3 font-medium">액션</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">로딩 중…</td></tr>}
              {!isLoading && clients.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">등록된 클라이언트가 없습니다.</td></tr>
              )}
              {clients.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.client_id}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.grant_types.map((g) => <Badge key={g} variant="secondary" className="text-[10px]">{g}</Badge>)}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.scopes.map((s) => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {c.is_active
                      ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">활성</Badge>
                      : <Badge variant="secondary">비활성</Badge>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleRotate(c.client_id)} title="시크릿 재발급">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleToggle(c)} title={c.is_active ? "비활성화" : "활성화"}>
                      <Power className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CreateClientDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(res) => {
          setCreateOpen(false);
          setSecretView({ clientId: res.client_id, secret: res.client_secret });
          qc.invalidateQueries({ queryKey: ["oauth-clients"] });
        }}
        onError={(msg) => toast({ title: "오류", description: msg, variant: "destructive" })}
        callAdmin={callAdmin}
      />

      <SecretOnceDialog data={secretView} onClose={() => setSecretView(null)} />
    </DashboardLayout>
  );
}

function CreateClientDialog({ open, onClose, onCreated, onError, callAdmin }: {
  open: boolean;
  onClose: () => void;
  onCreated: (res: any) => void;
  onError: (msg: string) => void;
  callAdmin: (body: any) => Promise<any>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [grants, setGrants] = useState<string[]>(["client_credentials"]);
  const [scopes, setScopes] = useState<string[]>(["member:read"]);
  const [redirects, setRedirects] = useState("");
  const [saving, setSaving] = useState(false);

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => {
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  };

  const submit = async () => {
    if (!name.trim()) return onError("이름을 입력해주세요");
    setSaving(true);
    try {
      const res = await callAdmin({
        action: "create", name, description,
        grant_types: grants, scopes,
        redirect_uris: redirects.split("\n").map((s) => s.trim()).filter(Boolean),
      });
      setName(""); setDescription(""); setRedirects("");
      setGrants(["client_credentials"]); setScopes(["member:read"]);
      onCreated(res);
    } catch (e: any) { onError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>API 클라이언트 추가</DialogTitle>
          <DialogDescription>외부 시스템 연동에 사용할 OAuth2 클라이언트를 등록합니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>이름 *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 모바일앱 연동" />
          </div>
          <div>
            <Label>설명</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div>
            <Label className="block mb-2">Grant 타입</Label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_GRANTS.map((g) => (
                <label key={g} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={grants.includes(g)} onCheckedChange={() => toggle(grants, setGrants, g)} />
                  <span className="font-mono text-xs">{g}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="block mb-2">Scope</Label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_SCOPES.map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={scopes.includes(s)} onCheckedChange={() => toggle(scopes, setScopes, s)} />
                  <span className="font-mono text-xs">{s}</span>
                </label>
              ))}
            </div>
          </div>
          {grants.includes("authorization_code") && (
            <div>
              <Label>Redirect URIs (줄바꿈 구분)</Label>
              <Textarea value={redirects} onChange={(e) => setRedirects(e.target.value)} rows={3} placeholder="https://example.com/callback" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>취소</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "생성 중…" : "생성"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SecretOnceDialog({ data, onClose }: { data: { clientId: string; secret: string } | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  if (!data) return null;
  const copy = async () => {
    await navigator.clipboard.writeText(data.secret);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Dialog open={!!data} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>클라이언트 시크릿</DialogTitle>
          <DialogDescription className="text-destructive">
            이 시크릿은 지금만 표시됩니다. 반드시 복사해서 안전한 곳에 보관하세요.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Client ID</Label>
            <div className="font-mono text-sm bg-muted/40 p-2 rounded mt-1 break-all">{data.clientId}</div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Client Secret</Label>
            <div className="flex gap-2 mt-1">
              <div className="flex-1 min-w-0 font-mono text-sm bg-muted/40 p-2 rounded break-all">{data.secret}</div>
              <Button variant="outline" size="sm" onClick={copy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>확인했습니다 — 창 닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}