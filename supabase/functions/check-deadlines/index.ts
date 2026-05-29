import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find mandatory courses with upcoming deadlines (within 3 days)
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const today = new Date().toISOString().split("T")[0];
    const deadlineStr = threeDaysFromNow.toISOString().split("T")[0];

    const { data: urgentCourses, error: coursesErr } = await supabase
      .from("courses")
      .select("id, title, deadline, is_mandatory")
      .eq("is_mandatory", true)
      .eq("status", "published")
      .gte("deadline", today)
      .lte("deadline", deadlineStr);

    if (coursesErr) throw coursesErr;
    if (!urgentCourses || urgentCourses.length === 0) {
      return new Response(JSON.stringify({ message: "No urgent deadlines", notified: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let notifiedCount = 0;

    for (const course of urgentCourses) {
      // Find enrolled users who haven't completed
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("user_id, progress")
        .eq("course_id", course.id)
        .is("completed_at", null);

      if (!enrollments || enrollments.length === 0) continue;

      const daysLeft = Math.ceil(
        (new Date(course.deadline!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      for (const enrollment of enrollments) {
        // Check if we already sent a notification today for this course
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", enrollment.user_id)
          .eq("type", "deadline")
          .gte("created_at", todayStart.toISOString())
          .like("action_url", `%${course.id}%`)
          .limit(1);

        if (existing && existing.length > 0) continue;

        const progress = Math.round(Number(enrollment.progress) || 0);
        const title = daysLeft <= 1
          ? `⚠️ 오늘 마감: ${course.title}`
          : `📅 ${daysLeft}일 후 마감: ${course.title}`;
        const message = `필수교육 진행률 ${progress}%. 마감일까지 완료해 주세요.`;

        await supabase.from("notifications").insert({
          user_id: enrollment.user_id,
          title,
          message,
          type: "deadline",
          action_url: `/courses/${course.id}`,
        });

        notifiedCount++;
      }
    }

    return new Response(JSON.stringify({ message: "Deadline check complete", notified: notifiedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
