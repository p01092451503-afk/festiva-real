// Returns Bunny Stream video metadata (length, status, thumbnail).
// Used to auto-populate duration after upload or when selecting an existing video.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      console.error("Auth error:", userError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to bypass RLS for the role lookup
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roles, error: rolesError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    if (rolesError) {
      console.error("Roles lookup failed:", rolesError.message);
    }
    const allowed = (roles || []).some((r: { role: string }) =>
      ["admin", "super_admin", "teacher"].includes(r.role)
    );
    if (!allowed) {
      console.warn("Forbidden user:", userData.user.id, "roles:", roles);
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const BUNNY_API_KEY = Deno.env.get("BUNNY_STREAM_API_KEY");
    const BUNNY_LIBRARY_ID = Deno.env.get("BUNNY_STREAM_LIBRARY_ID");
    if (!BUNNY_API_KEY || !BUNNY_LIBRARY_ID) {
      return new Response(JSON.stringify({ error: "Bunny Stream secrets not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const videoGuid: string = (body?.video_guid || "").toString().trim();
    if (!videoGuid) {
      return new Response(JSON.stringify({ error: "video_guid required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let res: Response;
    try {
      res = await fetch(
        `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${videoGuid}`,
        {
          method: "GET",
          headers: { AccessKey: BUNNY_API_KEY, Accept: "application/json" },
        },
      );
    } catch (fetchErr) {
      console.error("Bunny network error:", fetchErr);
      return new Response(
        JSON.stringify({
          error: "BUNNY_NETWORK_ERROR",
          fallback: true,
          video_guid: videoGuid,
          message: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("Bunny get video failed:", res.status, errText);
      // Bunny may return 404 (video missing), 401 (bad key), or 5xx (transient).
      // Return 200 with a fallback flag so the client can skip this row instead
      // of aborting the whole batch sync.
      return new Response(
        JSON.stringify({
          error: res.status === 404 ? "BUNNY_VIDEO_NOT_FOUND" : "BUNNY_API_ERROR",
          fallback: true,
          status: res.status,
          video_guid: videoGuid,
          details: errText || null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const v = await res.json().catch(() => null);
    if (!v) {
      return new Response(
        JSON.stringify({
          error: "BUNNY_INVALID_RESPONSE",
          fallback: true,
          video_guid: videoGuid,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // Bunny returns: length (seconds), status (4 = finished), storageSize, thumbnailFileName ...
    return new Response(
      JSON.stringify({
        length_seconds: v.length ?? 0,
        status: v.status ?? null,
        storage_size: v.storageSize ?? null,
        title: v.title ?? null,
        thumbnail_file_name: v.thumbnailFileName ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("bunny-stream-info error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
