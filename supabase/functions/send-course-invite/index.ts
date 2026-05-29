import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Recipient {
  recipient_name: string;
  phone: string;
  email?: string;
  affiliation?: string;
}

function randomToken(): string {
  const arr = new Uint8Array(48);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomPassword(): string {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return "WH" + Array.from(arr).map((b) => b.toString(36)).join("").slice(0, 10);
}

function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{([^}]+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const siteOrigin = req.headers.get("origin") ?? "https://demo.webheads.co.kr";

    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = roles?.some((r: any) => ["admin", "super_admin", "branch_admin"].includes(r.role));
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();

    // ── Resend path ─────────────────────────────
    if (body.resend_invitation_id) {
      const { data: inv, error } = await admin.from("course_invitations").select("*").eq("id", body.resend_invitation_id).maybeSingle();
      if (error || !inv) throw new Error("초대를 찾을 수 없습니다");
      await admin.from("sms_logs").insert({
        invitation_id: inv.id, to_phone: inv.phone, message: inv.message_body ?? "",
        status: "mock", provider: "aligo",
        response: { mock: true, note: "Aligo API not yet connected" },
        sent_at: new Date().toISOString(),
      });
      await admin.from("course_invitations").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", inv.id);
      return new Response(JSON.stringify({ ok: true, resent: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { course_id, delivery_method, recipients } = body as { course_id: string; delivery_method: "magic_link" | "credentials" | "both"; recipients: Recipient[] };
    if (!course_id || !delivery_method || !Array.isArray(recipients) || recipients.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: course } = await admin.from("courses").select("title").eq("id", course_id).maybeSingle();
    const courseTitle = course?.title ?? "강의";

    // Load templates
    const { data: tplRows } = await admin.from("sms_templates").select("template_key, body_template");
    const tpls = new Map((tplRows ?? []).map((t: any) => [t.template_key, t.body_template]));
    const tplKey = delivery_method === "both" ? "invite_both" : delivery_method === "credentials" ? "invite_credentials" : "invite_magic_link";
    const template = tpls.get(tplKey) ?? "[WEBHEADS LMS] {이름}님, {강의명} 수강 안내: {링크}";

    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    let success = 0, fail = 0;

    for (const r of recipients) {
      try {
        // 1) find or create user (by phone-derived email)
        const syntheticEmail = r.email && r.email.includes("@")
          ? r.email
          : `lms-${r.phone}@invite.webheads.local`;

        let userId: string | null = null;
        const { data: existingProfile } = await admin.from("profiles").select("user_id").eq("phone_number", r.phone).maybeSingle();
        if (existingProfile?.user_id) {
          userId = existingProfile.user_id;
        } else {
          const tempPw = randomPassword();
          const { data: created, error: cErr } = await admin.auth.admin.createUser({
            email: syntheticEmail, password: tempPw, email_confirm: true,
            user_metadata: { full_name: r.recipient_name, phone_number: r.phone },
          });
          if (cErr) throw new Error(cErr.message);
          userId = created.user?.id ?? null;
          if (userId) {
            await admin.from("profiles").update({ full_name: r.recipient_name, phone_number: r.phone }).eq("user_id", userId);
          }
        }
        if (!userId) throw new Error("사용자 생성 실패");

        const tempPassword = delivery_method === "magic_link" ? null : randomPassword();
        if (tempPassword) {
          await admin.auth.admin.updateUserById(userId, { password: tempPassword });
        }

        // 2) enrollment
        await admin.from("enrollments").upsert({ user_id: userId, course_id, status: "approved" as any, expires_at: expiresAt.toISOString() }, { onConflict: "user_id,course_id" });

        // 3) invitation row
        const { data: inv, error: invErr } = await admin.from("course_invitations").insert({
          recipient_name: r.recipient_name, phone: r.phone, email: r.email, affiliation: r.affiliation,
          course_id, delivery_method, status: "pending", user_id: userId, temp_password: tempPassword,
          expires_at: expiresAt.toISOString(), created_by: user.id,
        }).select().single();
        if (invErr) throw new Error(invErr.message);

        // 4) token (magic_link or both)
        let link = "";
        if (delivery_method !== "credentials") {
          const token = randomToken();
          await admin.from("one_time_login_tokens").insert({
            token, user_id: userId, invitation_id: inv.id, course_id, expires_at: expiresAt.toISOString(),
          });
          link = `${siteOrigin}/auth/otl?t=${token}`;
        }

        // 5) compose message
        const message = fillTemplate(template, {
          이름: r.recipient_name,
          강의명: courseTitle,
          링크: link,
          아이디: syntheticEmail,
          비번: tempPassword ?? "",
          만료일: expiresAt.toISOString().slice(0, 10),
          사이트: siteOrigin,
        });

        await admin.from("course_invitations").update({ message_body: message, status: "sent", sent_at: new Date().toISOString() }).eq("id", inv.id);

        // 6) SMS log (mock — Aligo not connected yet)
        await admin.from("sms_logs").insert({
          invitation_id: inv.id, provider: "aligo", to_phone: r.phone, message,
          status: "mock", response: { mock: true, note: "Aligo API not yet connected" },
          sent_at: new Date().toISOString(),
        });

        success++;
      } catch (e: any) {
        fail++;
        await admin.from("course_invitations").insert({
          recipient_name: r.recipient_name, phone: r.phone, email: r.email, affiliation: r.affiliation,
          course_id, delivery_method, status: "failed", error_message: String(e?.message ?? e),
          expires_at: expiresAt.toISOString(), created_by: user.id,
        });
      }
    }

    return new Response(JSON.stringify({ success_count: success, fail_count: fail }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});