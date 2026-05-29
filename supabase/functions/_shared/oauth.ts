// Shared OAuth helpers for all /oapi/* edge functions.
// Uses Web Crypto (PBKDF2 for secrets, HMAC-SHA256 for JWT) — no external bcrypt.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}

/** Standard API envelope: 00 = success, 11 = auth error, 99 = scope error. */
export function apiResponse(code: "00" | "11" | "99", data: unknown, status: number) {
  return jsonResponse({ code, data }, status);
}

export function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export function getTenantDomain(req: Request): string {
  // Single-tenant for now. Future: map host header → tenant_domain.
  return "default";
}

// ----------------------- Secret hashing (PBKDF2-SHA256) -----------------------
const PBKDF2_ITER = 100_000;
const SALT_LEN = 16;

function bytesToHex(buf: ArrayBuffer | Uint8Array): string {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

export async function hashSecret(secret: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITER, hash: "SHA-256" },
    key,
    256,
  );
  return `pbkdf2$${PBKDF2_ITER}$${bytesToHex(salt)}$${bytesToHex(bits)}`;
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  try {
    const [scheme, iterStr, saltHex, hashHex] = stored.split("$");
    if (scheme !== "pbkdf2") return false;
    const iterations = parseInt(iterStr, 10);
    const salt = hexToBytes(saltHex);
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "PBKDF2" },
      false,
      ["deriveBits"],
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      key,
      256,
    );
    const computed = bytesToHex(bits);
    // Constant-time compare
    if (computed.length !== hashHex.length) return false;
    let diff = 0;
    for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ hashHex.charCodeAt(i);
    return diff === 0;
  } catch {
    return false;
  }
}

// ----------------------- JWT (HS256) -----------------------
function b64urlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function signJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const encHeader = b64urlEncode(JSON.stringify(header));
  const encPayload = b64urlEncode(JSON.stringify(payload));
  const signingInput = `${encHeader}.${encPayload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${b64urlEncode(new Uint8Array(sig))}`;
}

// ----------------------- Token helpers -----------------------
export function newOpaqueToken(): string {
  return `${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;
}

export function newClientId(): string {
  return `wh_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function newClientSecret(): string {
  // 48 hex chars ~ 192 bits entropy
  const arr = crypto.getRandomValues(new Uint8Array(24));
  return bytesToHex(arr);
}

// ----------------------- API request authentication -----------------------
export interface AuthSuccess {
  success: true;
  tokenData: {
    client_id: string;
    tenant_domain: string;
    scopes: string[];
    grant_type: string;
    member_code: string | null;
    expires_at: string;
  };
}
export interface AuthFailure {
  success: false;
  status: number;
  message: string;
  envelope: "11" | "99";
  required?: string[];
}

export async function authenticateRequest(
  req: Request,
  supabase: ReturnType<typeof getServiceClient>,
  requiredScopes: string[],
): Promise<AuthSuccess | AuthFailure> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return { success: false, status: 401, message: "토큰이 없습니다", envelope: "11" };
  }
  const token = authHeader.slice(7).trim();
  const { data: tokenData, error } = await supabase
    .from("oauth_tokens")
    .select("client_id, tenant_domain, scopes, grant_type, member_code, expires_at, revoked_at")
    .eq("access_token", token)
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !tokenData) {
    return { success: false, status: 401, message: "유효하지 않은 토큰", envelope: "11" };
  }
  if (new Date(tokenData.expires_at) < new Date()) {
    return { success: false, status: 401, message: "토큰이 만료되었습니다", envelope: "11" };
  }
  const missing = requiredScopes.filter((s) => !tokenData.scopes.includes(s));
  if (missing.length > 0) {
    return {
      success: false,
      status: 403,
      message: "insufficient_scope",
      envelope: "99",
      required: missing,
    };
  }
  return { success: true, tokenData };
}

/** Build the standard error API envelope from an AuthFailure. */
export function authFailureResponse(failure: AuthFailure) {
  const data: Record<string, unknown> = { message: failure.message };
  if (failure.required) data.required = failure.required;
  return apiResponse(failure.envelope, data, failure.status);
}