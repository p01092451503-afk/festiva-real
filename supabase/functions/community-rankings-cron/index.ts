import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) 일별 랭킹 집계
    const { data: affected, error: aggErr } = await supabase.rpc(
      "community_aggregate_daily_rankings" as any,
      {},
    );
    if (aggErr) throw aggErr;

    // 2) TOP 10 사용자에게 top10 배지 수여
    const today = new Date().toISOString().slice(0, 10);
    const { data: top10 } = await supabase
      .from("community_rankings_daily" as any)
      .select("user_id, rank")
      .eq("snapshot_date", today)
      .lte("rank", 10);

    let badgesAwarded = 0;
    if (top10 && top10.length > 0) {
      for (const row of top10 as any[]) {
        const { error } = await supabase.rpc("award_community_badge" as any, {
          _user_id: row.user_id,
          _badge_code: "top10",
        });
        if (!error) badgesAwarded++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, snapshot_date: today, users: affected, badges_awarded: badgesAwarded }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[community-rankings-cron]", e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});