import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const SCOPE_LABELS: Record<string, string> = {
  "lecture:read": "강의 정보 조회",
  "member:read": "회원 정보 조회",
  "progress:read": "학습 진도 조회",
  "progress:write": "학습 진도 기록",
  "order:read": "주문 정보 조회",
  "product:read": "상품 정보 조회",
};

export default function OAuthAuthorize() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading } = useUser();

  const clientId = params.get("client_id") || "";
  const redirectUri = params.get("redirect_uri") || "";
  const scope = params.get("scope") || "";
  const state = params.get("state") || "";
  const codeChallenge = params.get("code_challenge") || "";
  const codeChallengeMethod = params.get("code_challenge_method") || "";
  const responseType = params.get("response_type") || "code";

  const [client, setClient] = useState<{ client_id: string; name: string; scopes: string[]; redirect_uris: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const requestedScopes = useMemo(
    () => (scope.trim() ? scope.trim().split(/\s+/) : []),
    [scope],
  );

  useEffect(() => {
    if (!clientId) {
      setError("client_id가 누락되었습니다");
      setLoading(false);
      return;
    }
    if (responseType !== "code") {
      setError(`지원하지 않는 response_type: ${responseType}`);
      setLoading(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("oauth_clients")
        .select("client_id, name, scopes, redirect_uris, grant_types, is_active")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error || !data) {
        setError("등록되지 않은 클라이언트입니다");
      } else if (!data.is_active) {
        setError("비활성화된 클라이언트입니다");
      } else if (!data.grant_types?.includes("authorization_code")) {
        setError("authorization_code 그랜트가 허용되지 않은 클라이언트입니다");
      } else if (!data.redirect_uris?.includes(redirectUri)) {
        setError("등록되지 않은 redirect_uri 입니다");
      } else {
        setClient(data);
      }
      setLoading(false);
    })();
  }, [clientId, redirectUri, responseType]);

  const scopesToShow = requestedScopes.length > 0 ? requestedScopes : client?.scopes ?? [];

  const handleApprove = async () => {
    if (!user) {
      navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("oauth-authorize", {
        body: {
          client_id: clientId,
          redirect_uri: redirectUri,
          scope,
          state,
          code_challenge: codeChallenge || null,
          code_challenge_method: codeChallengeMethod || null,
        },
      });
      if (error) throw error;
      if (data?.redirect_uri) {
        window.location.href = data.redirect_uri;
        return;
      }
      throw new Error("redirect_uri 응답 누락");
    } catch (e: any) {
      toast({ title: "인가 실패", description: e?.message || "다시 시도해주세요", variant: "destructive" });
      setSubmitting(false);
    }
  };

  const handleDeny = () => {
    const sep = redirectUri.includes("?") ? "&" : "?";
    const url = `${redirectUri}${sep}error=access_denied${state ? `&state=${encodeURIComponent(state)}` : ""}`;
    window.location.href = url;
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md p-8 space-y-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <h1 className="text-lg font-semibold">인가 요청 오류</h1>
          </div>
          <p className="text-sm text-muted-foreground">{error}</p>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md p-8 space-y-4 text-center">
          <h1 className="text-lg font-semibold">로그인이 필요합니다</h1>
          <p className="text-sm text-muted-foreground">{client?.name} 에서 권한을 요청하고 있습니다.</p>
          <Button onClick={() => navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)} className="w-full">
            로그인하러 가기
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-lg w-full p-8 space-y-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">앱 접근 권한 요청</h1>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">다음 앱이 회원님의 계정 접근 권한을 요청합니다.</p>
          <p className="text-base font-medium">{client?.name}</p>
          <p className="text-xs text-muted-foreground break-all">client_id: {client?.client_id}</p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">요청 권한</p>
          <ul className="space-y-2">
            {scopesToShow.map((s) => (
              <li key={s} className="flex items-center justify-between border-b-2 border-border/80 pb-2">
                <span className="text-sm">{SCOPE_LABELS[s] || s}</span>
                <Badge variant="secondary" className="font-mono text-xs">{s}</Badge>
              </li>
            ))}
          </ul>
        </div>
        <div className="text-xs text-muted-foreground">
          승인 시 <span className="font-mono break-all">{redirectUri}</span> 로 인가 코드가 전달됩니다.
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={handleDeny} disabled={submitting}>
            거부
          </Button>
          <Button className="flex-1" onClick={handleApprove} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "승인"}
          </Button>
        </div>
      </Card>
    </div>
  );
}