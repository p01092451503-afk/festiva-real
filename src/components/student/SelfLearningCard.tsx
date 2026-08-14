import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Brain, ArrowRight, CalendarDays, ListChecks, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";

const today = () => new Date().toISOString().slice(0, 10);

/** 학생 대시보드용 AI 자기주도학습 요약 카드 */
const SelfLearningCard = () => {
  const { user } = useUser();

  const { data } = useQuery({
    queryKey: ["self-learning-summary", user?.id],
    queryFn: async () => {
      const d = today();
      const [plan, notes, report] = await Promise.all([
        supabase
          .from("study_plans")
          .select("id, course_id, goal_date")
          .eq("user_id", user!.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("review_wrong_notes")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user!.id)
          .eq("resolved", false)
          .lte("next_review_at", d),
        supabase
          .from("ai_coach_reports")
          .select("created_at")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      let todayTasks = 0;
      let todayDone = 0;
      if (plan.data?.id) {
        const { data: items } = await supabase
          .from("study_plan_items")
          .select("done")
          .eq("plan_id", plan.data.id)
          .eq("scheduled_date", d);
        todayTasks = items?.length ?? 0;
        todayDone = (items || []).filter((i: any) => i.done).length;
      }

      return {
        hasPlan: !!plan.data,
        goalDate: plan.data?.goal_date as string | undefined,
        todayTasks,
        todayDone,
        dueNotes: notes.count ?? 0,
        lastReport: report.data?.created_at as string | undefined,
      };
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });

  return (
    <div className="stat-card !p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" aria-hidden="true" />
            AI 자기주도학습
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            오늘의 학습 계획과 복습을 한눈에 확인하세요.
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0 rounded-full gap-1.5">
          <Link to="/student/self-learning">
            열기 <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          to="/student/self-learning?tab=planner"
          className="rounded-lg border border-border p-3 hover:border-primary/40 transition-colors min-w-0"
        >
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <CalendarDays className="h-3 w-3" aria-hidden="true" /> 오늘 학습할 차시
          </p>
          <p className="text-xl font-bold tabular-nums mt-1">
            {data?.hasPlan ? `${data.todayDone}/${data.todayTasks}` : "-"}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {data?.hasPlan ? `목표 ${data.goalDate}` : "학습 계획을 만들어 보세요"}
          </p>
        </Link>

        <Link
          to="/student/self-learning?tab=review"
          className="rounded-lg border border-border p-3 hover:border-primary/40 transition-colors min-w-0"
        >
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <ListChecks className="h-3 w-3" aria-hidden="true" /> 오늘 복습할 오답
          </p>
          <p className="text-xl font-bold tabular-nums mt-1">{data?.dueNotes ?? 0}</p>
          <p className="text-[11px] text-muted-foreground truncate">간격 반복 복습</p>
        </Link>

        <Link
          to="/student/self-learning?tab=coach"
          className="rounded-lg border border-border p-3 hover:border-primary/40 transition-colors min-w-0"
        >
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3" aria-hidden="true" /> AI 코치 리포트
          </p>
          <p className="text-xl font-bold mt-1">{data?.lastReport ? "확인" : "생성"}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {data?.lastReport
              ? new Date(data.lastReport).toLocaleDateString("ko-KR")
              : "아직 리포트가 없어요"}
          </p>
        </Link>
      </div>
    </div>
  );
};

export default SelfLearningCard;
