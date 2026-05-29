import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "submit_correction",
    description: "강의 내용과 학생 답안을 비교하여 한국어로 첨삭 결과를 제출합니다.",
    parameters: {
      type: "object",
      properties: {
        corrected_text: { type: "string", description: "학생 답안을 자연스럽고 정확하게 다듬은 한국어 문장." },
        score: { type: "integer", description: "강의 내용과의 일치도/완성도 (0-100)." },
        issues: {
          type: "array",
          description: "주요 첨삭 포인트 목록.",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["문법", "맞춤법", "어휘", "표현", "내용오류", "누락"] },
              original: { type: "string", description: "학생 답안에서 문제가 된 부분." },
              suggestion: { type: "string", description: "수정 제안." },
              explanation: { type: "string", description: "왜 그렇게 고쳐야 하는지 한국어 설명." },
            },
            required: ["type", "original", "suggestion", "explanation"],
            additionalProperties: false,
          },
        },
        suggestions: {
          type: "array",
          description: "강의 핵심에 비춰 더 보강하면 좋을 점 (1-4개).",
          items: { type: "string" },
        },
        overall_feedback: {
          type: "string",
          description: "전체 평가를 2-4문장으로 친절한 튜터처럼 한국어로 작성.",
        },
      },
      required: ["corrected_text", "score", "issues", "suggestions", "overall_feedback"],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const contentId = String(body?.content_id || "").trim();
    const studentAnswer = String(body?.student_answer || "").trim();
    const inputMode = body?.input_mode === "voice" ? "voice" : "text";
    const question = String(body?.question || "").trim();

    if (!contentId || !studentAnswer) {
      return new Response(JSON.stringify({ error: "content_id, student_answer는 필수입니다." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (studentAnswer.length > 4000) {
      return new Response(JSON.stringify({ error: "답안은 최대 4000자까지 가능합니다." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for reference fetch (read-only, public lesson context).
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const { data: content } = await admin
      .from("course_contents")
      .select("title, description")
      .eq("id", contentId)
      .maybeSingle();
    const { data: sum } = await admin
      .from("content_summaries")
      .select("summary, key_points, keywords, transcript, source")
      .eq("content_id", contentId)
      .maybeSingle();

    const referenceParts: string[] = [];
    if (content?.title) referenceParts.push(`[차시 제목]\n${content.title}`);
    if (content?.description) referenceParts.push(`[차시 설명]\n${content.description}`);
    if (sum?.transcript && sum.transcript.trim().length > 30) {
      // 전사문이 있으면 가장 우선 근거로 사용 (모델 토큰 한도 고려해 16k 자만)
      const t = sum.transcript.slice(0, 16000);
      const label =
        sum.source === "youtube_captions" ? "YouTube 자막"
        : sum.source === "vimeo_captions" ? "Vimeo 자막"
        : sum.source === "bunny_captions" ? "Bunny 자막"
        : "강의 자막";
      referenceParts.push(`[${label} 전사문]\n${t}`);
    }
    if (sum?.summary) referenceParts.push(`[강의 요약]\n${sum.summary}`);
    if (Array.isArray(sum?.key_points) && sum.key_points.length > 0) {
      referenceParts.push(`[핵심 포인트]\n- ${(sum.key_points as string[]).join("\n- ")}`);
    }
    if (Array.isArray(sum?.keywords) && sum.keywords.length > 0) {
      referenceParts.push(`[키워드]\n${(sum.keywords as string[]).join(", ")}`);
    }
    const referenceText = referenceParts.join("\n\n") || "(강의 자료가 충분하지 않습니다. 일반적인 한국어 첨삭 기준을 적용하세요. 학생이 먼저 'AI 요약'을 실행하면 자막 분석 결과가 첨삭에도 반영됩니다.)";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `당신은 한국어 학습 콘텐츠를 첨삭하는 전문 튜터입니다.
학생이 강의(차시)를 듣고 작성한 답안을 받아, 강의의 핵심 내용을 기준으로 한국어 표현을 첨삭합니다.

원칙:
- 학생의 의도를 보존하고, 사실을 새로 만들지 않습니다.
- 문법, 맞춤법, 어휘, 표현, 강의 내용 반영도(누락/오류)를 함께 평가합니다.
- 모든 설명과 피드백은 친근하고 명확한 한국어로 작성합니다.
- score는 강의 내용과의 일치도와 한국어 완성도를 종합한 0-100 점수입니다.
- 반드시 제공된 도구(submit_correction)를 호출해 응답하세요. 일반 텍스트로 답하지 마세요.`;

    const userPrompt = `[참고 강의 자료]
${referenceText}

${question ? `[질문/지시]\n${question}\n\n` : ""}[학생 답안]
"""
${studentAnswer}
"""

위 강의 자료를 기준으로 학생 답안을 한국어로 첨삭하세요.`;

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
          { role: "user", content: userPrompt },
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
        return new Response(JSON.stringify({ error: "AI 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI 크레딧이 부족합니다. 워크스페이스 설정에서 충전해주세요." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error ${aiResp.status}`);
    }

    const result = await aiResp.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("AI가 구조화된 첨삭 결과를 반환하지 않았습니다.");
    }
    let parsed: {
      corrected_text: string;
      score: number;
      issues: Array<{ type: string; original: string; suggestion: string; explanation: string }>;
      suggestions: string[];
      overall_feedback: string;
    };
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new Error("AI 응답을 파싱할 수 없습니다.");
    }

    const { data: inserted } = await sb
      .from("lesson_corrections")
      .insert({
        user_id: userId,
        content_id: contentId,
        student_answer: studentAnswer,
        reference_text: referenceText,
        corrected_text: parsed.corrected_text,
        score: parsed.score,
        issues: parsed.issues,
        suggestions: parsed.suggestions,
        overall_feedback: parsed.overall_feedback,
        input_mode: inputMode,
        model: "google/gemini-2.5-flash",
      })
      .select("id, created_at")
      .single();

    return new Response(
      JSON.stringify({
        id: inserted?.id ?? null,
        created_at: inserted?.created_at ?? null,
        ...parsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("lecture-correction error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});