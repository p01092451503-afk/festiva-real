// 학습독려 자동 발송
// - 트리거: 미수강(not_started) / 미완료(incomplete) / 진도율 미달 / 미접속 일수 / 종료 임박
// - 채널: email(Resend) / sms · alimtalk(Solapi) / system(앱 알림)
// - 재발송 방지(cooldown_days), 발송 이력(message_logs) 기록
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fill = (tpl: string, vars: Record<string, string | number>) =>
  (tpl || "").replace(/\{\{?\s*([\w.]+)\s*\}?\}/g, (m, key) =>
    key in vars ? String(vars[key]) : m,
  );

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
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const payload = await req.json().catch(() => ({}));
    const ruleId: string | undefined = payload?.rule_id;
    const dryRun: boolean = payload?.dry_run === true;

    const base = admin.from("learning_nudge_rules").select("*");
    const { data: rules, error: rErr } = ruleId
      ? await base.eq("id", ruleId)
      : await base.eq("is_active", true);
    if (rErr) return json({ error: rErr.message }, 500);
    if (!rules?.length) return json({ sent: 0, results: [], message: "실행할 규칙이 없습니다." });

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("BULK_EMAIL_FROM") || "onboarding@resend.dev";
    const solKey = Deno.env.get("SOLAPI_API_KEY");
    const solSecret = Deno.env.get("SOLAPI_API_SECRET");
    const solSender = Deno.env.get("SOLAPI_SENDER");
    const solPfId = Deno.env.get("SOLAPI_PF_ID");

    const results: any[] = [];
    let totalSent = 0;

    for (const rule of rules) {
      const threshold = Number(rule.threshold ?? 0);
      const now = Date.now();

      // 1) 수강생 추출
      let q = admin
        .from("enrollments")
        .select("user_id, course_id, progress, status, updated_at, enrolled_at")
        .eq("status", "approved");
      if (rule.course_id) q = q.eq("course_id", rule.course_id);
      const { data: enrollments, error: eErr } = await q;
      if (eErr) {
        results.push({ rule: rule.name, error: eErr.message });
        continue;
      }

      let targets = (enrollments ?? []).filter((e: any) => {
        const p = Number(e.progress ?? 0);
        switch (rule.condition_type) {
          case "not_started":
            return p <= 0;
          case "incomplete":
            return p > 0 && p < 100;
          case "progress_below":
            return p < threshold;
          case "inactive_days": {
            const last = e.updated_at ? new Date(e.updated_at).getTime() : 0;
            return p < 100 && (now - last) / 86400000 >= threshold;
          }
          default:
            return p < 100;
        }
      });

      // 2) 재발송 방지 (cooldown_days 내 동일 규칙 수신자 제외)
      const cooldown = Number(rule.cooldown_days ?? 0);
      if (cooldown > 0 && targets.length > 0) {
        const since = new Date(now - cooldown * 86400000).toISOString();
        const { data: recent } = await admin
          .from("message_logs")
          .select("recipient_user_id")
          .eq("source", "nudge")
          .eq("template_id", rule.template_id)
          .gte("sent_at", since);
        const blocked = new Set((recent ?? []).map((r: any) => r.recipient_user_id));
        targets = targets.filter((t: any) => !blocked.has(t.user_id));
      }

      if (targets.length === 0) {
        results.push({ rule: rule.name, sent: 0, skipped: "대상 없음" });
        continue;
      }

      // 3) 템플릿 / 수신자 정보
      let subject = "학습 독려 안내";
      let bodyTpl = "{{name}}님, 수강 중인 {{course}} 과정의 학습을 이어가 주세요. (현재 진도율 {{progress}}%)";
      if (rule.template_id) {
        const { data: tpl } = await admin
          .from("message_templates")
          .select("subject, body, is_active")
          .eq("id", rule.template_id)
          .maybeSingle();
        if (tpl) {
          subject = tpl.subject || subject;
          bodyTpl = tpl.body || bodyTpl;
        }
      }

      const userIds = [...new Set(targets.map((t: any) => t.user_id))];
      const courseIds = [...new Set(targets.map((t: any) => t.course_id).filter(Boolean))];
      const { data: profiles } = await admin
        .from("profiles")
        .select("user_id, full_name, email, phone_number, marketing_email")
        .in("user_id", userIds);
      const { data: courses } = courseIds.length
        ? await admin.from("courses").select("id, title").in("id", courseIds)
        : { data: [] as any[] };
      const pMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
      const cMap = new Map((courses ?? []).map((c: any) => [c.id, c.title]));

      if (dryRun) {
        results.push({ rule: rule.name, would_send: targets.length });
        continue;
      }

      // 4) 채널별 발송
      const logs: any[] = [];
      const notifications: any[] = [];
      let sent = 0;

      for (const t of targets) {
        const p: any = pMap.get(t.user_id) ?? {};
        const vars = {
          name: p.full_name || "회원",
          course: cMap.get(t.course_id) || "수강 과정",
          progress: Math.round(Number(t.progress ?? 0)),
        };
        const text = fill(bodyTpl, vars);
        const title = fill(subject, vars);
        let status = "sent";
        let error_message: string | null = null;
        let address: string | null = null;

        try {
          if (rule.channel === "email") {
            address = p.email ?? null;
            if (!address) throw new Error("이메일 주소 없음");
            if (p.marketing_email === false) throw new Error("수신 거부 회원");
            if (!resendKey) throw new Error("이메일 발송 키(RESEND_API_KEY) 미설정");
            const res = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from,
                to: [address],
                subject: title,
                html: `<div style="font-family:sans-serif;line-height:1.7;white-space:pre-wrap">${text}</div>`,
              }),
            });
            if (!res.ok) throw new Error((await res.text()).slice(0, 300));
          } else if (rule.channel === "sms" || rule.channel === "alimtalk") {
            address = p.phone_number ?? null;
            if (!address) throw new Error("휴대폰 번호 없음");
            if (!solKey || !solSecret || !solSender) throw new Error("SMS 발송 키(SOLAPI_*) 미설정");
            const headers = await solapiHeaders(solKey, solSecret);
            const msg: Record<string, unknown> = {
              to: address.replace(/[^0-9]/g, ""),
              from: solSender,
              text,
            };
            if (rule.channel === "alimtalk" && solPfId) {
              msg.kakaoOptions = { pfId: solPfId, disableSms: false };
            }
            const res = await fetch("https://api.solapi.com/messages/v4/send", {
              method: "POST",
              headers,
              body: JSON.stringify({ message: msg }),
            });
            if (!res.ok) throw new Error((await res.text()).slice(0, 300));
          } else {
            notifications.push({ user_id: t.user_id, title, message: text, type: "info" });
          }
        } catch (e) {
          status = "failed";
          error_message = String((e as Error).message).slice(0, 500);
        }

        if (status === "sent") sent += 1;
        logs.push({
          template_id: rule.template_id,
          channel: rule.channel,
          recipient_user_id: t.user_id,
          recipient_address: address,
          subject: title,
          body: text,
          status,
          error_message,
          source: "nudge",
        });
      }

      const CHUNK = 500;
      for (let i = 0; i < notifications.length; i += CHUNK) {
        const { error } = await admin.from("notifications").insert(notifications.slice(i, i + CHUNK));
        if (error) console.error("notifications insert failed:", error.message);
      }
      for (let i = 0; i < logs.length; i += CHUNK) {
        const { error } = await admin.from("message_logs").insert(logs.slice(i, i + CHUNK));
        if (error) console.error("message_logs insert failed:", error.message);
      }

      await admin
        .from("learning_nudge_rules")
        .update({ last_run_at: new Date().toISOString(), last_sent_count: sent })
        .eq("id", rule.id);

      totalSent += sent;
      results.push({ rule: rule.name, channel: rule.channel, targets: targets.length, sent });
    }

    return json({ sent: totalSent, results });
  } catch (e) {
    console.error("run-learning-nudge failed:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
