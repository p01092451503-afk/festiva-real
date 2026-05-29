import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { ClipboardCheck, ArrowRight, ChevronRight, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { ko, enUS } from "date-fns/locale";

const AssessmentOverviewWidget = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isEn = i18n.language?.startsWith("en");
  const locale = isEn ? enUS : ko;

  const { data: attempts = [] } = useQuery({
    queryKey: ["dash-assessment-attempts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_attempts")
        .select("id, user_id, assessment_id, score, passed, completed_at")
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const { data: assessments = [] } = useQuery({
    queryKey: ["dash-assessment-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assessments").select("id, title, course_id");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });

  const { data: profileMap = {} } = useQuery({
    queryKey: ["dash-assessment-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, full_name");
      if (error) throw error;
      const m: Record<string, string> = {};
      data?.forEach((p: any) => { m[p.user_id] = p.full_name || ""; });
      return m;
    },
    staleTime: 5 * 60_000,
  });

  const assessmentMap = useMemo(() => {
    const m: Record<string, { title: string; course_id: string }> = {};
    assessments.forEach((a: any) => { m[a.id] = { title: a.title, course_id: a.course_id }; });
    return m;
  }, [assessments]);

  const totalAttempts = attempts.length;
  const passedCount = attempts.filter((a: any) => a.passed).length;
  const passRate = totalAttempts > 0 ? Math.round((passedCount / totalAttempts) * 100) : 0;
  const scored = attempts.filter((a: any) => a.score != null);
  const avgScore = scored.length > 0
    ? Math.round(scored.reduce((s: number, a: any) => s + Number(a.score || 0), 0) / scored.length)
    : 0;

  const recent = attempts.slice(0, 5);

  return (
    <div className="stat-card !p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          {isEn ? "Assessment Overview" : "평가 현황"}
        </h3>
        <Link to="/admin/assessments">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground">
            {t("common.viewAll")} <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">{isEn ? "Attempts" : "응시"}</p>
          <p className="text-xl font-bold text-foreground mt-1">{totalAttempts.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">{isEn ? "Pass Rate" : "합격률"}</p>
          <p className="text-xl font-bold text-foreground mt-1">
            {passRate}<span className="text-sm font-normal text-muted-foreground ml-0.5">%</span>
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {isEn ? `${passedCount} passed` : `${passedCount}건 합격`}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">{isEn ? "Avg Score" : "평균 점수"}</p>
          <p className="text-xl font-bold text-foreground mt-1">
            {avgScore}<span className="text-sm font-normal text-muted-foreground ml-0.5">{isEn ? "" : "점"}</span>
          </p>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">
          {isEn ? "Recent Attempts" : "최근 응시 내역"}
        </p>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{t("common.noData")}</p>
        ) : (
          <div className="space-y-1">
            {recent.map((a: any) => {
              const asmt = assessmentMap[a.assessment_id];
              const userName = profileMap[a.user_id] || t("common.user");
              return (
                <button
                  key={a.id}
                  onClick={() => navigate(`/admin/users/${a.user_id}`)}
                  className="w-full flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0 text-left hover:bg-accent/30 transition-colors rounded-md px-2 -mx-2"
                >
                  <div className="mt-0.5 shrink-0">
                    {a.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-chart-3" aria-hidden="true" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug truncate">
                      <span className="font-medium">{userName}</span>
                      <span className="text-muted-foreground"> · {asmt?.title || (isEn ? "Assessment" : "평가")}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {a.completed_at && formatDistanceToNow(new Date(a.completed_at), { addSuffix: true, locale })}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1">
                    <span className={`text-sm font-semibold ${a.passed ? "text-primary" : "text-foreground"}`}>
                      {a.score ?? 0}{isEn ? "" : "점"}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden="true" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssessmentOverviewWidget;