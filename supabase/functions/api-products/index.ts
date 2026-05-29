// GET /oapi/products — B2C course product list (requires product:read scope)
import {
  apiResponse, authFailureResponse, authenticateRequest, corsHeaders, getServiceClient,
} from "../_shared/oauth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return apiResponse("11", { message: "method_not_allowed" }, 405);

  const supabase = getServiceClient();
  const auth = await authenticateRequest(req, supabase, ["product:read"]);
  if (!auth.success) return authFailureResponse(auth);

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 200);
  const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);
  const status = url.searchParams.get("status");
  const onlyB2c = url.searchParams.get("b2c") !== "false";

  let q = supabase
    .from("courses")
    .select("id, title, subtitle, description, thumbnail_url, status, price, sale_price, sale_ends_at, is_b2c, tags, enrolled_count, rating_avg, rating_count, created_at, updated_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (onlyB2c) q = q.eq("is_b2c", true);
  if (status) q = q.eq("status", status);

  const { data, error, count } = await q;
  if (error) return apiResponse("11", { message: error.message }, 500);

  return apiResponse("00", {
    products: (data || []).map((c) => ({
      id: c.id,
      title: c.title,
      subtitle: c.subtitle,
      description: c.description,
      thumbnail_url: c.thumbnail_url,
      status: c.status,
      price: c.price,
      sale_price: c.sale_price,
      sale_ends_at: c.sale_ends_at,
      is_b2c: c.is_b2c,
      tags: c.tags,
      enrolled_count: c.enrolled_count,
      rating_avg: Number(c.rating_avg),
      rating_count: c.rating_count,
      created_at: c.created_at,
      updated_at: c.updated_at,
    })),
    total: count ?? data?.length ?? 0,
    limit,
    offset,
  }, 200);
});