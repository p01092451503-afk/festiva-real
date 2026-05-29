// Admin-only endpoint for creating/rotating OAuth clients server-side.
// Returns the plaintext client_secret ONCE — never stored in plaintext.
//
// Actions:
//   POST { action: "create", name, description?, grant_types[], scopes[], redirect_uris[] }
//     -> { client_id, client_secret, ... }
//   POST { action: "rotate", client_id }
//     -> { client_id, client_secret }
//
// Requires the caller to be a logged-in admin or super_admin.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  corsHeaders,
  getServiceClient,
  hashSecret,
  jsonResponse,
  newClientId,
  newClientSecret,
} from "../_shared/oauth.ts";

const ALLOWED_GRANTS = ["client_credentials", "password", "authorization_code", "refresh_token"];
const ALLOWED_SCOPES = [
  "member:read",
  "member:write",
  "lecture:read",
  "progress:read",
  "progress:write",
  "product:read",
  "order:read",
];

async function assertAdmin(req: Request): Promise<{ ok: true; userId: string } | { ok: false; resp: Response }> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, resp: jsonResponse({ error: "unauthenticated" }, 401) };
  }
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const { data: userData, error } = await userClient.auth.getUser();
  if (error || !userData?.user) {
    return { ok: false, resp: jsonResponse({ error: "unauthenticated" }, 401) };
  }
  const userId = userData.user.id;
  const admin = getServiceClient();
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "super_admin"]);
  if (!roles || roles.length === 0) {
    return { ok: false, resp: jsonResponse({ error: "forbidden" }, 403) };
  }
  return { ok: true, userId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const guard = await assertAdmin(req);
  if (!guard.ok) return guard.resp;

  let body: any;
  try { body = await req.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400); }

  const supabase = getServiceClient();

  if (body.action === "create") {
    const name = String(body.name || "").trim();
    if (!name) return jsonResponse({ error: "name_required" }, 400);
    const grantTypes: string[] = Array.isArray(body.grant_types) && body.grant_types.length > 0
      ? body.grant_types.filter((g: string) => ALLOWED_GRANTS.includes(g))
      : ["client_credentials"];
    const scopes: string[] = Array.isArray(body.scopes) && body.scopes.length > 0
      ? body.scopes.filter((s: string) => ALLOWED_SCOPES.includes(s))
      : ["member:read"];
    const redirectUris: string[] = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter(Boolean) : [];

    const clientId = newClientId();
    const clientSecret = newClientSecret();
    const secretHash = await hashSecret(clientSecret);

    const { data, error } = await supabase
      .from("oauth_clients")
      .insert({
        client_id: clientId,
        client_secret_hash: secretHash,
        name,
        description: body.description ?? null,
        grant_types: grantTypes,
        scopes,
        redirect_uris: redirectUris,
        created_by: guard.userId,
      })
      .select()
      .single();
    if (error) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ ...data, client_secret: clientSecret });
  }

  if (body.action === "rotate") {
    const targetId = String(body.client_id || "");
    if (!targetId) return jsonResponse({ error: "client_id_required" }, 400);
    const newSecret = newClientSecret();
    const secretHash = await hashSecret(newSecret);
    const { error } = await supabase
      .from("oauth_clients")
      .update({ client_secret_hash: secretHash, updated_at: new Date().toISOString() })
      .eq("client_id", targetId);
    if (error) return jsonResponse({ error: error.message }, 400);
    // Revoke all existing tokens for this client (safety)
    await supabase.from("oauth_tokens").update({ revoked_at: new Date().toISOString() })
      .eq("client_id", targetId).is("revoked_at", null);
    return jsonResponse({ client_id: targetId, client_secret: newSecret });
  }

  return jsonResponse({ error: "unknown_action" }, 400);
});