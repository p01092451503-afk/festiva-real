import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { token } = await req.json();
    if (typeof token !== "string" || token.length < 32 || token.length > 200) {
      return new Response(JSON.stringify({ error: "유효하지 않은 토큰입니다" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: row, error } = await admin
      .from("one_time_login_tokens")
      .select("*")
      .eq("token", token)
      .maybeSingle();
    if (error || !row) return new Response(JSON.stringify({ error: "토큰을 찾을 수 없습니다" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (row.revoked_at) return new Response(JSON.stringify({ error: "폐기된 토큰입니다" }), { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "만료된 링크입니다" }), { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (row.use_count >= row.max_uses) {
      return new Response(JSON.stringify({ error: "이미 사용된 링크입니다" }), { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get user's email
    const { data: userRes, error: uErr } = await admin.auth.admin.getUserById(row.user_id);
    if (uErr || !userRes?.user?.email) throw new Error("사용자를 찾을 수 없습니다");

    // Generate magic link, parse tokens from the response
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: userRes.user.email,
    });
    if (linkErr) throw linkErr;

    // verifyOtp with the email_otp returned by generateLink
    const otp = (linkData as any)?.properties?.email_otp;
    if (!otp) throw new Error("세션을 발급받지 못했습니다");

    const anon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: sess, error: vErr } = await anon.auth.verifyOtp({
      email: userRes.user.email,
      token: otp,
      type: "magiclink",
    });
    if (vErr || !sess.session) throw vErr ?? new Error("세션 발급 실패");

    // Mark consumed
    await admin.from("one_time_login_tokens").update({
      use_count: row.use_count + 1,
      used_at: row.used_at ?? new Date().toISOString(),
    }).eq("id", row.id);

    if (row.invitation_id) {
      await admin.from("course_invitations").update({ status: "consumed", consumed_at: new Date().toISOString() }).eq("id", row.invitation_id);
    }

    return new Response(JSON.stringify({
      access_token: sess.session.access_token,
      refresh_token: sess.session.refresh_token,
      course_id: row.course_id,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});