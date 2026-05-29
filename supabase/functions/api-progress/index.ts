// /oapi/lectures/{code}/progress
//   GET  → progress:read   returns enrollment progress + per-content_progress
//   POST → progress:write  upserts { content_id, progress_percentage, completed }
// member is resolved from query (?member_code=) for client_credentials or token.member_code for password grant.

import {
  apiResponse, authenticateRequest, authFailureResponse, corsHeaders, getServiceClient,
} from "../_shared/oauth.ts";

function extractLectureCode(url: URL): string | null {
  // expected path: .../api-progress/{lecture_code}
  const segs = url.pathname.split("/").filter(Boolean);
  const idx = segs.indexOf("api-progress");
  if (idx >= 0 && segs[idx + 1]) return segs[idx + 1];
  return url.searchParams.get("lecture_code");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = getServiceClient();
  const url = new URL(req.url);
  const lectureCode = extractLectureCode(url);
  if (!lectureCode) return apiResponse("11", { message: "lecture_code_required" }, 400);

  if (req.method === "GET") {
    const auth = await authenticateRequest(req, supabase, ["progress:read"]);
    if (!auth.success) return authFailureResponse(auth);

    const memberCode = url.searchParams.get("member_code") || auth.tokenData.member_code;
    if (!memberCode) return apiResponse("11", { message: "member_code_required" }, 400);

    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("user_id, course_id, progress, status, enrolled_at, completed_at")
      .eq("course_id", lectureCode)
      .eq("user_id", memberCode)
      .maybeSingle();

    const { data: contents } = await supabase
      .from("course_contents")
      .select("id, title, sequence_order")
      .eq("course_id", lectureCode)
      .order("sequence_order", { ascending: true });

    const contentIds = (contents || []).map((c) => c.id);
    let perContent: any[] = [];
    if (contentIds.length > 0) {
      const { data } = await supabase
        .from("content_progress")
        .select("content_id, progress_percentage, completed, last_accessed_at, completed_at")
        .eq("user_id", memberCode)
        .in("content_id", contentIds);
      perContent = data || [];
    }

    return apiResponse("00", {
      lecture_code: lectureCode,
      member_code: memberCode,
      enrollment,
      contents: (contents || []).map((c) => ({
        code: c.id,
        title: c.title,
        sequence: c.sequence_order,
        progress: perContent.find((p) => p.content_id === c.id) || null,
      })),
    }, 200);
  }

  if (req.method === "POST") {
    const auth = await authenticateRequest(req, supabase, ["progress:write"]);
    if (!auth.success) return authFailureResponse(auth);

    let body: any;
    try { body = await req.json(); } catch { return apiResponse("11", { message: "invalid_json" }, 400); }
    const memberCode = body.member_code || auth.tokenData.member_code;
    const contentId = body.content_id;
    if (!memberCode || !contentId) return apiResponse("11", { message: "member_code and content_id required" }, 400);

    const pct = Math.max(0, Math.min(100, Number(body.progress_percentage ?? 0)));
    const completed = pct >= 80 || !!body.completed;
    const lastPos = Number(body.last_position_seconds ?? 0);

    const { error } = await supabase.from("content_progress").upsert({
      user_id: memberCode,
      content_id: contentId,
      progress_percentage: pct,
      last_position_seconds: lastPos,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      last_accessed_at: new Date().toISOString(),
    }, { onConflict: "user_id,content_id" });

    if (error) return apiResponse("11", { message: error.message }, 500);
    return apiResponse("00", { member_code: memberCode, content_id: contentId, progress_percentage: pct, completed }, 200);
  }

  return apiResponse("11", { message: "method_not_allowed" }, 405);
});