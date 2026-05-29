// AI 튜터: 차시의 자막(전사문) 또는 요약을 컨텍스트로 사용해
// 학생의 자유 질문에 한국어로 답한다.
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

type ChatMessage = { role: "user" | "assistant"; content: string };

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
    const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];
    if (!contentId) return json({ error: "content_id required" }, 400);
    if (messages.length === 0) return json({ error: "messages required" }, 400);

    // 마지막 메시지는 반드시 user
    const last = messages[messages.length - 1];
    if (!last || last.role !== "user" || !last.content?.trim()) {
      return json({ error: "마지막 메시지는 사용자 질문이어야 합니다." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 차시 + 접근권한 확인
    const { data: content, error: contentErr } = await admin
      .from("course_contents")
      .select("id, course_id, title, description, transcript")
      .eq("id", contentId)
      .maybeSingle();
    if (contentErr || !content) return json({ error: "Content not found" }, 404);

    const [{ data: roles }, { data: enrollment }, { data: course }, { data: summary }] =
      await Promise.all([
        admin.from("user_roles").select("role").eq("user_id", userId),
        admin
          .from("enrollments")
          .select("id")
          .eq("user_id", userId)
          .eq("course_id", content.course_id)
          .maybeSingle(),
        admin.from("courses").select("instructor_id").eq("id", content.course_id).maybeSingle(),
        admin
          .from("content_summaries")
          .select("summary, key_points, keywords, transcript, transcript_chars")
          .eq("content_id", contentId)
          .maybeSingle(),
      ]);

    const isStaff = (roles || []).some((r: any) =>
      ["admin", "super_admin", "teacher"].includes(r.role),
    );
    const isInstructor = course?.instructor_id === userId;
    if (!isStaff && !isInstructor && !enrollment) {
      return json({ error: "Forbidden" }, 403);
    }

    // 컨텍스트 구성: (1) 강사가 등록한 자막 > (2) 요약 캐시의 전사문 > (3) 요약/키포인트 > (4) 메타데이터
    const manualTranscript = (content.transcript || "").toString().trim();
    const cachedTranscript = (summary?.transcript || "").trim();
    const transcript = manualTranscript || cachedTranscript;
    const summaryText = (summary?.summary || "").trim();
    const keyPoints: string[] = Array.isArray(summary?.key_points) ? summary!.key_points : [];
    const keywords: string[] = Array.isArray(summary?.keywords) ? summary!.keywords : [];

    const parts: string[] = [];
    parts.push(`[차시 제목]\n${content.title}`);
    if (content.description) parts.push(`[차시 설명]\n${content.description}`);
    if (transcript) {
      parts.push(`[강의 전사문(자막) — 최대 18,000자]\n${transcript.slice(0, 18000)}`);
    } else if (summaryText) {
      parts.push(`[강의 요약]\n${summaryText}`);
      if (keyPoints.length) parts.push(`[핵심 포인트]\n- ${keyPoints.join("\n- ")}`);
      if (keywords.length) parts.push(`[키워드]\n${keywords.join(", ")}`);
    }
    const lectureContext = parts.join("\n\n");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI 서비스 미설정" }, 500);

    const systemPrompt = `당신은 학생의 학습을 돕는 친절한 한국어 AI 튜터입니다.
아래 [강의 컨텍스트]를 최우선 근거로 사용해 학생의 질문에 답합니다.

규칙:
1) 강의 컨텍스트에 답이 있으면 그 내용을 바탕으로 정확하게 설명하세요.
2) 강의 컨텍스트에 없는 내용을 물어보면 "강의에서는 다루지 않았지만…" 이라고 밝힌 뒤 일반 지식으로 보완해 주세요.
3) 답변은 마크다운으로 작성하고, 가능하면 핵심을 짧은 문단·목록으로 정리하세요.
4) 학생이 이해하기 쉬운 평이한 말투를 사용하고, 필요 시 예시를 들어주세요.
5) 모르는 것은 솔직히 모른다고 말하세요.

[강의 컨텍스트]
${lectureContext}`;

    const model = "google/gemini-2.5-flash";
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
          ...messages.slice(-12).map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (aiRes.status === 429)
      return json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, 429);
    if (aiRes.status === 402) return json({ error: "AI 사용 크레딧이 부족합니다." }, 402);
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI gateway error", aiRes.status, txt);
      return json({ error: "AI 튜터 응답 생성 실패" }, 500);
    }
    const aiJson = await aiRes.json();
    const reply: string = (aiJson?.choices?.[0]?.message?.content ?? "").toString().trim();
    if (!reply) return json({ error: "AI 응답이 비었습니다." }, 500);

    return json({
      reply,
      grounded_in: transcript
        ? "transcript"
        : summaryText
          ? "summary"
          : "metadata",
    });
  } catch (err) {
    console.error("lecture-tutor error", err);
    return json({ error: "Internal server error" }, 500);
  }
});