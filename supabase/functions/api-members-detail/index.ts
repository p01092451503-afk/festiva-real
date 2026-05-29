// GET /oapi/members/{code} — member detail (profile)
import {
  apiResponse, authenticateRequest, authFailureResponse, corsHeaders, getServiceClient,
} from "../_shared/oauth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return apiResponse("11", { message: "method_not_allowed" }, 405);

  const supabase = getServiceClient();
  const auth = await authenticateRequest(req, supabase, ["member:read"]);
  if (!auth.success) return authFailureResponse(auth);

  const url = new URL(req.url);
  // Path: /functions/v1/api-members-detail/{code}  OR  ?code=
  const segments = url.pathname.split("/").filter(Boolean);
  const code = url.searchParams.get("code") || segments[segments.length - 1];
  if (!code || code === "api-members-detail") {
    return apiResponse("11", { message: "code_required" }, 400);
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, full_name, email, phone_number, department, position, employee_id, team_name, created_at, updated_at")
    .eq("user_id", code)
    .maybeSingle();
  if (error) return apiResponse("11", { message: error.message }, 500);
  if (!data) return apiResponse("11", { message: "not_found" }, 404);

  return apiResponse("00", {
    member: {
      code: data.user_id,
      name: data.full_name,
      email: data.email,
      phone: data.phone_number,
      department: data.department,
      position: data.position,
      employee_id: data.employee_id,
      team: data.team_name,
      created_at: data.created_at,
      updated_at: data.updated_at,
    },
  }, 200);
});