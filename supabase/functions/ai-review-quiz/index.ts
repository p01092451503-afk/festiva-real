// AI 복습 퀴즈: 학습한 차시의 자막/요약을 근거로 개인화 복습 문제를 생성한다.
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
    const contentId = (body?.content_id || "").toString().trim();
    const count = Math.min(10, Math.max(3, Number(body?.count) || 5));
    if (!contentId) return json({ error: "content_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: content } = await admin
      .from("course_contents")
      .select("id, course_id, title, description, transcript")
      .eq("id", contentId)
      .maybeSingle();
    if (!content) return json({ error: "Content not found" }, 404);

    const [{ data: enrollment }, { data: summary }] = await Promise.all([
      admin
        .from("enrollments")
        .select("id")
        .eq("user_id", userId)
        .eq("course_id", content.course_id)
        .maybeSingle(),
      admin
        .from("content_summaries")
        .select("summary, key_points, keywords, transcript")
        .eq("content_id", contentId)
        .maybeSingle(),
    ]);
    if (!enrollment) return json({ error: "수강 중인 강의가 아닙니다." }, 403);

    const transcript = ((content.transcript || "") as string).trim() || (summary?.transcript || "").trim();
    const parts: string[] = [`[차시 제목]\n${content.title}`];
    if (content.description) parts.push(`[설명]\n${content.description}`);
    if (transcript) parts.push(`[전사문]\n${transcript.slice(0, 14000)}`);
    else if (summary?.summary) {
      parts.push(`[요약]\n${summary.summary}`);
      if (Array.isArray(summary.key_points) && summary.key_points.length)
        parts.push(`[핵심 포인트]\n- ${(summary.key_points as string[]).join("\n- ")}`);
    }
    const context = parts.join("\n\n");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI 서비스 미설정" }, 500);

    const prompt = `아래 강의 내용을 근거로 복습용 4지선다 문제 ${count}개를 만들어주세요.

${context}

JSON만 출력하세요.
형식: {"questions": [{"question": "문제", "options": ["보기1","보기2","보기3","보기4"], "answer_index": 0, "explanation": "정답 해설 2문장"}]}
- 모두 한국어
- 강의 내용에 근거한 문제만 (추측 금지)
- 보기는 정확히 4개, answer_index는 0~3
- JSON 외 텍스트 금지`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        messages: [
          { role: "system", content: "당신은 한국어 교육 문항 출제자입니다. 요청된 JSON만 출력합니다." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) return json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, 429);
    if (res.status === 402) return json({ error: "AI 사용 크레딧이 부족합니다." }, 402);
    if (!res.ok) {
      console.error("quiz ai error", res.status, await res.text());
      return json({ error: "문제 생성에 실패했습니다." }, 500);
    }

    const aiJson = await res.json();
    const raw = (aiJson?.choices?.[0]?.message?.content ?? "").toString();
    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    const questions = (Array.isArray(parsed.questions) ? parsed.questions : [])
      .filter((q: any) => q?.question && Array.isArray(q?.options) && q.options.length === 4)
      .slice(0, count)
      .map((q: any) => ({
        question: String(q.question),
        options: q.options.map((o: any) => String(o)),
        answer_index: Math.min(3, Math.max(0, Number(q.answer_index) || 0)),
        explanation: String(q.explanation || ""),
      }));

    if (questions.length === 0) return json({ error: "문제를 생성하지 못했습니다. 다시 시도해주세요." }, 500);

    const { data: quiz, error } = await admin
      .from("review_quizzes")
      .insert({
        user_id: userId,
        content_id: contentId,
        course_id: content.course_id,
        title: content.title,
        questions,
        total: questions.length,
      })
      .select("*")
      .single();
    if (error) throw error;

    return json({ quiz, grounded_in: transcript ? "transcript" : summary?.summary ? "summary" : "metadata" });
  } catch (err) {
    console.error("ai-review-quiz error", err);
    return json({ error: "Internal server error" }, 500);
  }
});
