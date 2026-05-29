// POST /oapi/token — OAuth2 token endpoint
// Supports: client_credentials, refresh_token (P0). password / authorization_code stubs return unsupported for now.

import {
  apiResponse,
  authFailureResponse,
  corsHeaders,
  getServiceClient,
  getTenantDomain,
  hashSecret,
  jsonResponse,
  newOpaqueToken,
  signJwt,
  verifySecret,
} from "../_shared/oauth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const supabase = getServiceClient();
  const tenantDomain = getTenantDomain(req);

  // Parse body: support both form-urlencoded and JSON
  let params: Record<string, string> = {};
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      params = await req.json();
    } else {
      const form = await req.formData();
      for (const [k, v] of form.entries()) params[k] = String(v);
    }
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  // Client auth (Basic header or body)
  let clientId = "";
  let clientSecret = "";
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    try {
      const decoded = atob(authHeader.slice(6));
      const idx = decoded.indexOf(":");
      clientId = decoded.slice(0, idx);
      clientSecret = decoded.slice(idx + 1);
    } catch {
      return jsonResponse({ error: "invalid_client" }, 401);
    }
  } else {
    clientId = params.client_id || "";
    clientSecret = params.client_secret || "";
  }
  if (!clientId || !clientSecret) {
    return jsonResponse({ error: "invalid_client" }, 401);
  }

  const { data: client } = await supabase
    .from("oauth_clients")
    .select("*")
    .eq("client_id", clientId)
    .eq("tenant_domain", tenantDomain)
    .eq("is_active", true)
    .maybeSingle();

  if (!client || !(await verifySecret(clientSecret, client.client_secret_hash))) {
    return jsonResponse({ error: "invalid_client" }, 401);
  }

  // Tenant JWT signing key
  const { data: tk } = await supabase
    .from("oauth_tenant_keys")
    .select("jwt_secret")
    .eq("tenant_domain", tenantDomain)
    .maybeSingle();
  const jwtSecret = tk?.jwt_secret;
  if (!jwtSecret) return jsonResponse({ error: "server_error" }, 500);

  const grantType = params.grant_type;
  if (!grantType || !client.grant_types.includes(grantType)) {
    return jsonResponse({ error: "unauthorized_client" }, 400);
  }

  // Resolve requested scopes
  const requested = (params.scope || "").trim();
  const requestedScopes = requested ? requested.split(/\s+/) : client.scopes;
  const allowedScopes: string[] = requestedScopes.filter((s: string) => client.scopes.includes(s));
  if (allowedScopes.length === 0) {
    return jsonResponse({ error: "invalid_scope" }, 400);
  }

  if (grantType === "client_credentials") {
    return await issueToken(supabase, client.client_id, tenantDomain, allowedScopes, "client_credentials", null, jwtSecret);
  }

  if (grantType === "refresh_token") {
    const refreshToken = params.refresh_token;
    if (!refreshToken) return jsonResponse({ error: "invalid_request" }, 400);
    const { data: existing } = await supabase
      .from("oauth_tokens")
      .select("*")
      .eq("refresh_token", refreshToken)
      .eq("client_id", client.client_id)
      .is("revoked_at", null)
      .maybeSingle();
    if (!existing || !existing.refresh_expires_at || new Date(existing.refresh_expires_at) < new Date()) {
      return jsonResponse({ error: "invalid_grant" }, 401);
    }
    // Rotate: revoke old refresh
    await supabase.from("oauth_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", existing.id);
    return await issueToken(
      supabase,
      client.client_id,
      tenantDomain,
      existing.scopes,
      "refresh_token",
      existing.member_code,
      jwtSecret,
    );
  }

  // password and authorization_code grants — not yet wired to user store
  if (grantType === "password") {
    const username = (params.username || "").trim();
    const password = params.password || "";
    if (!username || !password) {
      return jsonResponse({ error: "invalid_request", error_description: "username/password required" }, 400);
    }
    // Validate using Supabase auth (anon key, password grant)
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.0");
    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data: signin, error: signErr } = await anon.auth.signInWithPassword({ email: username, password });
    if (signErr || !signin.user) {
      return jsonResponse({ error: "invalid_grant", error_description: "invalid_credentials" }, 401);
    }
    return await issueToken(supabase, client.client_id, tenantDomain, allowedScopes, "password", signin.user.id, jwtSecret);
  }

  if (grantType === "authorization_code") {
    const code = params.code;
    const redirectUri = params.redirect_uri;
    const codeVerifier = params.code_verifier;
    if (!code || !redirectUri) {
      return jsonResponse({ error: "invalid_request" }, 400);
    }
    const { data: authCode } = await supabase
      .from("oauth_auth_codes")
      .select("*")
      .eq("code", code)
      .eq("client_id", client.client_id)
      .is("used_at", null)
      .maybeSingle();
    if (!authCode) return jsonResponse({ error: "invalid_grant" }, 401);
    if (new Date(authCode.expires_at) < new Date()) {
      return jsonResponse({ error: "invalid_grant", error_description: "code_expired" }, 401);
    }
    if (authCode.redirect_uri !== redirectUri) {
      return jsonResponse({ error: "invalid_grant", error_description: "redirect_uri_mismatch" }, 401);
    }
    // PKCE verification (S256 only — plain not accepted)
    if (authCode.code_challenge) {
      if (!codeVerifier) {
        return jsonResponse({ error: "invalid_request", error_description: "code_verifier_required" }, 400);
      }
      if (authCode.code_challenge_method !== "S256") {
        return jsonResponse({ error: "invalid_request", error_description: "unsupported_pkce_method" }, 400);
      }
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
      let str = "";
      for (const b of new Uint8Array(digest)) str += String.fromCharCode(b);
      const computed = btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
      if (computed !== authCode.code_challenge) {
        return jsonResponse({ error: "invalid_grant", error_description: "pkce_failed" }, 401);
      }
    }
    await supabase.from("oauth_auth_codes").update({ used_at: new Date().toISOString() }).eq("id", authCode.id);
    return await issueToken(
      supabase,
      client.client_id,
      tenantDomain,
      authCode.scopes,
      "authorization_code",
      authCode.member_code,
      jwtSecret,
    );
  }

  return jsonResponse({ error: "unsupported_grant_type" }, 400);
});

async function issueToken(
  supabase: ReturnType<typeof getServiceClient>,
  clientId: string,
  tenantDomain: string,
  scopes: string[],
  grantType: string,
  memberCode: string | null,
  jwtSecret: string,
) {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 900; // 15 min
  const accessToken = await signJwt(
    {
      iss: tenantDomain,
      sub: memberCode || clientId,
      aud: tenantDomain,
      iat: now,
      exp: now + expiresIn,
      scope: scopes.join(" "),
      client_id: clientId,
      grant_type: grantType,
    },
    jwtSecret,
  );
  const refreshToken = newOpaqueToken();
  const expiresAt = new Date((now + expiresIn) * 1000).toISOString();
  const refreshExpiresAt = new Date((now + 60 * 60 * 24 * 30) * 1000).toISOString();

  await supabase.from("oauth_tokens").insert({
    client_id: clientId,
    tenant_domain: tenantDomain,
    access_token: accessToken,
    refresh_token: refreshToken,
    scopes,
    grant_type: grantType,
    member_code: memberCode,
    expires_at: expiresAt,
    refresh_expires_at: refreshExpiresAt,
  });

  return jsonResponse({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: expiresIn,
    refresh_token: refreshToken,
    scope: scopes.join(" "),
  });
}