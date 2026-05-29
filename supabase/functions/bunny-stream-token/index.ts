// Returns a Bunny Stream signed iframe embed URL for playback.
// Token Authentication must be enabled on the Bunny Stream library.
// Signature = SHA256(TOKEN_AUTH_KEY + VIDEO_GUID + EXPIRATION)
// The iframe URL: https://iframe.mediadelivery.net/embed/{LIBRARY_ID}/{VIDEO_GUID}?token=...&expires=...

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

    const jwt = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(jwt);
    if (claimsError || !claimsData?.claims) {
      console.error("Auth error:", claimsError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const BUNNY_LIBRARY_ID = Deno.env.get("BUNNY_STREAM_LIBRARY_ID");
    const BUNNY_TOKEN_KEY = Deno.env.get("BUNNY_STREAM_TOKEN_KEY");
    const BUNNY_CDN_HOSTNAME = Deno.env.get("BUNNY_STREAM_CDN_HOSTNAME");
    if (!BUNNY_LIBRARY_ID || !BUNNY_TOKEN_KEY) {
      return new Response(JSON.stringify({ error: "Bunny Stream secrets not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { video_guid } = await req.json();
    if (!video_guid || typeof video_guid !== "string") {
      return new Response(JSON.stringify({ error: "video_guid is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1 hour expiry (shorter window = harder to share/reuse the link)
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const token = await sha256Hex(`${BUNNY_TOKEN_KEY}${video_guid}${expires}`);

    // Only return the signed iframe embed URL. Do NOT expose the direct HLS (.m3u8) URL —
    // browser download extensions (video-downloader-for-chrome, 4saved, etc.) hook
    // .m3u8 / .ts network requests to grab the raw stream.
    const embedUrl = `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${video_guid}?token=${token}&expires=${expires}&autoplay=false&preload=true`;

    return new Response(
      JSON.stringify({ embed_url: embedUrl, expires }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("bunny-stream-token error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
