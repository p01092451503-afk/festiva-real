// AI Progress Prediction — analyzes learner engagement and predicts completion
// + dropout risk per course/learner. Admin-only. Uses Lovable AI Gateway.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const MODEL = "google/gemini-3-flash-preview";

function svc() {
  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type LearnerSnapshot = {
  user_id: string;
  name: string;
  email: string;
  enrolled_at: string;
  current_progress: number;
  completed: boolean;
  total_contents: number;
  completed_contents: number;
  avg_content_progress: number;
  last_accessed_at: string | null;
  days_since_last_access: number | null;
  days_since_enrolled: number;
  assignments_submitted: number;
  assignments_graded_avg: number | null;
  assessment_attempts: number;
  assessment_pass_rate: number | null;
  attendance_count_30d: number;
};

async function buildSnapshots(db: ReturnType<typeof svc>, courseId: string): Promise<LearnerSnapshot[]> {
  // Enrollments for this course
  const { data: enrollments, error: enrollErr } = await db
    .from("enrollments")
    .select("user_id, enrolled_at, progress, completed_at, status")
    .eq("course_id", courseId)
    .eq("status", "approved");
  if (enrollErr) throw enrollErr;
  if (!enrollments || enrollments.length === 0) return [];

  const userIds = enrollments.map((e) => e.user_id);

  // Profiles
  const { data: profiles } = await db
    .from("profiles")
    .select("user_id, full_name, email")
    .in("user_id", userIds);
  const pmap = new Map((profiles || []).map((p) => [p.user_id, p]));

  // Course contents
  const { data: contents } = await db
    .from("course_contents")
    .select("id")
    .eq("course_id", courseId);
  const contentIds = (contents || []).map((c) => c.id);
  const totalContents = contentIds.length;

  // Content progress
  const { data: cprog } = contentIds.length
    ? await db
        .from("content_progress")
        .select("user_id, content_id, progress_percentage, completed, last_accessed_at")
        .in("user_id", userIds)
        .in("content_id", contentIds)
    : { data: [] as any[] };

  // Assignments
  const { data: courseAssignments } = await db
    .from("assignments")
    .select("id")
    .eq("course_id", courseId);
  const assignmentIds = (courseAssignments || []).map((a) => a.id);
  const { data: subs } = assignmentIds.length
    ? await db
        .from("assignment_submissions")
        .select("user_id, assignment_id, score, status")
        .in("user_id", userIds)
        .in("assignment_id", assignmentIds)
    : { data: [] as any[] };

  // Assessments
  const { data: courseAssessments } = await db
    .from("assessments")
    .select("id")
    .eq("course_id", courseId);
  const assessmentIds = (courseAssessments || []).map((a) => a.id);
  const { data: attempts } = assessmentIds.length
    ? await db
        .from("assessment_attempts")
        .select("user_id, assessment_id, score, passed, status")
        .in("user_id", userIds)
        .in("assessment_id", assessmentIds)
    : { data: [] as any[] };

  // Attendance 30d
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: attend } = await db
    .from("attendance")
    .select("user_id, created_at")
    .in("user_id", userIds)
    .gte("created_at", thirtyDaysAgo);

  const now = Date.now();

  return enrollments.map((e) => {
    const p = pmap.get(e.user_id);
    const userContentProg = (cprog || []).filter((c: any) => c.user_id === e.user_id);
    const completedContents = userContentProg.filter((c: any) => c.completed).length;
    const avgProg = userContentProg.length
      ? userContentProg.reduce((s: number, c: any) => s + (c.progress_percentage || 0), 0) /
        userContentProg.length
      : 0;
    const lastAccessTs = userContentProg
      .map((c: any) => (c.last_accessed_at ? new Date(c.last_accessed_at).getTime() : 0))
      .reduce((a: number, b: number) => Math.max(a, b), 0);
    const lastAccessIso = lastAccessTs ? new Date(lastAccessTs).toISOString() : null;
    const daysSinceLast = lastAccessTs ? Math.floor((now - lastAccessTs) / 86400000) : null;
    const daysSinceEnroll = Math.max(
      1,
      Math.floor((now - new Date(e.enrolled_at).getTime()) / 86400000),
    );

    const userSubs = (subs || []).filter((s: any) => s.user_id === e.user_id);
    const gradedSubs = userSubs.filter((s: any) => typeof s.score === "number");
    const userAttempts = (attempts || []).filter((a: any) => a.user_id === e.user_id);
    const passable = userAttempts.filter((a: any) => typeof a.passed === "boolean");

    return {
      user_id: e.user_id,
      name: p?.full_name || "(이름 없음)",
      email: p?.email || "",
      enrolled_at: e.enrolled_at,
      current_progress: Math.round(e.progress || 0),
      completed: !!e.completed_at,
      total_contents: totalContents,
      completed_contents: completedContents,
      avg_content_progress: Math.round(avgProg),
      last_accessed_at: lastAccessIso,
      days_since_last_access: daysSinceLast,
      days_since_enrolled: daysSinceEnroll,
      assignments_submitted: userSubs.length,
      assignments_graded_avg: gradedSubs.length
        ? Math.round(
            gradedSubs.reduce((s: number, x: any) => s + (x.score || 0), 0) / gradedSubs.length,
          )
        : null,
      assessment_attempts: userAttempts.length,
      assessment_pass_rate: passable.length
        ? Math.round(
            (passable.filter((a: any) => a.passed).length / passable.length) * 100,
          )
        : null,
      attendance_count_30d: (attend || []).filter((a: any) => a.user_id === e.user_id).length,
    };
  });
}

const SYSTEM_PROMPT = `당신은 LMS 학습 진도 예측 분석가입니다.
제공된 학습자 데이터(진도율, 콘텐츠 완료, 과제, 평가, 출석, 마지막 접속일 등)를 기반으로
각 학습자의 수료 가능성과 이탈 위험을 평가합니다.

출력은 반드시 JSON 객체 한 개여야 합니다. 형식:
{
  "summary": "전체 코호트 요약(2-3문장, 한국어)",
  "predictions": [
    {
      "user_id": "uuid",
      "name": "이름",
      "predicted_completion_days": 14,         // 현재 시점으로부터 수료 예상까지 남은 일수 (이미 수료 시 0)
      "predicted_completion_date": "YYYY-MM-DD",
      "completion_probability": 0-100,          // 정수
      "risk_level": "low" | "medium" | "high",
      "risk_reasons": ["짧고 구체적인 한국어 사유", ...],
      "recommendation": "관리자에게 줄 1-2문장 맞춤 개입 제안(한국어)"
    }
  ]
}
JSON 외 텍스트, 코드펜스, 설명을 절대 포함하지 마세요.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const db = svc();
    const { data: roleRows } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .in("role", ["admin", "super_admin"]);
    if (!roleRows || roleRows.length === 0) {
      return new Response(JSON.stringify({ error: "관리자 권한이 필요합니다." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const courseId: string = String(body?.course_id || "").trim();
    if (!courseId) {
      return new Response(JSON.stringify({ error: "course_id가 필요합니다." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const snapshots = await buildSnapshots(db, courseId);
    if (snapshots.length === 0) {
      return new Response(
        JSON.stringify({
          summary: "해당 강의에 분석할 수강자가 없습니다.",
          predictions: [],
          snapshots: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Cap to 40 learners to keep prompt manageable
    const capped = snapshots.slice(0, 40);

    const userMessage = `오늘 날짜: ${new Date().toISOString().slice(0, 10)}
분석 대상 학습자 수: ${capped.length}
학습자 데이터(JSON):
${JSON.stringify(capped)}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
        "X-Lovable-AIG-SDK": "openai-compatible",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI 크레딧이 부족합니다. 워크스페이스 설정에서 충전해 주세요." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: `AI Gateway error ${aiRes.status}: ${text.slice(0, 300)}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await aiRes.json();
    const content = data?.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { summary: "AI 응답을 해석하지 못했습니다.", predictions: [] };
    }

    return new Response(
      JSON.stringify({
        summary: parsed.summary || "",
        predictions: parsed.predictions || [],
        snapshots: capped,
        total_learners: snapshots.length,
        analyzed_learners: capped.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("ai-progress-prediction error", e);
    return new Response(
      JSON.stringify({ error: e?.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});