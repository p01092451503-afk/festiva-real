// Lists all videos in the configured Bunny Stream library.
// Used by the admin "Bunny에서 가져오기" picker so the team can pull videos
// uploaded directly to bunny.net into the local video_assets registry.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BunnyVideo {
  guid: string;
  title: string;
  length: number;
  storageSize: number;
  status: number;
  thumbnailFileName?: string;
  dateUploaded?: string;
}

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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const allowed = (roles || []).some((r: { role: string }) =>
      ["admin", "super_admin", "teacher"].includes(r.role)
    );
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const BUNNY_API_KEY = Deno.env.get("BUNNY_STREAM_API_KEY");
    const BUNNY_LIBRARY_ID = Deno.env.get("BUNNY_STREAM_LIBRARY_ID");
    const BUNNY_PULL_ZONE = Deno.env.get("BUNNY_STREAM_PULL_ZONE") || "";
    if (!BUNNY_API_KEY || !BUNNY_LIBRARY_ID) {
      return new Response(
        JSON.stringify({ error: "Bunny Stream secrets not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Bunny paginates with itemsPerPage (max 1000). Walk pages until empty.
    const all: BunnyVideo[] = [];
    const itemsPerPage = 100;
    let page = 1;
    while (true) {
      const url =
        `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos` +
        `?page=${page}&itemsPerPage=${itemsPerPage}&orderBy=date`;
      const res = await fetch(url, {
        method: "GET",
        headers: { AccessKey: BUNNY_API_KEY, Accept: "application/json" },
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("Bunny list failed", res.status, txt);
        return new Response(
          JSON.stringify({
            error: "BUNNY_LIST_FAILED",
            status: res.status,
            details: txt || null,
          }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const data = await res.json();
      const items: BunnyVideo[] = data?.items || [];
      all.push(...items);
      if (items.length < itemsPerPage) break;
      page += 1;
      if (page > 50) break; // safety stop at 5000 videos
    }

    const videos = all.map((v) => {
      const thumbnail = v.thumbnailFileName && BUNNY_PULL_ZONE
        ? `https://${BUNNY_PULL_ZONE}/${v.guid}/${v.thumbnailFileName}`
        : null;
      return {
        guid: v.guid,
        title: v.title || "(제목 없음)",
        length_seconds: v.length || 0,
        storage_size_bytes: v.storageSize || 0,
        status: v.status,
        thumbnail_url: thumbnail,
        date_uploaded: v.dateUploaded || null,
      };
    });

    return new Response(
      JSON.stringify({ videos, total: videos.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("bunny-stream-list error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});