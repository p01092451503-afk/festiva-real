import { supabase } from "@/integrations/supabase/client";

export interface TargetScope {
  target_country_codes: string[];
  target_branch_ids: string[];
  target_course_ids: string[];
}

/**
 * Resolve the union of student user IDs that match the given target scope.
 *
 * Mirrors the targeting model used by announcements/board posts:
 * - If no scope is provided, fan out to ALL students.
 * - Otherwise UNION students from country, branch, and course filters.
 * - Restrict to users with the `student` role and de-duplicate.
 */
export const resolveTargetStudentIds = async (
  scope: TargetScope,
  options: { instructorId?: string } = {},
): Promise<string[]> => {
  const ids = new Set<string>();
  const hasFilter =
    scope.target_country_codes.length > 0 ||
    scope.target_branch_ids.length > 0 ||
    scope.target_course_ids.length > 0;

  // 1) Profile-based fan-out (all students, or filtered by branch / country)
  if (!hasFilter || scope.target_branch_ids.length > 0 || scope.target_country_codes.length > 0) {
    let q = supabase.from("profiles").select("user_id, department_id");
    if (scope.target_branch_ids.length > 0) {
      q = q.in("department_id", scope.target_branch_ids);
    }
    if (scope.target_country_codes.length > 0) {
      // Country lives on departments; resolve via department lookup.
      const { data: depts } = await supabase
        .from("departments")
        .select("id")
        .in("country_code", scope.target_country_codes);
      const deptIds = (depts || []).map((d) => d.id);
      if (deptIds.length > 0) {
        q = q.in("department_id", deptIds);
      } else {
        // No matching departments → no users via this branch
        q = q.eq("user_id", "00000000-0000-0000-0000-000000000000");
      }
    }
    const { data: profiles } = await q;
    (profiles || []).forEach((p: any) => p.user_id && ids.add(p.user_id));
  }

  // 2) Course-based fan-out (approved enrollments only)
  if (scope.target_course_ids.length > 0) {
    const { data: enrolls } = await supabase
      .from("enrollments")
      .select("user_id")
      .in("course_id", scope.target_course_ids)
      .eq("status", "approved");
    (enrolls || []).forEach((e: any) => e.user_id && ids.add(e.user_id));
  }

  if (ids.size === 0) return [];

  // 3) Restrict to users with the student role to avoid spamming staff.
  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "student")
    .in("user_id", Array.from(ids));

  const studentIds = new Set((roles || []).map((r: any) => r.user_id));

  // 4) Optional: when called by a teacher, restrict to learners enrolled in
  // that teacher's courses so they cannot broadcast outside their classes.
  if (options.instructorId) {
    const { data: courses } = await supabase
      .from("courses")
      .select("id")
      .eq("instructor_id", options.instructorId);
    const courseIds = (courses || []).map((c: any) => c.id);
    if (courseIds.length === 0) return [];
    const { data: enrolls } = await supabase
      .from("enrollments")
      .select("user_id")
      .in("course_id", courseIds)
      .eq("status", "approved");
    const allowed = new Set((enrolls || []).map((e: any) => e.user_id));
    return Array.from(studentIds).filter((id) => allowed.has(id));
  }

  return Array.from(studentIds);
};