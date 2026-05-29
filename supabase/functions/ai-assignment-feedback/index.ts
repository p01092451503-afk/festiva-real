import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "submit_assignment_feedback",
    description: "학생 과제 제출물을 검토하여 한국어로 상세 피드백을 제출합니다.",
    parameters: {
      type: "object",
      properties: {
        suggested_score: { type: "integer", description: "과제 만점 대비 추천 점수 (정수)." },
        summary: { type: "string", description: "제출물에 대한 2-3문장 종합 평가 (한국어)." },
        strengths: {
          type: "array",
          description: "잘한 점 2-4개.",
          items: { type: "string" },
        },
        improvements: {
          type: "array",
          description: "개선이 필요한 점 2-5개. 구체적이고 실행 가능하게.",
          items: { type: "string" },
        },
        rubric: {
          type: "array",
          description: "평가 항목별 점수(0-100)와 코멘트. 항목 3-5개.",
          items: {
            type: "object",
            properties: {
              criterion: { type: "string", description: "예: 내용 충실도, 논리 구조, 문법/표현, 형식" },
              score: { type: "integer", description: "0-100" },
              comment: { type: "string" },
            },
            required: ["criterion", "score", "comment"],
            additionalProperties: false,
          },
        },
        next_steps: {
          type: "string",
          description: "학습자가 다음에 시도해보면 좋을 행동/연습 (2-3문장).",
        },
      },
      required: ["suggested_score", "summary", "strengths", "improvements", "rubric", "next_steps"],
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

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    // Authorization: teacher of course OR admin/super_admin
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles || []).some((r: any) =>
      ["admin", "super_admin", "teacher"].includes(r.role),
    );

    const body = await req.json();
    const submissionId = String(body?.submission_id || "").trim();
    if (!submissionId) {
      return new Response(JSON.stringify({ error: "submission_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sub, error: subErr } = await admin
      .from("assignment_submissions")
      .select("id, submission_text, file_urls, assignment_id, student_id, assignments(title, description, instructions, max_score, course_id, courses(title, instructor_id))")
      .eq("id", submissionId)
      .maybeSingle();
    if (subErr || !sub) {
      return new Response(JSON.stringify({ error: "Submission not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const assignment: any = (sub as any).assignments;
    const isInstructor = assignment?.courses?.instructor_id === userId;
    if (!isAdmin && !isInstructor) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const submissionText = String((sub as any).submission_text || "").trim();
    if (!submissionText) {
      return new Response(JSON.stringify({ error: "제출 내용이 비어 있어 AI 피드백을 생성할 수 없습니다." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const maxScore = assignment?.max_score || 100;

    const referenceParts: string[] = [];
    if (assignment?.courses?.title) referenceParts.push(`[강의]\n${assignment.courses.title}`);
    if (assignment?.title) referenceParts.push(`[과제 제목]\n${assignment.title}`);
    if (assignment?.description) referenceParts.push(`[과제 설명]\n${assignment.description}`);
    if (assignment?.instructions) referenceParts.push(`[과제 지시사항]\n${assignment.instructions}`);
    referenceParts.push(`[만점]\n${maxScore}`);
    const referenceText = referenceParts.join("\n\n");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `당신은 한국어 교육 현장의 전문 평가자입니다.
학생이 제출한 과제(에세이, 코드, 보고서 등)를 과제 지시사항과 만점 기준에 따라 공정하고 건설적으로 평가합니다.

원칙:
- 강점과 개선점을 균형 있게 제시합니다.
- 추천 점수(suggested_score)는 반드시 0 이상 만점(${maxScore}) 이하 정수입니다.
- rubric 항목 점수는 0-100 범위로 채점합니다.
- 모든 출력은 친절하고 명확한 한국어로 작성하며, 학습자가 다음 학습으로 연결할 수 있도록 합니다.
- 반드시 제공된 도구(submit_assignment_feedback)를 호출해 응답하세요.`;

    const userPrompt = `${referenceText}

[학생 제출물]
"""
${submissionText.slice(0, 8000)}
"""

위 과제 지시사항과 만점 기준에 따라 학생 제출물을 한국어로 평가하고 피드백을 작성하세요.`;

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
        tool_choice: { type: "function", function: { name: "submit_assignment_feedback" } },
        temperature: 0.4,
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
      throw new Error("AI가 구조화된 피드백 결과를 반환하지 않았습니다.");
    }
    let parsed: {
      suggested_score: number;
      summary: string;
      strengths: string[];
      improvements: string[];
      rubric: Array<{ criterion: string; score: number; comment: string }>;
      next_steps: string;
    };
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new Error("AI 응답을 파싱할 수 없습니다.");
    }

    // Clamp score
    parsed.suggested_score = Math.max(0, Math.min(maxScore, Math.round(parsed.suggested_score || 0)));

    return new Response(JSON.stringify({ ok: true, ...parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-assignment-feedback error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});