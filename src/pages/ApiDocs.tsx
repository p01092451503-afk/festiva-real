import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Code2, Play, BookOpen, AlertTriangle, Link as LinkIcon } from "lucide-react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/layouts/DashboardLayout";

const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

interface ApiSpec {
  id: string;
  method: "GET" | "POST";
  path: string;
  scope: string;
  summary: string;
  params?: { name: string; in: "query" | "body"; required?: boolean; description?: string }[];
}

const APIS: ApiSpec[] = [
  {
    id: "lectures",
    method: "GET",
    path: "/api-lectures",
    scope: "lecture:read",
    summary: "강의(코스) 목록 조회",
    params: [
      { name: "limit", in: "query", description: "기본 50, 최대 200" },
      { name: "offset", in: "query", description: "기본 0" },
    ],
  },
  {
    id: "members",
    method: "GET",
    path: "/api-students",
    scope: "member:read",
    summary: "회원(학습자) 목록 조회",
    params: [
      { name: "search", in: "query", description: "이름/이메일 부분 검색" },
      { name: "department_id", in: "query" },
      { name: "limit", in: "query" },
      { name: "offset", in: "query" },
    ],
  },
  {
    id: "memberDetail",
    method: "GET",
    path: "/api-members-detail",
    scope: "member:read",
    summary: "회원 상세 정보",
    params: [{ name: "member_code", in: "query", required: true, description: "회원 user_id" }],
  },
  {
    id: "orders",
    method: "GET",
    path: "/api-orders",
    scope: "order:read",
    summary: "주문 목록 조회",
    params: [
      { name: "status", in: "query", description: "pending/paid/cancelled" },
      { name: "member_code", in: "query" },
    ],
  },
  {
    id: "progressRead",
    method: "GET",
    path: "/api-progress",
    scope: "progress:read",
    summary: "학습 진도 조회",
    params: [
      { name: "member_code", in: "query" },
      { name: "lecture_code", in: "query" },
    ],
  },
  {
    id: "progressWrite",
    method: "POST",
    path: "/api-progress",
    scope: "progress:write",
    summary: "학습 진도 업데이트",
    params: [
      { name: "member_code", in: "body", required: true },
      { name: "lecture_code", in: "body", required: true },
      { name: "progress", in: "body", required: true, description: "0~100" },
    ],
  },
];

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="rounded-md bg-muted p-3 text-xs overflow-auto border">
      <code>{children}</code>
    </pre>
  );
}

export default function ApiDocs() {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [scope, setScope] = useState("lecture:read");
  const [token, setToken] = useState("");
  const [tokenResp, setTokenResp] = useState("");
  const [tryParams, setTryParams] = useState<Record<string, Record<string, string>>>({});
  const [tryResp, setTryResp] = useState<Record<string, string>>({});

  const issueToken = async () => {
    setTokenResp("요청 중...");
    try {
      const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope,
      });
      const r = await fetch(`${FN_BASE}/oauth-token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      const j = await r.json();
      setTokenResp(JSON.stringify(j, null, 2));
      if (j.access_token) setToken(j.access_token);
    } catch (e: any) {
      setTokenResp(`Error: ${e.message}`);
    }
  };

  const runApi = async (api: ApiSpec) => {
    const params = tryParams[api.id] || {};
    setTryResp((s) => ({ ...s, [api.id]: "요청 중..." }));
    try {
      let url = `${FN_BASE}${api.path}`;
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      let body: string | undefined;
      if (api.method === "GET") {
        const qp = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => v && qp.append(k, v));
        const qs = qp.toString();
        if (qs) url += `?${qs}`;
      } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(params);
      }
      const r = await fetch(url, { method: api.method, headers, body });
      const j = await r.json();
      setTryResp((s) => ({ ...s, [api.id]: JSON.stringify(j, null, 2) }));
    } catch (e: any) {
      setTryResp((s) => ({ ...s, [api.id]: `Error: ${e.message}` }));
    }
  };

  return (
    <DashboardLayout>
    <div className="w-full p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <BookOpen className="h-6 w-6" /> AI LMS OAuth2 RESTful API — 사용 가이드
        </h1>
        <p className="text-muted-foreground text-sm">개발 연동을 위한 한글 안내 및 인터랙티브 콘솔.</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="outline" className="font-mono">Base: {FN_BASE}</Badge>
          <Link to="/admin/api-clients">
            <Badge className="cursor-pointer">클라이언트 발급(관리자)</Badge>
          </Link>
        </div>
      </header>

      <Tabs defaultValue="guide" className="w-full">
        <TabsList>
          <TabsTrigger value="guide">사용 가이드</TabsTrigger>
          <TabsTrigger value="auth">Try it out · 토큰</TabsTrigger>
          <TabsTrigger value="endpoints">Try it out · API</TabsTrigger>
        </TabsList>

        <TabsContent value="guide" className="space-y-6">
          {/* 1. 개요 */}
          <Card>
            <CardHeader><CardTitle className="text-base">1. 개요</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <ul className="list-disc pl-5 space-y-1">
                <li><b>인증 방식:</b> OAuth2 (Bearer 토큰). 모든 보호 엔드포인트는 <code className="bg-muted px-1 rounded">Authorization: Bearer &lt;access_token&gt;</code> 헤더 필요.</li>
                <li><b>토큰 형식:</b> JWT (HS256), 만료 기본 <b>15분(900초)</b>. 만료 시 refresh 토큰으로 재발급.</li>
                <li><b>Base URL:</b> <code className="bg-muted px-1 rounded">{FN_BASE}</code></li>
                <li><b>응답 포맷:</b> 보호 API는 <code className="bg-muted px-1 rounded">{`{"code":"00|11|99","data":...}`}</code> + 실제 HTTP 상태코드. 토큰 발급(<code>/oauth-token</code>)은 OAuth 표준 포맷.</li>
              </ul>
            </CardContent>
          </Card>

          {/* 2. 사전 준비 */}
          <Card>
            <CardHeader><CardTitle className="text-base">2. 사전 준비 — 클라이언트 발급</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-3">
              <p>
                관리자 콘솔 <code>설정 → API 클라이언트</code>(<Link to="/admin/api-clients" className="underline">바로가기</Link>)에서 클라이언트를 생성하면{" "}
                <code>client_id</code>와 <code>client_secret</code>(생성 시 <b>1회만</b> 표시)을 받습니다. 필요한 grant 타입과 scope를 함께 지정하세요.
              </p>
              <div className="flex gap-2 items-start rounded-md border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 p-3">
                <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
                <p className="text-xs">
                  <code>client_secret</code>은 생성 직후 한 번만 노출됩니다. 분실 시 "시크릿 재발급"으로 다시 발급하세요 (기존 시크릿 즉시 무효화).
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 3. Scope */}
          <Card>
            <CardHeader><CardTitle className="text-base">3. Scope (권한 범위)</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <p className="mb-2">토큰에 부여된 scope만큼만 호출할 수 있습니다. 부족하면 <code>403 insufficient_scope</code>.</p>
              <table className="w-full text-sm border">
                <thead className="bg-muted">
                  <tr><th className="text-left p-2 font-medium">scope</th><th className="text-left p-2 font-medium">설명</th></tr>
                </thead>
                <tbody>
                  {[
                    ["member:read", "회원 조회"],
                    ["member:write", "회원 생성/수정 (예정)"],
                    ["lecture:read", "강의 조회"],
                    ["progress:read", "진도율 조회"],
                    ["progress:write", "진도율 저장"],
                    ["product:read", "상품 조회"],
                    ["order:read", "주문 조회"],
                  ].map(([k, v]) => (
                    <tr key={k} className="border-t">
                      <td className="p-2 font-mono text-xs">{k}</td>
                      <td className="p-2">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* 4. Grant types */}
          <Card>
            <CardHeader><CardTitle className="text-base">4. 토큰 받기 (grant 타입별)</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-5">
              <div>
                <p className="font-medium mb-1">① client_credentials — 서버 간 연동 (M2M)</p>
                <p className="text-muted-foreground mb-2">사람 로그인 없이 서버끼리 연동할 때. 가장 많이 쓰입니다.</p>
                <CodeBlock>{`curl -X POST ${FN_BASE}/oauth-token \\
  -d "grant_type=client_credentials" \\
  -d "client_id=CLIENT_ID" -d "client_secret=CLIENT_SECRET" \\
  -d "scope=product:read"`}</CodeBlock>
              </div>

              <div>
                <p className="font-medium mb-1">② password — 회원 본인 자격으로</p>
                <p className="text-muted-foreground mb-2">회원의 ID/비밀번호로 그 회원 권한의 토큰을 발급. (모바일앱·자체 SPA 등)</p>
                <CodeBlock>{`curl -X POST ${FN_BASE}/oauth-token \\
  -d "grant_type=password" \\
  -d "client_id=CLIENT_ID" -d "client_secret=CLIENT_SECRET" \\
  -d "username=user@example.com" -d "password=비밀번호" \\
  -d "scope=member:read progress:write"`}</CodeBlock>
              </div>

              <div>
                <p className="font-medium mb-1">③ authorization_code (+PKCE) — 제3자 위임</p>
                <p className="text-muted-foreground mb-2">
                  외부 앱이 회원의 동의를 받아 대리 접근. 브라우저로 <code>/oauth/authorize</code>에서 동의 → <code>code</code> 발급 → <code>/oauth-token</code>으로 교환. public 클라이언트는 PKCE(S256) 필수.
                </p>
                <CodeBlock>{`# 1) 브라우저로 동의 요청 (로그인 상태)
${window.location.origin}/oauth/authorize?response_type=code&client_id=CLIENT_ID&redirect_uri=콜백URL&scope=member:read&state=xyz&code_challenge=...&code_challenge_method=S256

# 2) 받은 code를 토큰으로 교환
curl -X POST ${FN_BASE}/oauth-token \\
  -d "grant_type=authorization_code" \\
  -d "client_id=CLIENT_ID" -d "client_secret=CLIENT_SECRET" \\
  -d "code=받은CODE" -d "redirect_uri=콜백URL" -d "code_verifier=..."`}</CodeBlock>
              </div>

              <div>
                <p className="font-medium mb-1">④ refresh_token — 만료 토큰 재발급</p>
                <p className="text-muted-foreground mb-2">
                  access 토큰 만료 시 재발급. <b>회전 방식</b>이라 사용된 refresh는 무효화되고 새 refresh가 발급됩니다 (재사용 시 보안상 전체 폐기).
                </p>
                <CodeBlock>{`curl -X POST ${FN_BASE}/oauth-token \\
  -d "grant_type=refresh_token" \\
  -d "client_id=CLIENT_ID" -d "client_secret=CLIENT_SECRET" \\
  -d "refresh_token=REFRESH_TOKEN"`}</CodeBlock>
              </div>

              <div>
                <p className="font-medium mb-1">발급 응답 예시</p>
                <CodeBlock>{`{
  "access_token": "eyJhbGciOi...",
  "token_type": "Bearer",
  "expires_in": 900,
  "refresh_token": "...",
  "scope": "product:read"
}`}</CodeBlock>
              </div>
            </CardContent>
          </Card>

          {/* 5. API 호출 */}
          <Card>
            <CardHeader><CardTitle className="text-base">5. API 호출</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>발급받은 access 토큰을 <code>Authorization</code> 헤더에 넣어 호출합니다.</p>
              <CodeBlock>{`curl "${FN_BASE}/api-products?limit=20" \\
  -H "Authorization: Bearer ACCESS_TOKEN"`}</CodeBlock>
            </CardContent>
          </Card>

          {/* 6. 토큰 폐기 */}
          <Card>
            <CardHeader><CardTitle className="text-base">6. 토큰 폐기</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <CodeBlock>{`curl -X POST ${FN_BASE}/oauth-revoke \\
  -d "client_id=CLIENT_ID" -d "client_secret=CLIENT_SECRET" \\
  -d "token=ACCESS_또는_REFRESH_토큰"`}</CodeBlock>
            </CardContent>
          </Card>

          {/* 7. 에러 코드 */}
          <Card>
            <CardHeader><CardTitle className="text-base">7. 에러 코드</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm border">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2 font-medium">HTTP</th>
                    <th className="text-left p-2 font-medium">code</th>
                    <th className="text-left p-2 font-medium">의미</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["200 / 201", "00", "성공"],
                    ["401", "11", "인증 실패 — 토큰 없음/만료/폐기"],
                    ["403", "99", "scope 부족 (insufficient_scope)"],
                    ["400", "—", "토큰 발급 실패 (invalid_client, invalid_grant 등 OAuth 표준)"],
                    ["404 / 405", "99", "경로 없음 / 허용되지 않은 메서드"],
                  ].map(([h, c, m]) => (
                    <tr key={h} className="border-t">
                      <td className="p-2 font-mono text-xs">{h}</td>
                      <td className="p-2 font-mono text-xs">{c}</td>
                      <td className="p-2">{m}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* 8. 엔드포인트 목록 */}
          <Card>
            <CardHeader><CardTitle className="text-base">8. 엔드포인트 목록</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm mb-2 text-muted-foreground">
                실제 호출/파라미터 테스트는 상단 <b>Try it out</b> 탭을 이용하세요.
              </p>
              <table className="w-full text-sm border">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2 font-medium">메서드</th>
                    <th className="text-left p-2 font-medium">경로</th>
                    <th className="text-left p-2 font-medium">설명</th>
                    <th className="text-left p-2 font-medium">필요 scope</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["GET", "/api-lectures", "강의 목록", "lecture:read"],
                    ["GET", "/api-students", "회원 목록", "member:read"],
                    ["GET", "/api-members-detail?member_code=...", "회원 단건 조회", "member:read"],
                    ["GET", "/api-orders", "주문 목록", "order:read"],
                    ["GET", "/api-products", "상품(B2C 강의) 목록", "product:read"],
                    ["GET", "/api-progress", "수강생 진도율 조회", "progress:read"],
                    ["POST", "/api-progress", "진도율 저장", "progress:write"],
                  ].map((row) => (
                    <tr key={row[1]} className="border-t">
                      <td className="p-2"><Badge variant={row[0] === "GET" ? "secondary" : "default"} className="font-mono text-xs">{row[0]}</Badge></td>
                      <td className="p-2 font-mono text-xs">{row[1]}</td>
                      <td className="p-2">{row[2]}</td>
                      <td className="p-2 font-mono text-xs">{row[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auth" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">토큰 발급 (Try it out)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Client ID</Label>
                  <Input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="wh_..." />
                </div>
                <div>
                  <Label>Client Secret</Label>
                  <Input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Scope (공백 구분)</Label>
                  <Input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="lecture:read member:read" />
                </div>
              </div>
              <Button onClick={issueToken} disabled={!clientId || !clientSecret}>
                <Play className="h-4 w-4 mr-1" /> 토큰 발급
              </Button>
              {tokenResp && <CodeBlock>{tokenResp}</CodeBlock>}
              {token && (
                <div className="text-xs text-muted-foreground">
                  ✓ 발급된 토큰이 아래 엔드포인트 호출에 자동 사용됩니다.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">cURL 예시</CardTitle>
            </CardHeader>
            <CardContent>
              <CodeBlock>{`curl -X POST ${FN_BASE}/oauth-token \\
  -d "grant_type=client_credentials" \\
  -d "client_id=YOUR_CLIENT_ID" \\
  -d "client_secret=YOUR_CLIENT_SECRET" \\
  -d "scope=lecture:read member:read"`}</CodeBlock>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="endpoints" className="space-y-4">
          <div className="space-y-2">
            <Label>Access Token (수동 입력 또는 발급된 값)</Label>
            <Textarea rows={2} value={token} onChange={(e) => setToken(e.target.value)} className="font-mono text-xs" />
          </div>

          {APIS.map((api) => (
            <Card key={api.id}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                  <Badge variant={api.method === "GET" ? "secondary" : "default"}>{api.method}</Badge>
                  <code className="text-sm">{api.path}</code>
                  <Badge variant="outline" className="ml-auto">{api.scope}</Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground">{api.summary}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {api.params && api.params.length > 0 && (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {api.params.map((p) => (
                      <div key={p.name}>
                        <Label className="text-xs">
                          {p.name} <span className="text-muted-foreground">({p.in})</span>
                          {p.required && <span className="text-destructive ml-1">*</span>}
                        </Label>
                        <Input
                          placeholder={p.description}
                          value={tryParams[api.id]?.[p.name] || ""}
                          onChange={(e) =>
                            setTryParams((s) => ({
                              ...s,
                              [api.id]: { ...(s[api.id] || {}), [p.name]: e.target.value },
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
                <Button size="sm" onClick={() => runApi(api)} disabled={!token}>
                  <Play className="h-4 w-4 mr-1" /> 실행
                </Button>
                {tryResp[api.id] && <CodeBlock>{tryResp[api.id]}</CodeBlock>}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="scopes">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Code2 className="h-4 w-4" /> Scope 목록
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-2">
                <li><Badge variant="outline">lecture:read</Badge> 강의 목록/상세 조회</li>
                <li><Badge variant="outline">member:read</Badge> 회원 목록/상세 조회</li>
                <li><Badge variant="outline">order:read</Badge> 주문/결제 내역 조회</li>
                <li><Badge variant="outline">progress:read</Badge> 학습 진도 조회</li>
                <li><Badge variant="outline">progress:write</Badge> 학습 진도 업데이트</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-4">
                각 스코프는 관리자 페이지의 <code>/admin/api-clients</code>에서 클라이언트별로 부여합니다.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </DashboardLayout>
  );
}