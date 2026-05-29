// GET /oapi/students — member list (requires member:read scope)
import {
  apiResponse, authFailureResponse, authenticateRequest, corsHeaders, getServiceClient,
} from "../_shared/oauth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return apiResponse("11", { message: "method_not_allowed" }, 405);

  const supabase = getServiceClient();
  const auth = await authenticateRequest(req, supabase, ["member:read"]);
  if (!auth.success) return authFailureResponse(auth);

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 200);
  const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);
  const search = url.searchParams.get("search");
  const departmentId = url.searchParams.get("department_id");

  let q = supabase
    .from("profiles")
    .select("user_id, full_name, email, phone_number, department_id, team_name, position, employee_id, created_at, updated_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (search) q = q.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
  if (departmentId) q = q.eq("department_id", departmentId);

  const { data, error, count } = await q;
  if (error) return apiResponse("11", { message: error.message }, 500);

  return apiResponse("00", {
    members: (data || []).map((p) => ({
      code: p.user_id,
      name: p.full_name,
      email: p.email,
      phone: p.phone_number,
      department_id: p.department_id,
      team: p.team_name,
      position: p.position,
      employee_id: p.employee_id,
      created_at: p.created_at,
      updated_at: p.updated_at,
    })),
    total: count ?? data?.length ?? 0,
    limit,
    offset,
  }, 200);
});