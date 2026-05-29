// GET /oapi/orders — order list (requires order:read scope)
import {
  apiResponse, authFailureResponse, authenticateRequest, corsHeaders, getServiceClient,
} from "../_shared/oauth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return apiResponse("11", { message: "method_not_allowed" }, 405);

  const supabase = getServiceClient();
  const auth = await authenticateRequest(req, supabase, ["order:read"]);
  if (!auth.success) return authFailureResponse(auth);

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 200);
  const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);
  const status = url.searchParams.get("status");
  const memberCode = url.searchParams.get("member_code");

  let q = supabase
    .from("orders")
    .select("id, order_number, user_id, status, total_amount, discount_amount, final_amount, payment_method, paid_at, created_at, order_items(course_id, price_at_purchase, courses(title))")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (status) q = q.eq("status", status);
  if (memberCode) q = q.eq("user_id", memberCode);

  const { data, error } = await q;
  if (error) return apiResponse("11", { message: error.message }, 500);

  return apiResponse("00", {
    orders: (data || []).map((o: any) => ({
      code: o.id,
      order_number: o.order_number,
      member_code: o.user_id,
      status: o.status,
      total_amount: o.total_amount,
      discount_amount: o.discount_amount,
      final_amount: o.final_amount,
      payment_method: o.payment_method,
      paid_at: o.paid_at,
      created_at: o.created_at,
      items: (o.order_items || []).map((i: any) => ({
        lecture_code: i.course_id,
        title: i.courses?.title,
        price: i.price_at_purchase,
      })),
    })),
    total: data?.length || 0,
    limit,
    offset,
  }, 200);
});