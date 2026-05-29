import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Tone = "neutral" | "formal" | "casual" | "business" | "academic";

interface CorrectRequest {
  text: string;
  tone?: Tone;
}

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "submit_correction",
    description: "Return a corrected English text with detailed analysis.",
    parameters: {
      type: "object",
      properties: {
        corrected_text: {
          type: "string",
          description: "The fully corrected English version of the user's text.",
        },
        diffs: {
          type: "array",
          description:
            "Word/phrase-level diff sequence reconstructing the corrected text in order. Use 'equal' for unchanged spans, 'remove' for original-only, 'add' for corrected-only.",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["equal", "add", "remove"] },
              text: { type: "string" },
            },
            required: ["type", "text"],
            additionalProperties: false,
          },
        },
        issues: {
          type: "array",
          description: "List of meaningful corrections with Korean explanations.",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["grammar", "spelling", "vocabulary", "style", "punctuation"],
              },
              original: { type: "string" },
              suggestion: { type: "string" },
              explanation_ko: { type: "string", description: "Brief Korean explanation." },
            },
            required: ["type", "original", "suggestion", "explanation_ko"],
            additionalProperties: false,
          },
        },
        alternatives: {
          type: "array",
          description: "1-3 alternative natural phrasings of the whole sentence.",
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              note_ko: { type: "string" },
            },
            required: ["text", "note_ko"],
            additionalProperties: false,
          },
        },
        cefr_level: {
          type: "string",
          enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
          description: "Estimated CEFR level of the original text.",
        },
        overall_feedback_ko: {
          type: "string",
          description: "Brief overall feedback in Korean (2-4 sentences).",
        },
      },
      required: [
        "corrected_text",
        "diffs",
        "issues",
        "alternatives",
        "cefr_level",
        "overall_feedback_ko",
      ],
      additionalProperties: false,
    },
  },
};

const TONE_GUIDE: Record<Tone, string> = {
  neutral: "Keep a natural, neutral register.",
  formal: "Use formal, polite English suitable for official communication.",
  casual: "Use casual, friendly conversational English.",
  business: "Use professional business English; concise and confident.",
  academic: "Use academic English; precise vocabulary and clear structure.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as CorrectRequest;
    const text = (body.text || "").trim();
    const tone: Tone = (body.tone as Tone) || "neutral";

    if (!text) {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (text.length > 4000) {
      return new Response(
        JSON.stringify({ error: "텍스트는 최대 4000자까지 가능합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an expert English writing tutor for Korean learners.
Your job is to correct the user's English text and explain the changes.
Rules:
- Preserve the user's intended meaning. Do NOT add new content or invent facts.
- Fix grammar, spelling, punctuation, awkward phrasing, and word choice.
- Tone preference: ${tone.toUpperCase()} — ${TONE_GUIDE[tone]}
- The 'diffs' array MUST reconstruct the corrected text exactly when concatenating 'equal' and 'add' segments in order.
- 'issues' should list only meaningful changes (skip whitespace-only changes). Explanations must be in Korean (한국어).
- 'alternatives' should provide 1-3 different natural rewrites of the whole text.
- Estimate CEFR level (A1-C2) based on the ORIGINAL text.
- 'overall_feedback_ko' is a short Korean tutor-style feedback (2-4 sentences) noting strengths and main areas to improve.
- ALWAYS respond by calling the provided tool. Never reply in plain text.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Original text:\n"""\n${text}\n"""` },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "submit_correction" } },
        temperature: 0.3,
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI 크레딧이 부족합니다. 워크스페이스 설정에서 충전해주세요." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw new Error(`AI gateway error ${aiResp.status}`);
    }

    const result = await aiResp.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return a structured correction");
    }

    let parsed: {
      corrected_text: string;
      diffs: Array<{ type: "equal" | "add" | "remove"; text: string }>;
      issues: Array<{ type: string; original: string; suggestion: string; explanation_ko: string }>;
      alternatives: Array<{ text: string; note_ko: string }>;
      cefr_level: string;
      overall_feedback_ko: string;
    };
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new Error("AI returned invalid JSON");
    }

    // Persist history
    const { data: inserted, error: insertErr } = await sb
      .from("english_corrections")
      .insert({
        user_id: userData.user.id,
        original_text: text,
        corrected_text: parsed.corrected_text,
        diffs: parsed.diffs,
        issues: parsed.issues,
        alternatives: parsed.alternatives,
        cefr_level: parsed.cefr_level,
        overall_feedback_ko: parsed.overall_feedback_ko,
        tone,
        model: "google/gemini-2.5-flash",
      })
      .select("id, created_at")
      .single();

    if (insertErr) {
      console.error("Insert error:", insertErr);
    }

    return new Response(
      JSON.stringify({
        id: inserted?.id ?? null,
        created_at: inserted?.created_at ?? null,
        original_text: text,
        tone,
        model: "google/gemini-2.5-flash",
        usage: result?.usage ?? null,
        ...parsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("correct-english error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});