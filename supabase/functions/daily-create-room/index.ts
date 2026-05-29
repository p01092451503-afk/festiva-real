import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    const body = await req.json();
    const { sessionId } = body;
    if (!sessionId) return json({ error: "sessionId required" }, 400);

    // Authorize: must be host or admin
    const { data: session } = await service
      .from("video_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();
    if (!session) return json({ error: "session not found" }, 404);

    const { data: roleRows } = await service
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
    const isAdmin = roles.includes("admin") || roles.includes("super_admin");
    if (session.host_user_id !== user.id && !isAdmin) {
      return json({ error: "forbidden" }, 403);
    }

    if (session.daily_room_url) {
      return json({ url: session.daily_room_url, name: session.daily_room_name });
    }

    const expSec = Math.floor(new Date(session.scheduled_end).getTime() / 1000) + 1800;
    const roomName = `s-${sessionId.slice(0, 8)}-${Date.now().toString(36)}`;
    const roomRes = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: roomName,
        privacy: "private",
        properties: {
          exp: expSec,
          enable_chat: true,
          enable_screenshare: true,
          enable_recording: session.recording_enabled ? "cloud" : undefined,
          eject_at_room_exp: true,
          start_video_off: false,
          start_audio_off: false,
        },
      }),
    });
    const roomData = await roomRes.json();
    if (!roomRes.ok) {
      console.error("daily room create failed", roomData);
      return json({ error: "daily_create_failed", details: roomData }, 500);
    }

    await service
      .from("video_sessions")
      .update({ daily_room_name: roomData.name, daily_room_url: roomData.url })
      .eq("id", sessionId);

    return json({ url: roomData.url, name: roomData.name });
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