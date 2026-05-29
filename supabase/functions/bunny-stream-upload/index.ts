// Creates a Bunny Stream video entry and returns a presigned upload URL.
// Flow:
// 1) Verify the caller is an authenticated admin/teacher.
// 2) Call Bunny API: POST /library/{LIB_ID}/videos  -> creates a video, returns { guid }
// 3) Build a TUS-compatible signed upload URL (Bunny Stream supports direct PUT to https://video.bunnycdn.com/library/{LIB_ID}/videos/{guid})
//    Signature = SHA256(LIBRARY_ID + API_KEY + EXPIRATION + VIDEO_GUID)
//    The browser uploads the file with PUT, sending AccessKey + the signed headers.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

    // Role check (admin or teacher only)
    const { data: roles } = await supabase
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
    const BUNNY_CDN_HOSTNAME = Deno.env.get("BUNNY_STREAM_CDN_HOSTNAME");
    if (!BUNNY_API_KEY || !BUNNY_LIBRARY_ID || !BUNNY_CDN_HOSTNAME) {
      return new Response(JSON.stringify({ error: "Bunny Stream secrets not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const title: string = (body?.title || "Untitled").toString().slice(0, 200);

    // 1) Create video entry in Bunny Stream
    const createRes = await fetch(
      `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          AccessKey: BUNNY_API_KEY,
        },
        body: JSON.stringify({ title }),
      },
    );

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error("Bunny create video failed:", createRes.status, errText);
      return new Response(JSON.stringify({ error: "Bunny create video failed", details: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const created = await createRes.json();
    const videoGuid: string = created.guid;

    // 2) Build TUS-compatible signed upload signature
    // Bunny TUS endpoint: https://video.bunnycdn.com/tusupload
    // Required metadata: filetype, title, AuthorizationSignature, AuthorizationExpire, VideoId, LibraryId
    const expiration = Math.floor(Date.now() / 1000) + 3600; // 1 hour
    const signature = await sha256Hex(`${BUNNY_LIBRARY_ID}${BUNNY_API_KEY}${expiration}${videoGuid}`);

    // Public direct PUT URL (alternative to TUS) — simpler for browser uploads
    const directPutUrl = `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${videoGuid}`;

    return new Response(
      JSON.stringify({
        video_guid: videoGuid,
        library_id: BUNNY_LIBRARY_ID,
        cdn_hostname: BUNNY_CDN_HOSTNAME,
        // TUS upload params
        tus_endpoint: "https://video.bunnycdn.com/tusupload",
        tus_signature: signature,
        tus_expiration: expiration,
        // Or use direct PUT (with AccessKey header — needs proxy; prefer TUS in browser)
        direct_put_url: directPutUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("bunny-stream-upload error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
