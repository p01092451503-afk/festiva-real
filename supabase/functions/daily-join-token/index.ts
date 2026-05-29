import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const JOIN_WINDOW_MIN = 10; // 시작 10분 전부터 입장 허용

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY");
    if (!DAILY_API_KEY) throw new Error("DAILY_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const { sessionId } = await req.json();
    if (!sessionId) return json({ error: "sessionId required" }, 400);

    const { data: session } = await service
      .from("video_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();
    if (!session) return json({ error: "session not found" }, 404);
    if (!session.daily_room_name) return json({ error: "room not ready" }, 400);

    const { data: roleRows } = await service
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
    const isAdmin = roles.includes("admin") || roles.includes("super_admin");
    const isHost = session.host_user_id === user.id;

    let isParticipant = false;
    if (!isHost && !isAdmin) {
      const { data: pr } = await service
        .from("video_session_participants")
        .select("id")
        .eq("session_id", sessionId)
        .eq("user_id", user.id)
        .maybeSingle();
      isParticipant = !!pr;
      if (!isParticipant) return json({ error: "not invited" }, 403);
    }

    // 시작 시간 윈도우 체크 (호스트/관리자는 통과)
    const now = Date.now();
    const start = new Date(session.scheduled_start).getTime();
    const end = new Date(session.scheduled_end).getTime();
    if (!isHost && !isAdmin) {
      if (now < start - JOIN_WINDOW_MIN * 60_000) {
        return json({ error: "too_early", scheduled_start: session.scheduled_start }, 400);
      }
      if (now > end + JOIN_WINDOW_MIN * 60_000) {
        return json({ error: "session_ended" }, 400);
      }
    }

    const { data: profile } = await service
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const tokenRes = await fetch("https://api.daily.co/v1/meeting-tokens", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          room_name: session.daily_room_name,
          user_name: profile?.full_name ?? user.email ?? "Guest",
          user_id: user.id,
          is_owner: isHost || isAdmin,
        exp: Math.max(Math.floor(end / 1000) + 1800, Math.floor(now / 1000) + 1800),
          enable_recording: session.recording_enabled ? "cloud" : undefined,
          start_cloud_recording: false,
        },
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("token failed", tokenData);
      return json({ error: "token_failed", details: tokenData }, 500);
    }

    // 참여 기록 (입장 시간) - 호스트도 자동 등록
    await service.from("video_session_participants").upsert(
      {
        session_id: sessionId,
        user_id: user.id,
        role: isHost ? "host" : "participant",
        joined_at: new Date().toISOString(),
      },
      { onConflict: "session_id,user_id" },
    );

    if (session.status === "scheduled") {
      await service.from("video_sessions").update({ status: "live" }).eq("id", sessionId);
    }

    return json({
      token: tokenData.token,
      url: session.daily_room_url,
      isHost: isHost || isAdmin,
    });
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}