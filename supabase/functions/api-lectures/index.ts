// GET /oapi/lectures — lecture (course) list
import {
  apiResponse, authFailureResponse, corsHeaders, getServiceClient,
} from "../_shared/oauth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return apiResponse("11", { message: "method_not_allowed" }, 405);

  const supabase = getServiceClient();
  const { authenticateRequest } = await import("../_shared/oauth.ts");
  const auth = await authenticateRequest(req, supabase, ["lecture:read"]);
  if (!auth.success) return authFailureResponse(auth);

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 200);
  const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);

  const { data, error } = await supabase
    .from("courses")
    .select("id, title, subtitle, description, category_id, thumbnail_url, status, difficulty_level, estimated_duration_hours, price, sale_price, enrolled_count, rating_avg, rating_count, is_b2c, created_at, updated_at")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return apiResponse("11", { message: error.message }, 500);

  return apiResponse("00", {
    lectures: data.map((c) => ({
      code: c.id,
      title: c.title,
      subtitle: c.subtitle,
      description: c.description,
      category_id: c.category_id,
      thumbnail_url: c.thumbnail_url,
      status: c.status,
      difficulty: c.difficulty_level,
      duration_hours: c.estimated_duration_hours,
      price: c.price,
      sale_price: c.sale_price,
      enrolled_count: c.enrolled_count,
      rating_avg: c.rating_avg,
      rating_count: c.rating_count,
      is_b2c: c.is_b2c,
      created_at: c.created_at,
      updated_at: c.updated_at,
    })),
    total: data.length,
    limit,
    offset,
  }, 200);
});