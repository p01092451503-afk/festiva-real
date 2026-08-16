import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { paymentKey, amount, tossOrderId, internalOrderId } = await req.json();

    if (!paymentKey || !amount || !tossOrderId || !internalOrderId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Confirm payment with Toss
    const secretKey = Deno.env.get("TOSS_SECRET_KEY");
    if (!secretKey) {
      return new Response(
        JSON.stringify({ error: "TOSS_SECRET_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const encoded = btoa(secretKey + ":");
    const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: `Basic ${encoded}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentKey, orderId: tossOrderId, amount }),
    });

    if (!tossRes.ok) {
      const err = await tossRes.json();
      console.error("Toss API error:", err);
      return new Response(
        JSON.stringify({ error: err }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Update order & enroll via DB function
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await supabase.rpc("confirm_payment_and_enroll", {
      p_order_id: internalOrderId,
      p_toss_payment_key: paymentKey,
      p_toss_order_id: tossOrderId,
    });

    if (error) {
      console.error("DB confirm error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. 신청 완료 알림톡 자동 발송 기록 (관리자 > 메시지 발송 이력에서 확인)
    try {
      const { data: order } = await supabase
        .from("orders")
        .select("user_id, total_amount")
        .eq("id", internalOrderId)
        .maybeSingle();

      if (order?.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone_number, email")
          .eq("user_id", order.user_id)
          .maybeSingle();

        await supabase.from("message_logs").insert({
          channel: "alimtalk",
          recipient_user_id: order.user_id,
          recipient_address: profile?.phone_number ?? profile?.email ?? null,
          subject: "신청 완료 안내",
          body: `${profile?.full_name ?? "회원"}님, 신청이 정상적으로 완료되었습니다. 결제 금액: ${(order.total_amount ?? 0).toLocaleString()}원`,
          status: profile?.phone_number ? "sent" : "queued",
          source: "system",
        });
      }
    } catch (logErr) {
      console.error("alimtalk log failed:", logErr);
    }



    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Unexpected error:", e);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
