import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, FileCheck, ClipboardCheck, MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";

const LearningActivityCard = () => {
  const { t } = useTranslation();

  const { data } = useQuery({
    queryKey: ["stat-learning-activity"],
    queryFn: async () => {
      const [contentRes, attemptRes, passedRes, subRes, gradedRes, boardRes, surveyRes] = await Promise.all([
        supabase.from("content_progress").select("*", { count: "exact", head: true }).eq("completed", true),
        supabase.from("assessment_attempts").select("*", { count: "exact", head: true }),
        supabase.from("assessment_attempts").select("*", { count: "exact", head: true }).eq("passed", true),
        supabase.from("assignment_submissions").select("*", { count: "exact", head: true }),
        supabase.from("assignment_submissions").select("*", { count: "exact", head: true }).eq("status", "graded"),
        supabase.from("board_posts").select("*", { count: "exact", head: true }),
        supabase.from("survey_responses").select("*", { count: "exact", head: true }),
      ]);
      return {
        contentCompletions: contentRes.count || 0,
        assessmentAttempts: attemptRes.count || 0,
        assessmentPassed: passedRes.count || 0,
        submissionCount: subRes.count || 0,
        gradedCount: gradedRes.count || 0,
        boardPostCount: boardRes.count || 0,
        surveyResponseCount: surveyRes.count || 0,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const stats = data || {
    contentCompletions: 0, assessmentAttempts: 0, assessmentPassed: 0,
    submissionCount: 0, gradedCount: 0, boardPostCount: 0, surveyResponseCount: 0,
  };

  const items = [
    { label: t("stats.lessonCompletion"), value: stats.contentCompletions, icon: BookOpen, color: "text-primary bg-primary/10" },
    { label: t("stats.assessmentAttempt"), value: stats.assessmentAttempts, sub: t("stats.passedCount", { count: stats.assessmentPassed }), icon: ClipboardCheck, color: "text-chart-2 bg-chart-2/10" },
    { label: t("stats.assignmentSubmit"), value: stats.submissionCount, sub: t("stats.gradedCount", { count: stats.gradedCount }), icon: FileCheck, color: "text-chart-3 bg-chart-3/10" },
    { label: t("stats.boardPosts"), value: stats.boardPostCount, icon: MessageSquare, color: "text-chart-4 bg-chart-4/10" },
    { label: t("stats.surveyResponses"), value: stats.surveyResponseCount, icon: ClipboardCheck, color: "text-chart-5 bg-chart-5/10" },
  ];

  return (
    <Card>
      <CardHeader className="pb-2 px-3 sm:px-6">
        <CardTitle className="text-sm font-medium">{t("stats.learningActivity")}</CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {items.map((item) => (
            <div key={item.label} className="text-center p-3 rounded-lg bg-muted/50">
              <item.icon className={`h-5 w-5 mx-auto mb-1 ${item.color.split(" ")[0]}`} />
              <p className="text-lg font-bold text-foreground">{item.value.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">{item.label}</p>
              {item.sub && <p className="text-[10px] text-primary mt-0.5">{item.sub}</p>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default LearningActivityCard;
