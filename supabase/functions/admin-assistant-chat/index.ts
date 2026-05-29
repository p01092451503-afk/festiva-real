// Admin Assistant Chat — read-only AI helper for LMS admins.
// Uses Lovable AI Gateway (OpenAI-compatible) with iterative tool-calling.
// All tools are READ-ONLY and scoped to admin/super_admin callers.

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

// ─────────────────────────────────────────────────────────────────
// Tool definitions (OpenAI tools schema)
// ─────────────────────────────────────────────────────────────────
const tools = [
  {
    type: "function",
    function: {
      name: "platform_overview",
      description:
        "플랫폼 전반의 핵심 지표를 반환합니다. 전체 회원 수, 역할별 분포, 강의 수, 차시 수, 활성 수강 수, 완료 수, 평가 응시 수 등을 포함합니다.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "search_users",
      description:
        "회원을 이메일, 이름, 또는 역할(student/teacher/admin/super_admin/dept_admin)로 검색합니다.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "이름 또는 이메일의 부분 일치 키워드 (선택)" },
          role: { type: "string", description: "역할 필터 (선택)" },
          limit: { type: "number", description: "최대 결과 수 (기본 20, 최대 100)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_courses",
      description:
        "강의 목록을 검색합니다. 제목 키워드, 공개 상태(published/draft) 등으로 필터링할 수 있습니다.",
      parameters: {
        type: "object",
        properties: {
          title_query: { type: "string", description: "강의 제목 부분 일치 (선택)" },
          status: { type: "string", description: "published 또는 draft (선택)" },
          limit: { type: "number", description: "최대 결과 수 (기본 20, 최대 100)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "course_stats",
      description:
        "특정 강의의 상세 지표(수강 인원, 완료 인원, 평균 진도율, 차시 수, 평가 수)를 반환합니다.",
      parameters: {
        type: "object",
        properties: {
          course_id: { type: "string", description: "강의 UUID" },
        },
        required: ["course_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "recent_enrollments",
      description:
        "최근 수강 신청을 반환합니다. 상태(pending/approved/rejected)로 필터링할 수 있습니다.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "pending / approved / rejected (선택)" },
          limit: { type: "number", description: "최대 결과 수 (기본 20, 최대 100)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "top_active_users",
      description:
        "활동량 기준 상위 학습자를 반환합니다. 정렬 기준: completions(완료 수), points(포인트). 기본은 completions.",
      parameters: {
        type: "object",
        properties: {
          sort_by: { type: "string", description: "completions 또는 points (기본 completions)" },
          limit: { type: "number", description: "기본 10, 최대 50" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "recent_signups",
      description: "최근 가입한 회원 목록을 반환합니다.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "최근 며칠 (기본 7, 최대 90)" },
          limit: { type: "number", description: "기본 20, 최대 100" },
        },
        additionalProperties: false,
      },
    },
  },
];

// ─────────────────────────────────────────────────────────────────
// Tool implementations (read-only)
// ─────────────────────────────────────────────────────────────────
function svc() {
  return createClient(SUPABASE_URL, SERVICE_ROLE);
}

async function execTool(name: string, args: any): Promise<any> {
  const db = svc();
  const clampLimit = (n: any, def: number, max: number) => {
    const v = Number.isFinite(+n) ? Math.floor(+n) : def;
    return Math.max(1, Math.min(max, v));
  };

  try {
    if (name === "platform_overview") {
      const [
        usersC, coursesC, contentsC, enrollC, enrollActive, completedC, attemptsC, ordersC,
      ] = await Promise.all([
        db.from("profiles").select("*", { count: "exact", head: true }),
        db.from("courses").select("*", { count: "exact", head: true }),
        db.from("course_contents").select("*", { count: "exact", head: true }),
        db.from("enrollments").select("*", { count: "exact", head: true }),
        db.from("enrollments").select("*", { count: "exact", head: true }).eq("status", "approved"),
        db.from("enrollments").select("*", { count: "exact", head: true }).eq("status", "completed"),
        db.from("assessment_attempts").select("*", { count: "exact", head: true }),
        db.from("orders").select("*", { count: "exact", head: true }),
      ]);
      const { data: rolesData } = await db.from("user_roles").select("role");
      const roleCounts: Record<string, number> = {};
      (rolesData || []).forEach((r: any) => {
        roleCounts[r.role] = (roleCounts[r.role] || 0) + 1;
      });
      return {
        users_total: usersC.count ?? 0,
        role_distribution: roleCounts,
        courses_total: coursesC.count ?? 0,
        course_contents_total: contentsC.count ?? 0,
        enrollments_total: enrollC.count ?? 0,
        enrollments_active: enrollActive.count ?? 0,
        enrollments_completed: completedC.count ?? 0,
        assessment_attempts_total: attemptsC.count ?? 0,
        orders_total: ordersC.count ?? 0,
      };
    }

    if (name === "search_users") {
      const limit = clampLimit(args?.limit, 20, 100);
      let q = db.from("profiles").select("user_id, full_name, email, created_at").limit(limit);
      if (args?.query) {
        const kw = String(args.query).replace(/[%_]/g, "\\$&");
        q = q.or(`full_name.ilike.%${kw}%,email.ilike.%${kw}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      let users = data || [];
      if (args?.role) {
        const ids = users.map((u: any) => u.user_id);
        if (ids.length) {
          const { data: roleRows } = await db
            .from("user_roles")
            .select("user_id, role")
            .in("user_id", ids)
            .eq("role", args.role);
          const allowed = new Set((roleRows || []).map((r: any) => r.user_id));
          users = users.filter((u: any) => allowed.has(u.user_id));
        } else {
          users = [];
        }
      }
      return { count: users.length, users };
    }

    if (name === "list_courses") {
      const limit = clampLimit(args?.limit, 20, 100);
      let q = db
        .from("courses")
        .select("id, title, status, is_published, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (args?.title_query) {
        const kw = String(args.title_query).replace(/[%_]/g, "\\$&");
        q = q.ilike("title", `%${kw}%`);
      }
      if (args?.status) {
        if (args.status === "published") q = q.eq("is_published", true);
        else if (args.status === "draft") q = q.eq("is_published", false);
      }
      const { data, error } = await q;
      if (error) throw error;
      return { count: data?.length ?? 0, courses: data || [] };
    }

    if (name === "course_stats") {
      const id = args?.course_id;
      if (!id) return { error: "course_id 필요" };
      const [{ data: course }, enrollC, completedC, contentsC, assessmentsC] = await Promise.all([
        db.from("courses").select("id, title, is_published").eq("id", id).maybeSingle(),
        db.from("enrollments").select("*", { count: "exact", head: true }).eq("course_id", id),
        db
          .from("enrollments")
          .select("*", { count: "exact", head: true })
          .eq("course_id", id)
          .eq("status", "completed"),
        db
          .from("course_contents")
          .select("*", { count: "exact", head: true })
          .eq("course_id", id),
        db
          .from("assessments")
          .select("*", { count: "exact", head: true })
          .eq("course_id", id),
      ]);
      if (!course) return { error: "강의를 찾을 수 없습니다" };
      // average progress
      const { data: progressRows } = await db
        .from("enrollments")
        .select("progress_percentage")
        .eq("course_id", id);
      const avg =
        progressRows && progressRows.length
          ? Math.round(
              progressRows.reduce(
                (a: number, r: any) => a + (Number(r.progress_percentage) || 0),
                0,
              ) / progressRows.length,
            )
          : 0;
      return {
        course,
        enrollments_total: enrollC.count ?? 0,
        enrollments_completed: completedC.count ?? 0,
        contents_total: contentsC.count ?? 0,
        assessments_total: assessmentsC.count ?? 0,
        avg_progress_pct: avg,
      };
    }

    if (name === "recent_enrollments") {
      const limit = clampLimit(args?.limit, 20, 100);
      let q = db
        .from("enrollments")
        .select("id, user_id, course_id, status, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (args?.status) q = q.eq("status", args.status);
      const { data, error } = await q;
      if (error) throw error;
      const userIds = [...new Set((data || []).map((r: any) => r.user_id))];
      const courseIds = [...new Set((data || []).map((r: any) => r.course_id))];
      const [{ data: users }, { data: courses }] = await Promise.all([
        userIds.length
          ? db.from("profiles").select("user_id, full_name, email").in("user_id", userIds)
          : Promise.resolve({ data: [] as any[] }),
        courseIds.length
          ? db.from("courses").select("id, title").in("id", courseIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const uMap = new Map((users || []).map((u: any) => [u.user_id, u]));
      const cMap = new Map((courses || []).map((c: any) => [c.id, c]));
      const enriched = (data || []).map((r: any) => ({
        ...r,
        user: uMap.get(r.user_id) || null,
        course: cMap.get(r.course_id) || null,
      }));
      return { count: enriched.length, enrollments: enriched };
    }

    if (name === "top_active_users") {
      const limit = clampLimit(args?.limit, 10, 50);
      const sortBy = args?.sort_by === "points" ? "points" : "completions";
      if (sortBy === "points") {
        const { data, error } = await db
          .from("user_gamification")
          .select("user_id, points, streak_days")
          .order("points", { ascending: false })
          .limit(limit);
        if (error) throw error;
        const ids = (data || []).map((r: any) => r.user_id);
        const { data: profs } = ids.length
          ? await db.from("profiles").select("user_id, full_name, email").in("user_id", ids)
          : { data: [] as any[] };
        const pMap = new Map((profs || []).map((p: any) => [p.user_id, p]));
        return {
          sort_by: "points",
          users: (data || []).map((r: any) => ({ ...r, profile: pMap.get(r.user_id) || null })),
        };
      } else {
        // count completed enrollments per user
        const { data: rows, error } = await db
          .from("enrollments")
          .select("user_id")
          .eq("status", "completed");
        if (error) throw error;
        const counts = new Map<string, number>();
        (rows || []).forEach((r: any) => counts.set(r.user_id, (counts.get(r.user_id) || 0) + 1));
        const sorted = [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit);
        const ids = sorted.map(([uid]) => uid);
        const { data: profs } = ids.length
          ? await db.from("profiles").select("user_id, full_name, email").in("user_id", ids)
          : { data: [] as any[] };
        const pMap = new Map((profs || []).map((p: any) => [p.user_id, p]));
        return {
          sort_by: "completions",
          users: sorted.map(([uid, n]) => ({
            user_id: uid,
            completions: n,
            profile: pMap.get(uid) || null,
          })),
        };
      }
    }

    if (name === "recent_signups") {
      const days = clampLimit(args?.days, 7, 90);
      const limit = clampLimit(args?.limit, 20, 100);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await db
        .from("profiles")
        .select("user_id, full_name, email, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return { days, count: data?.length ?? 0, users: data || [] };
    }

    return { error: `Unknown tool: ${name}` };
  } catch (e: any) {
    return { error: e?.message || String(e) };
  }
}

// ─────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `당신은 한국어로 응답하는 LMS 관리자 전용 AI 어시스턴트입니다.

역할:
- 관리자가 회원, 강의, 차시, 수강 현황, 평가, 통계 등 플랫폼 데이터를 조회/요약/분석하도록 돕습니다.
- 데이터를 가져올 때는 반드시 제공된 도구를 사용하세요. 추측하지 마세요.
- 모든 도구는 읽기 전용이며, 데이터를 수정하거나 삭제할 수 없습니다.

응답 규칙:
- 친절하고 간결하게, 표나 목록을 적극 활용해 답변하세요.
- 숫자는 천 단위 콤마로 표시하세요.
- 관련 도구로 가져온 데이터를 근거로 답변하고, 어떤 도구의 결과인지 자연스럽게 알려주세요.
- 데이터가 없거나 모르면 모른다고 답하세요.
- 강의/차시 용어를 사용하세요 (강좌X, 콘텐츠X).
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth — verify caller is admin/super_admin
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
    const uid = userData.user.id;
    const db = svc();
    const { data: roleRows } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .in("role", ["admin", "super_admin"]);
    if (!roleRows || roleRows.length === 0) {
      return new Response(JSON.stringify({ error: "관리자 권한이 필요합니다." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const userMessage: string = String(body?.message || "").trim();
    const history: Array<{ role: string; content: string }> = Array.isArray(body?.history)
      ? body.history.slice(-20)
      : [];
    if (!userMessage) {
      return new Response(JSON.stringify({ error: "메시지가 비어 있습니다." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist user message
    await db.from("admin_chat_messages").insert({
      user_id: uid,
      role: "user",
      content: userMessage,
    });

    // Build messages array for AI
    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userMessage },
    ];

    // Iterative tool-calling loop (max 6 rounds)
    const MAX_ROUNDS = 6;
    let finalText = "";
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": LOVABLE_API_KEY,
          "X-Lovable-AIG-SDK": "openai-compatible",
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          tools,
          tool_choice: "auto",
        }),
      });
      if (!aiRes.ok) {
        const text = await aiRes.text();
        if (aiRes.status === 429) {
          return new Response(
            JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }),
            {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        if (aiRes.status === 402) {
          return new Response(
            JSON.stringify({ error: "AI 크레딧이 부족합니다. 워크스페이스 설정에서 충전해 주세요." }),
            {
              status: 402,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        return new Response(
          JSON.stringify({ error: `AI Gateway error ${aiRes.status}: ${text.slice(0, 300)}` }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const data = await aiRes.json();
      const choice = data?.choices?.[0];
      const msg = choice?.message;
      if (!msg) {
        finalText = "AI 응답을 받지 못했습니다.";
        break;
      }

      const toolCalls = msg.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        // append assistant message with tool_calls
        messages.push({
          role: "assistant",
          content: msg.content ?? "",
          tool_calls: toolCalls,
        });
        for (const tc of toolCalls) {
          let args = {};
          try {
            args = JSON.parse(tc.function?.arguments || "{}");
          } catch {
            args = {};
          }
          const result = await execTool(tc.function?.name, args);
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result).slice(0, 12000),
          });
        }
        continue;
      }

      finalText = msg.content || "";
      break;
    }

    if (!finalText) finalText = "응답을 생성하지 못했습니다. 다시 시도해 주세요.";

    // Persist assistant message
    await db.from("admin_chat_messages").insert({
      user_id: uid,
      role: "assistant",
      content: finalText,
    });

    return new Response(JSON.stringify({ reply: finalText }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("admin-assistant-chat error", e);
    return new Response(JSON.stringify({ error: e?.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});