import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";

/**
 * 현재 로그인 사용자가 승인(approved)된 수강 강의 id Set 반환.
 * 카탈로그/홈에서 "수강중" 배지를 표시하고, 장바구니 담기를 차단하는 데 사용.
 */
export const useEnrolledCourseIds = () => {
  const { user } = useUser();
  return useQuery({
    queryKey: ["enrolled-course-ids", user?.id],
    queryFn: async () => {
      if (!user) return new Set<string>();
      const { data, error } = await supabase
        .from("enrollments")
        .select("course_id")
        .eq("user_id", user.id)
        .eq("status", "approved");
      if (error) throw error;
      return new Set((data || []).map((r: any) => r.course_id as string));
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
};
