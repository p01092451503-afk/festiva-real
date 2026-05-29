// Generate (or fetch cached) AI summary for a course lesson.
// 1) YouTube → 공개 caption track 자동 추출
// 2) Vimeo → player config의 text_tracks 자동 추출
// 3) Bunny Stream → API caption 추출
// 4) 위 셋 모두 실패 시 title+description 메타데이터 폴백
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Strip VTT/SRT timing & cue markers, return plain text
const stripCaptions = (raw: string): string => {
  return raw
    .replace(/WEBVTT.*?\n/g, "")
    .replace(/^\d+\s*$/gm, "")
    .replace(/\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}.*$/gm, "")
    .replace(/<[^>]+>/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};

// Extract YouTube video id from any common URL form
const extractYouTubeId = (url?: string | null): string | null => {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
  );
  return m ? m[1] : null;
};

// Extract Vimeo numeric id
const extractVimeoId = (url?: string | null): string | null => {
  if (!url) return null;
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d{6,})/);
  return m ? m[1] : null;
};

// Parse XML caption track from YouTube timedtext API (fmt=srv3 / default)
const parseYouTubeTimedText = (xml: string): string => {
  // Tags look like <text start="0.0" dur="3.4">hello</text>
  const parts: string[] = [];
  const re = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const decoded = m[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
      .replace(/<[^>]+>/g, "")
      .trim();
    if (decoded) parts.push(decoded);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
};

async function fetchYouTubeCaptions(videoId: string): Promise<{ text: string; lang: string } | null> {
  // YouTube 공개 caption: 1) 한국어 → 2) 영어 → 3) 자동 한국어 → 4) 자동 영어
  const tries: Array<{ url: string; lang: string }> = [
    { url: `https://www.youtube.com/api/timedtext?lang=ko&v=${videoId}`, lang: "ko" },
    { url: `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`, lang: "en" },
    { url: `https://www.youtube.com/api/timedtext?lang=ko&kind=asr&v=${videoId}`, lang: "ko" },
    { url: `https://www.youtube.com/api/timedtext?lang=en&kind=asr&v=${videoId}`, lang: "en" },
  ];
  for (const t of tries) {
    try {
      const res = await fetch(t.url);
      if (!res.ok) continue;
      const xml = await res.text();
      if (!xml || xml.length < 30) continue;
      const parsed = parseYouTubeTimedText(xml);
      if (parsed.length > 50) return { text: parsed, lang: t.lang };
    } catch (e) {
      console.warn("youtube caption attempt failed", t.url, e);
    }
  }
  return null;
}

async function fetchVimeoCaptions(videoId: string): Promise<{ text: string; lang: string } | null> {
  try {
    const cfgRes = await fetch(`https://player.vimeo.com/video/${videoId}/config`, {
      headers: { Referer: "https://vimeo.com" },
    });
    if (!cfgRes.ok) return null;
    const cfg = await cfgRes.json();
    const tracks: any[] = cfg?.request?.text_tracks || [];
    if (!Array.isArray(tracks) || tracks.length === 0) return null;
    const pick =
      tracks.find((x) => /^ko/i.test(x.lang)) ||
      tracks.find((x) => /^en/i.test(x.lang)) ||
      tracks[0];
    if (!pick?.url) return null;
    const vttUrl = pick.url.startsWith("http") ? pick.url : `https://player.vimeo.com${pick.url}`;
    const vttRes = await fetch(vttUrl);
    if (!vttRes.ok) return null;
    const txt = stripCaptions(await vttRes.text());
    return txt.length > 50 ? { text: txt, lang: pick.lang || "en" } : null;
  } catch (e) {
    console.warn("vimeo captions fetch failed", e);
    return null;
  }
}

async function fetchBunnyCaptions(guid: string): Promise<string | null> {
  const apiKey = Deno.env.get("BUNNY_STREAM_API_KEY");
  const libId = Deno.env.get("BUNNY_STREAM_LIBRARY_ID");
  const cdnHost = Deno.env.get("BUNNY_STREAM_CDN_HOSTNAME");
  if (!apiKey || !libId) return null;
  try {
    const metaRes = await fetch(
      `https://video.bunnycdn.com/library/${libId}/videos/${guid}`,
      { headers: { AccessKey: apiKey, Accept: "application/json" } },
    );
    if (!metaRes.ok) return null;
    const meta = await metaRes.json();
    const captions = Array.isArray(meta?.captions) ? meta.captions : [];
    if (captions.length === 0) return null;
    // Prefer ko, then en, then first available
    const pick =
      captions.find((c: any) => /^ko/i.test(c.srclang)) ||
      captions.find((c: any) => /^en/i.test(c.srclang)) ||
      captions[0];
    if (!pick?.srclang) return null;
    const host = cdnHost || `vz-${libId}.b-cdn.net`;
    const vttUrl = `https://${host}/${guid}/captions/${pick.srclang}.vtt`;
    const vttRes = await fetch(vttUrl);
    if (!vttRes.ok) return null;
    const txt = await vttRes.text();
    const stripped = stripCaptions(txt);
    return stripped.length > 50 ? stripped : null;
  } catch (e) {
    console.warn("bunny captions fetch failed", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const contentId: string = (body?.content_id || "").toString().trim();
    const force = !!body?.force;
    if (!contentId) return json({ error: "content_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load content + verify access (enrolled / instructor / admin)
    const { data: content, error: contentErr } = await admin
      .from("course_contents")
      .select("id, course_id, title, description, video_provider, video_url, bunny_video_guid, transcript")
      .eq("id", contentId)
      .maybeSingle();
    if (contentErr || !content) return json({ error: "Content not found" }, 404);

    const [{ data: roles }, { data: enrollment }, { data: course }] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", userId),
      admin
        .from("enrollments")
        .select("id")
        .eq("user_id", userId)
        .eq("course_id", content.course_id)
        .maybeSingle(),
      admin.from("courses").select("instructor_id").eq("id", content.course_id).maybeSingle(),
    ]);
    const isAdmin = (roles || []).some((r: any) =>
      ["admin", "super_admin", "teacher"].includes(r.role),
    );
    const isInstructor = course?.instructor_id === userId;
    if (!isAdmin && !isInstructor && !enrollment) {
      return json({ error: "Forbidden" }, 403);
    }

    // Return cache unless force
    if (!force) {
      const { data: cached } = await admin
        .from("content_summaries")
        .select("*")
        .eq("content_id", contentId)
        .maybeSingle();
      if (cached) return json({ cached: true, summary: cached });
    }

    // Gather source material
    type SourceKind =
      | "manual_transcript"
      | "youtube_captions"
      | "vimeo_captions"
      | "bunny_captions"
      | "metadata";
    let source: SourceKind = "metadata";
    let transcript = "";
    let transcriptLang: string | null = null;

    // 0) 강사가 직접 등록한 자막(course_contents.transcript) — 최우선
    const manualTranscript = (content.transcript || "").toString().trim();
    if (manualTranscript) {
      transcript = manualTranscript;
      transcriptLang = "ko";
      source = "manual_transcript";
    }

    // 1) YouTube
    const ytId = extractYouTubeId(content.video_url);
    if (!transcript && ytId) {
      const yt = await fetchYouTubeCaptions(ytId);
      if (yt) {
        transcript = yt.text;
        transcriptLang = yt.lang;
        source = "youtube_captions";
      }
    }
    // 2) Vimeo
    const vmId = !transcript ? extractVimeoId(content.video_url) : null;
    if (vmId) {
      const vm = await fetchVimeoCaptions(vmId);
      if (vm) {
        transcript = vm.text;
        transcriptLang = vm.lang;
        source = "vimeo_captions";
      }
    }
    // 3) Bunny
    // bunny_video_guid 가 비어있을 수 있으니 video_url 의 bunny://<guid> 패턴도 함께 인식
    let bunnyGuid: string | null = content.bunny_video_guid || null;
    if (!bunnyGuid && typeof content.video_url === "string") {
      const m = content.video_url.match(/^bunny:\/\/([\w-]+)/i);
      if (m) bunnyGuid = m[1];
    }
    if (!transcript && bunnyGuid) {
      const captions = await fetchBunnyCaptions(bunnyGuid);
      if (captions) {
        transcript = captions;
        transcriptLang = "ko";
        source = "bunny_captions";
      }
    }

    // 분석에 사용할 본문(전사문 우선, 없으면 메타데이터)
    const metaText = [content.title, content.description].filter(Boolean).join("\n\n");
    const material = transcript ? transcript.slice(0, 40000) : metaText;

    // 자막도 없고 제목/설명도 거의 없는 극단적인 경우에만 실패
    if (!material || material.trim().length < 2) {
      console.log("INSUFFICIENT_MATERIAL", {
        contentId,
        title: content.title,
        descLen: (content.description || "").length,
        transcriptLen: transcript.length,
        metaTextLen: metaText.length,
      });
      return json(
        {
          error:
            "요약할 콘텐츠 정보가 부족합니다. 차시에 제목/설명을 입력하거나, 동영상에 자막(YouTube/Vimeo/Bunny)을 등록해 주세요.",
        },
        422,
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI 서비스 미설정" }, 500);

    const model = "google/gemini-2.5-flash";
    const systemPrompt =
      "당신은 한국어 교육 콘텐츠 요약 전문가입니다. 강의 자료를 학생이 복습할 수 있도록 간결하고 정확하게 요약합니다.";
    const sourceLabel =
      source === "manual_transcript" ? "강사가 등록한 강의 자막 전체"
      : source === "youtube_captions" ? "YouTube 자막 전체"
      : source === "vimeo_captions" ? "Vimeo 자막 전체"
      : source === "bunny_captions" ? "Bunny Stream 자막 전체"
      : "차시 메타데이터(제목·설명)";
    const userPrompt = `다음 강의 차시의 ${sourceLabel}를 분석하여 학습 요약을 작성해주세요.

[차시 제목]
${content.title}

[원본 자료]
${material}

요구사항:
- summary: 4~6문장으로 핵심 내용을 자연스러운 한국어로 요약
- key_points: 학습자가 기억해야 할 핵심 포인트 4~7개 (각 1문장)
- keywords: 본문에서 가장 중요한 키워드/용어 5~10개

반드시 JSON 한 객체로만 응답하세요. 예: {"summary":"...","key_points":["..."],"keywords":["..."]}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiRes.status === 429) return json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, 429);
    if (aiRes.status === 402) return json({ error: "AI 사용 크레딧이 부족합니다." }, 402);
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI gateway error", aiRes.status, txt);
      return json({ error: "AI 요약 생성 실패" }, 500);
    }
    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { summary?: string; key_points?: string[]; keywords?: string[] };
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      parsed = { summary: String(raw).slice(0, 2000) };
    }
    const summaryText = (parsed.summary || "").trim();
    if (!summaryText) return json({ error: "요약 본문이 비었습니다." }, 500);
    const keyPoints = Array.isArray(parsed.key_points)
      ? parsed.key_points.filter((x) => typeof x === "string").slice(0, 12)
      : [];
    const keywords = Array.isArray(parsed.keywords)
      ? parsed.keywords.filter((x) => typeof x === "string").slice(0, 15)
      : [];

    const { data: upserted, error: upsertErr } = await admin
      .from("content_summaries")
      .upsert(
        {
          content_id: contentId,
          summary: summaryText,
          key_points: keyPoints,
          keywords: keywords,
          source,
          language: "ko",
          model,
          transcript: transcript || null,
          transcript_lang: transcriptLang,
          transcript_chars: transcript ? transcript.length : null,
        },
        { onConflict: "content_id" },
      )
      .select("*")
      .maybeSingle();
    if (upsertErr) {
      console.error("upsert error", upsertErr);
      return json({ error: "요약 저장 실패" }, 500);
    }
    return json({ cached: false, summary: upserted });
  } catch (err) {
    console.error("summarize-content error", err);
    return json({ error: "Internal server error" }, 500);
  }
});