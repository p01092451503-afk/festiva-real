// 일괄 메시지 발송 (이메일 / 카카오 알림톡)
// - 이메일: Resend (RESEND_API_KEY, BULK_EMAIL_FROM)
// - 알림톡: Solapi (SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER, SOLAPI_PF_ID)
// 키가 없으면 발송은 건너뛰고 이력만 기록합니다.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Recipient {
  userId?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
}

const render = (template: string, name: string) => template.replaceAll("{name}", name || "회원");

async function solapiHeaders(apiKey: string, apiSecret: string) {
  const date = new Date().toISOString();
  const salt = crypto.randomUUID().replace(/-/g, "");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(date + salt));
  const signature = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return {
    "Content-Type": "application/json",
    Authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: auth } = await userClient.auth.getUser();
    if (!auth?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", auth.user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "super_admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { channel, subject, body, templateCode, recipients } = (await req.json()) as {
      channel: "email" | "alimtalk";
      subject?: string | null;
      body: string;
      templateCode?: string | null;
      recipients: Recipient[];
    };

    if (!body || !Array.isArray(recipients) || recipients.length === 0) {
      return new Response(JSON.stringify({ error: "내용과 수신자가 필요합니다." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: message, error: msgErr } = await admin
      .from("bulk_messages")
      .insert({
        channel,
        subject: subject ?? null,
        body,
        template_code: templateCode ?? null,
        recipient_count: recipients.length,
        status: "sending",
        created_by: auth.user.id,
      })
      .select("id")
      .single();
    if (msgErr) throw msgErr;

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("BULK_EMAIL_FROM") || "onboarding@resend.dev";
    const solKey = Deno.env.get("SOLAPI_API_KEY");
    const solSecret = Deno.env.get("SOLAPI_API_SECRET");
    const solSender = Deno.env.get("SOLAPI_SENDER");
    const solPfId = Deno.env.get("SOLAPI_PF_ID");

    let success = 0;
    let failed = 0;
    let note: string | undefined;
    const rows: any[] = [];

    for (const r of recipients) {
      const text = render(body, r.name ?? "");
      let status = "skipped";
      let error_message: string | null = null;

      try {
        if (channel === "email") {
          if (!r.email) {
            error_message = "이메일 주소 없음";
          } else if (!resendKey) {
            note = "이메일 발송 키(RESEND_API_KEY)가 없어 이력만 기록했습니다.";
            error_message = "발송 키 미설정";
          } else {
            const res = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from,
                to: [r.email],
                subject: render(subject || "", r.name ?? ""),
                html: `<div style="font-family:sans-serif;line-height:1.7;white-space:pre-wrap">${text}</div>`,
              }),
            });
            if (!res.ok) throw new Error(await res.text());
            status = "sent";
          }
        } else {
          if (!r.phone) {
            error_message = "휴대폰 번호 없음";
          } else if (!solKey || !solSecret || !solSender) {
            note = "알림톡 발송 키(SOLAPI_*)가 없어 이력만 기록했습니다.";
            error_message = "발송 키 미설정";
          } else {
            const headers = await solapiHeaders(solKey, solSecret);
            const msg: Record<string, unknown> = {
              to: r.phone.replace(/[^0-9]/g, ""),
              from: solSender,
              text,
            };
            if (templateCode && solPfId) {
              msg.kakaoOptions = { pfId: solPfId, templateId: templateCode, disableSms: false };
            }
            const res = await fetch("https://api.solapi.com/messages/v4/send", {
              method: "POST",
              headers,
              body: JSON.stringify({ message: msg }),
            });
            if (!res.ok) throw new Error(await res.text());
            status = "sent";
          }
        }
      } catch (e) {
        status = "failed";
        error_message = String((e as Error).message).slice(0, 500);
      }

      if (status === "sent") success += 1;
      else failed += 1;

      rows.push({
        message_id: message.id,
        user_id: r.userId ?? null,
        target_email: r.email ?? null,
        target_phone: r.phone ?? null,
        status,
        error_message,
        sent_at: status === "sent" ? new Date().toISOString() : null,
      });
    }

    await admin.from("bulk_message_recipients").insert(rows);
    await admin
      .from("bulk_messages")
      .update({ success_count: success, fail_count: failed, status: failed === recipients.length ? "failed" : "done" })
      .eq("id", message.id);

    return new Response(JSON.stringify({ messageId: message.id, success, failed, note }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
