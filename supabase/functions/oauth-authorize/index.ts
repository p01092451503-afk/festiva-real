// POST /oapi/authorize — exchange a logged-in user's consent into an authorization_code.
// The frontend /oauth/authorize consent page calls this with the user's Supabase JWT.
import { corsHeaders, getServiceClient, getTenantDomain, jsonResponse } from "../_shared/oauth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return jsonResponse({ error: "invalid_request" }, 400); }

  const clientId = String(body.client_id || "");
  const redirectUri = String(body.redirect_uri || "");
  const scope = String(body.scope || "");
  const codeChallenge = body.code_challenge ? String(body.code_challenge) : null;
  const codeChallengeMethod = body.code_challenge_method ? String(body.code_challenge_method) : null;
  const state = body.state ? String(body.state) : "";

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ error: "unauthenticated" }, 401);
  }
  const userJwt = authHeader.slice(7).trim();

  // Validate user via anon client
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
  });
  const { data: userData, error: userErr } = await anon.auth.getUser();
  if (userErr || !userData.user) return jsonResponse({ error: "invalid_user" }, 401);

  const supabase = getServiceClient();
  const tenantDomain = getTenantDomain(req);

  const { data: client } = await supabase
    .from("oauth_clients")
    .select("client_id, scopes, redirect_uris, grant_types, is_active, tenant_domain")
    .eq("client_id", clientId)
    .eq("tenant_domain", tenantDomain)
    .maybeSingle();
  if (!client || !client.is_active) return jsonResponse({ error: "invalid_client" }, 400);
  if (!client.grant_types.includes("authorization_code")) return jsonResponse({ error: "unauthorized_client" }, 400);
  if (!Array.isArray(client.redirect_uris) || !client.redirect_uris.includes(redirectUri)) {
    return jsonResponse({ error: "invalid_redirect_uri" }, 400);
  }
  const requestedScopes = scope.trim() ? scope.trim().split(/\s+/) : client.scopes;
  const allowedScopes = requestedScopes.filter((s: string) => client.scopes.includes(s));
  if (allowedScopes.length === 0) return jsonResponse({ error: "invalid_scope" }, 400);

  if (codeChallenge && codeChallengeMethod && codeChallengeMethod !== "S256") {
    return jsonResponse({ error: "invalid_request", error_description: "only S256 supported" }, 400);
  }

  const code = `${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error: insertErr } = await supabase.from("oauth_auth_codes").insert({
    code,
    client_id: clientId,
    tenant_domain: tenantDomain,
    member_code: userData.user.id,
    scopes: allowedScopes,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    expires_at: expiresAt,
  });
  if (insertErr) return jsonResponse({ error: "server_error", error_description: insertErr.message }, 500);

  const sep = redirectUri.includes("?") ? "&" : "?";
  const redirect = `${redirectUri}${sep}code=${encodeURIComponent(code)}${state ? `&state=${encodeURIComponent(state)}` : ""}`;
  return jsonResponse({ code, redirect_uri: redirect, expires_in: 600, scopes: allowedScopes });
});