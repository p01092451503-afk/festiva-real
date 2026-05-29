import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";

/**
 * Loads the current user's targeting context (country, branch, enrolled course ids)
 * so we can filter announcements / board posts to only items addressed to them.
 */
export const useUserTargetContext = () => {
  const { user } = useUser();

  return useQuery({
    queryKey: ["user-target-context", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("department_id")
        .eq("user_id", user!.id)
        .maybeSingle();

      let branchId: string | null = profile?.department_id ?? null;
      let countryCode: string | null = null;

      if (branchId) {
        const { data: dept } = await supabase
          .from("departments")
          .select("id, country_code, parent_department_id, entity_type")
          .eq("id", branchId)
          .maybeSingle();
        if (dept) {
          countryCode = dept.country_code ?? null;
          if (dept.entity_type !== "branch" && dept.parent_department_id) {
            const { data: parent } = await supabase
              .from("departments")
              .select("id, country_code")
              .eq("id", dept.parent_department_id)
              .maybeSingle();
            if (parent) {
              branchId = parent.id;
              countryCode = countryCode ?? parent.country_code ?? null;
            }
          }
        }
      }

      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("course_id")
        .eq("user_id", user!.id)
        .eq("status", "approved");

      const courseIds = (enrollments || []).map((e) => e.course_id);
      return { branchId, countryCode, courseIds };
    },
  });
};

/**
 * Multi-target filter: a row is visible to the user when ANY of its target
 * arrays matches the user, OR when all target arrays are empty (= 전체 공개).
 * Falls back to the legacy single-value columns / `course_id` if present.
 */
export const filterByTarget = <
  T extends {
    target_country_codes?: string[] | null;
    target_branch_ids?: string[] | null;
    target_course_ids?: string[] | null;
    target_country_code?: string | null;
    target_branch_id?: string | null;
    target_course_id?: string | null;
    course_id?: string | null;
  }
>(
  rows: T[] | undefined | null,
  ctx: { branchId: string | null; countryCode: string | null; courseIds: string[] }
): T[] => {
  if (!rows) return [];
  return rows.filter((r) => {
    const countries = (r.target_country_codes && r.target_country_codes.length > 0)
      ? r.target_country_codes
      : (r.target_country_code ? [r.target_country_code] : []);
    const branches = (r.target_branch_ids && r.target_branch_ids.length > 0)
      ? r.target_branch_ids
      : (r.target_branch_id ? [r.target_branch_id] : []);
    const courses = (r.target_course_ids && r.target_course_ids.length > 0)
      ? r.target_course_ids
      : (r.target_course_id ? [r.target_course_id] : (r.course_id ? [r.course_id] : []));

    // No targeting set => visible to everyone
    if (countries.length === 0 && branches.length === 0 && courses.length === 0) return true;

    if (countries.length > 0 && ctx.countryCode && countries.includes(ctx.countryCode)) return true;
    if (branches.length > 0 && ctx.branchId && branches.includes(ctx.branchId)) return true;
    if (courses.length > 0 && courses.some((cid) => ctx.courseIds.includes(cid))) return true;

    return false;
  });
};
