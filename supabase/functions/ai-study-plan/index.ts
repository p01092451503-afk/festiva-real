// AI 학습 플래너: 남은 차시를 목표일까지 요일별로 자동 배분하고, AI가 학습 조언을 덧붙인다.
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
    const courseId = (body?.course_id || "").toString().trim();
    const goalDate = (body?.goal_date || "").toString().trim();
    const dailyMinutes = Math.min(600, Math.max(10, Number(body?.daily_minutes) || 30));
    const studyDays: number[] = Array.isArray(body?.study_days) && body.study_days.length
      ? body.study_days.map((d: unknown) => Number(d)).filter((d: number) => d >= 0 && d <= 6)
      : [1, 2, 3, 4, 5];

    if (!courseId) return json({ error: "course_id required" }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(goalDate)) return json({ error: "goal_date required (YYYY-MM-DD)" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: enrollment } = await admin
      .from("enrollments")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (!enrollment) return json({ error: "수강 중인 강의가 아닙니다." }, 403);

    const [{ data: course }, { data: contents }, { data: progress }] = await Promise.all([
      admin.from("courses").select("id, title").eq("id", courseId).maybeSingle(),
      admin
        .from("course_contents")
        .select("id, title, duration_minutes, order_index")
        .eq("course_id", courseId)
        .eq("is_published", true)
        .order("order_index", { ascending: true }),
      admin.from("content_progress").select("content_id, completed").eq("user_id", userId),
    ]);

    const doneIds = new Set((progress || []).filter((p: any) => p.completed).map((p: any) => p.content_id));
    const remaining = (contents || []).filter((c: any) => !doneIds.has(c.id));
    if (remaining.length === 0) return json({ error: "이미 모든 차시를 완료했습니다." }, 400);

    // 목표일까지 학습 가능한 날짜 목록
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(`${goalDate}T00:00:00`);
    const days: string[] = [];
    for (let d = new Date(today); d <= end; d.setDate(d.getDate() + 1)) {
      if (studyDays.includes(d.getDay())) days.push(d.toISOString().slice(0, 10));
    }
    if (days.length === 0) return json({ error: "선택한 요일에 학습 가능한 날짜가 없습니다." }, 400);

    // 하루 학습시간 한도를 지키면서 순서대로 배분 (넘치면 마지막 날에 몰아넣지 않고 하루 정원 확대)
    const items: { content_id: string; title: string; scheduled_date: string; estimated_minutes: number; order_index: number }[] = [];
    const totalMinutes = remaining.reduce((s: number, c: any) => s + (Number(c.duration_minutes) || 10), 0);
    const capacity = Math.max(dailyMinutes, Math.ceil(totalMinutes / days.length));
    let dayIdx = 0;
    let used = 0;
    remaining.forEach((c: any, i: number) => {
      const mins = Number(c.duration_minutes) || 10;
      if (used > 0 && used + mins > capacity && dayIdx < days.length - 1) {
        dayIdx += 1;
        used = 0;
      }
      used += mins;
      items.push({
        content_id: c.id,
        title: c.title,
        scheduled_date: days[dayIdx],
        estimated_minutes: mins,
        order_index: i,
      });
    });

    // AI 조언
    let advice = "";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY) {
      const prompt = `학습자가 "${course?.title ?? "강의"}" 강의를 ${goalDate}까지 완료하려고 합니다.
남은 차시 ${remaining.length}개, 총 예상 학습시간 ${totalMinutes}분, 학습 가능일 ${days.length}일, 하루 목표 ${dailyMinutes}분.
차시 제목 일부: ${remaining.slice(0, 12).map((c: any) => c.title).join(", ")}

이 계획이 현실적인지 판단하고, 자기주도학습을 위한 조언을 한국어 마크다운으로 6줄 이내로 작성하세요.
- 하루 학습 루틴 제안 1가지
- 계획이 빡빡하면 조정 방법 제안
- 복습·정리 습관 제안 1가지`;
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
          body: JSON.stringify({
            model: "openai/gpt-5.6-sol",
            messages: [
              { role: "system", content: "당신은 친절한 한국어 학습 코치입니다. 간결하게 답합니다." },
              { role: "user", content: prompt },
            ],
          }),
        });
        if (res.ok) {
          const j = await res.json();
          advice = (j?.choices?.[0]?.message?.content ?? "").toString().trim();
        } else {
          console.error("ai advice failed", res.status, await res.text());
        }
      } catch (e) {
        console.error("ai advice error", e);
      }
    }

    // 기존 활성 계획은 보관 처리
    await admin
      .from("study_plans")
      .update({ status: "archived" })
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .eq("status", "active");

    const { data: plan, error: planErr } = await admin
      .from("study_plans")
      .insert({
        user_id: userId,
        course_id: courseId,
        goal_date: goalDate,
        daily_minutes: dailyMinutes,
        study_days: studyDays,
        ai_advice: advice || null,
      })
      .select("id")
      .single();
    if (planErr) throw planErr;

    const { error: itemsErr } = await admin
      .from("study_plan_items")
      .insert(items.map((it) => ({ ...it, plan_id: plan.id, user_id: userId })));
    if (itemsErr) throw itemsErr;

    return json({ plan_id: plan.id, items: items.length, advice });
  } catch (err) {
    console.error("ai-study-plan error", err);
    return json({ error: "Internal server error" }, 500);
  }
});
