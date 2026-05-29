import { corsHeaders, getServiceClient, jsonResponse, verifySecret } from "../_shared/oauth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const supabase = getServiceClient();
  let params: Record<string, string> = {};
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) params = await req.json();
    else for (const [k, v] of (await req.formData()).entries()) params[k] = String(v);
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  // Client auth (Basic header or body)
  let clientId = "";
  let clientSecret = "";
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    const decoded = atob(authHeader.slice(6));
    const idx = decoded.indexOf(":");
    clientId = decoded.slice(0, idx);
    clientSecret = decoded.slice(idx + 1);
  } else {
    clientId = params.client_id || "";
    clientSecret = params.client_secret || "";
  }

  const { data: client } = await supabase
    .from("oauth_clients")
    .select("client_id, client_secret_hash, is_active")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!client || !client.is_active || !(await verifySecret(clientSecret, client.client_secret_hash))) {
    return jsonResponse({ error: "invalid_client" }, 401);
  }

  const tokenValue = params.token;
  if (!tokenValue) return jsonResponse({ success: true });

  await supabase
    .from("oauth_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .or(`access_token.eq.${tokenValue},refresh_token.eq.${tokenValue}`)
    .eq("client_id", client.client_id);

  return jsonResponse({ success: true });
});