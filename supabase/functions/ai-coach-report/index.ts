// AI 학습 코치 리포트: 진도·평가·학습 패턴을 분석해 강점/약점/다음 행동을 제안한다.
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

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    const [{ data: enrollments }, { data: progress }, { data: attempts }, { data: wrongNotes }] =
      await Promise.all([
        admin
          .from("enrollments")
          .select("course_id, progress, enrolled_at, courses:course_id(title)")
          .eq("user_id", userId),
        admin
          .from("content_progress")
          .select("content_id, completed, progress_percentage, last_accessed_at, completed_at")
          .eq("user_id", userId),
        admin
          .from("assessment_attempts")
          .select("score, total_points, passed, completed_at")
          .eq("user_id", userId)
          .not("completed_at", "is", null)
          .order("completed_at", { ascending: false })
          .limit(20),
        admin
          .from("review_wrong_notes")
          .select("question, resolved")
          .eq("user_id", userId)
          .eq("resolved", false)
          .limit(20),
      ]);

    const recentDays = new Set(
      (progress || [])
        .filter((p: any) => p.last_accessed_at && p.last_accessed_at >= since)
        .map((p: any) => String(p.last_accessed_at).slice(0, 10)),
    );
    const completed = (progress || []).filter((p: any) => p.completed).length;
    const inProgress = (progress || []).filter((p: any) => !p.completed && Number(p.progress_percentage) > 0).length;
    const avgScore = (attempts || []).length
      ? Math.round(
          (attempts as any[]).reduce(
            (s, a) => s + (Number(a.total_points) ? (Number(a.score) / Number(a.total_points)) * 100 : 0),
            0,
          ) / attempts!.length,
        )
      : null;

    const metrics = {
      courses: (enrollments || []).length,
      avg_course_progress: (enrollments || []).length
        ? Math.round((enrollments as any[]).reduce((s, e) => s + (Number(e.progress) || 0), 0) / enrollments!.length)
        : 0,
      completed_contents: completed,
      in_progress_contents: inProgress,
      active_days_30d: recentDays.size,
      avg_assessment_score: avgScore,
      pass_rate: (attempts || []).length
        ? Math.round(((attempts as any[]).filter((a) => a.passed).length / attempts!.length) * 100)
        : null,
      unresolved_wrong_notes: (wrongNotes || []).length,
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI 서비스 미설정" }, 500);

    const courseLines = (enrollments || [])
      .map((e: any) => `- ${e.courses?.title ?? "강의"}: 진도 ${Math.round(Number(e.progress) || 0)}%`)
      .join("\n");

    const prompt = `아래는 한 학습자의 최근 30일 학습 데이터입니다.

[지표]
${JSON.stringify(metrics, null, 2)}

[수강 강의]
${courseLines || "(없음)"}

[미해결 오답 예시]
${(wrongNotes || []).slice(0, 5).map((w: any) => `- ${w.question}`).join("\n") || "(없음)"}

이 학습자의 자기주도학습을 돕는 코치 리포트를 JSON으로만 출력하세요.
형식: {"summary": "3~4문장 요약", "strengths": ["...", "..."], "weaknesses": ["...", "..."], "actions": ["오늘 당장 할 수 있는 구체적 행동", "...", "..."]}
- 모든 문장은 한국어, 친근하고 격려하는 말투
- actions는 정확히 3개, 각 40자 이내의 구체적 행동
- JSON 외 다른 텍스트 금지`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        messages: [
          { role: "system", content: "당신은 한국어 학습 코치입니다. 요청된 JSON만 출력합니다." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) return json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, 429);
    if (res.status === 402) return json({ error: "AI 사용 크레딧이 부족합니다." }, 402);
    if (!res.ok) {
      console.error("coach ai error", res.status, await res.text());
      return json({ error: "리포트 생성에 실패했습니다." }, 500);
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

    const record = {
      user_id: userId,
      summary: (parsed.summary || "학습 데이터를 분석했습니다.").toString(),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 5) : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.slice(0, 5) : [],
      actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 5) : [],
      metrics,
    };

    const { data: saved, error } = await admin
      .from("ai_coach_reports")
      .insert(record)
      .select("*")
      .single();
    if (error) throw error;

    return json({ report: saved });
  } catch (err) {
    console.error("ai-coach-report error", err);
    return json({ error: "Internal server error" }, 500);
  }
});
