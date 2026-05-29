import { useState } from "react";
import { TrendingUp, Loader2, Sparkles, AlertTriangle, CheckCircle2, Clock, Lightbulb } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Prediction = {
  user_id: string;
  name: string;
  predicted_completion_days: number;
  predicted_completion_date: string;
  completion_probability: number;
  risk_level: "low" | "medium" | "high";
  risk_reasons: string[];
  recommendation: string;
};

type Snapshot = {
  user_id: string;
  name: string;
  email: string;
  current_progress: number;
  completed: boolean;
  days_since_last_access: number | null;
};

type Result = {
  summary: string;
  predictions: Prediction[];
  snapshots: Snapshot[];
  total_learners?: number;
  analyzed_learners?: number;
};

export default function AdminAIProgressPrediction() {
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const { toast } = useToast();

  const [courseId, setCourseId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const { data: courses } = useQuery({
    queryKey: ["admin-ai-prediction-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, status")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  async function runPrediction() {
    if (!courseId) {
      toast({
        title: isEn ? "Select a course" : "강의를 선택하세요",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-progress-prediction", {
        body: { course_id: courseId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data as Result);
    } catch (e: any) {
      toast({
        title: isEn ? "Prediction failed" : "예측 실패",
        description: e?.message || String(e),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const riskBadge = (level: string) => {
    if (level === "high")
      return (
        <Badge variant="destructive" className="whitespace-nowrap">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {isEn ? "High risk" : "이탈 위험 높음"}
        </Badge>
      );
    if (level === "medium")
      return (
        <Badge className="bg-amber-500/10 text-amber-700 border border-amber-300 hover:bg-amber-500/10 whitespace-nowrap">
          <Clock className="h-3 w-3 mr-1" />
          {isEn ? "Medium" : "주의"}
        </Badge>
      );
    return (
      <Badge className="bg-emerald-500/10 text-emerald-700 border border-emerald-300 hover:bg-emerald-500/10 whitespace-nowrap">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        {isEn ? "On track" : "안정"}
      </Badge>
    );
  };

  const sortedPredictions = result?.predictions
    ? [...result.predictions].sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 } as const;
        return (order[a.risk_level] ?? 3) - (order[b.risk_level] ?? 3);
      })
    : [];

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 min-w-0">
        {/* Header */}
        <div className="flex items-start gap-3">
          <TrendingUp className="h-7 w-7 text-foreground mt-1" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              {isEn ? "AI Progress Prediction" : "AI 진도 예측"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isEn
                ? "AI analyzes login patterns, assignment completion, and quiz scores to forecast completion timing and detect at-risk learners."
                : "학습자의 접속 패턴, 과제 완료율, 퀴즈 성적 등을 AI가 종합 분석하여 수료 예상 시점을 정밀하게 예측합니다."}
            </p>
          </div>
        </div>

        {/* Concept card */}
        <div className="border-2 border-border/80 rounded-md p-6 space-y-4 bg-card">
          <div className="flex items-start gap-3">
            <TrendingUp className="h-6 w-6 text-primary mt-1" />
            <div>
              <h2 className="text-lg font-semibold">
                {isEn ? "How it works" : "AI 진도 예측이란?"}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                {isEn
                  ? "Combines engagement signals (last access, content progress), performance signals (assignments, assessments), and attendance to estimate completion date and dropout risk per learner. Admins get personalized intervention suggestions for high-risk learners."
                  : "학습자의 접속 패턴, 과제 완료율, 퀴즈 성적 등을 AI가 종합 분석하여 수료 예상 시점을 정밀하게 예측합니다. 이탈 위험이 높은 학습자를 사전에 감지하여 관리자에게 알림을 보내고, 맞춤 개입 방안을 자동으로 추천합니다."}
              </p>
            </div>
          </div>

          <div className="rounded-md bg-muted/40 p-4 border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <span className="font-medium text-sm">
                {isEn ? "Use case" : "활용 시나리오"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {isEn
                ? "Example: AI auto-detects learners inactive for 2+ weeks or with sudden quiz score drops, and surfaces them with a recommended action."
                : "예시: 2주 이상 미접속이거나 퀴즈 점수가 급락한 학습자를 AI가 자동 감지하여 담당자에게 알림을 보냅니다."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="bg-primary/5 text-primary hover:bg-primary/5">
              #{isEn ? "DropoutPrevention" : "이탈예방"}
            </Badge>
            <Badge variant="secondary" className="bg-primary/5 text-primary hover:bg-primary/5">
              #{isEn ? "LearningAnalytics" : "학습분석"}
            </Badge>
            <Badge variant="secondary" className="bg-primary/5 text-primary hover:bg-primary/5">
              #{isEn ? "DataDriven" : "데이터기반"}
            </Badge>
          </div>
        </div>

        {/* Controls */}
        <div className="border-2 border-border/80 rounded-md p-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1 min-w-0">
              <label className="text-sm font-medium block mb-2">
                {isEn ? "Target course" : "분석 대상 강의"}
              </label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={isEn ? "Select a course" : "강의를 선택하세요"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {(courses || []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                      {c.status !== "published" && (
                        <span className="text-muted-foreground ml-2">
                          ({c.status})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={runPrediction}
              disabled={loading || !courseId}
              className="whitespace-nowrap"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isEn ? "Analyzing..." : "분석 중..."}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {isEn ? "Run AI prediction" : "AI 예측 실행"}
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {isEn
              ? "Analyzes up to 40 learners per run. Results are not stored."
              : "최대 40명까지 분석합니다. 결과는 저장되지 않으며, 실행 시점 데이터를 기준으로 합니다."}
          </p>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="border-2 border-border/80 rounded-md p-5 bg-primary/5">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium mb-1">
                    {isEn ? "AI summary" : "AI 코호트 요약"}
                    {result.total_learners != null && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        ({isEn ? "Analyzed" : "분석 인원"} {result.analyzed_learners}/
                        {result.total_learners})
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">
                    {result.summary}
                  </p>
                </div>
              </div>
            </div>

            {/* Predictions list */}
            {sortedPredictions.length === 0 ? (
              <div className="border-2 border-border/80 rounded-md p-8 text-center text-muted-foreground text-sm">
                {isEn ? "No learners to analyze." : "분석할 학습자가 없습니다."}
              </div>
            ) : (
              <div className="space-y-3">
                {sortedPredictions.map((p) => {
                  const snap = result.snapshots.find((s) => s.user_id === p.user_id);
                  return (
                    <div
                      key={p.user_id}
                      className="border-2 border-border/80 rounded-md p-5 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold">{p.name}</div>
                          {snap?.email && (
                            <div className="text-xs text-muted-foreground">
                              {snap.email}
                            </div>
                          )}
                        </div>
                        {riskBadge(p.risk_level)}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">
                            {isEn ? "Current progress" : "현재 진도"}
                          </div>
                          <div className="font-medium">{snap?.current_progress ?? 0}%</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">
                            {isEn ? "Completion prob." : "수료 확률"}
                          </div>
                          <div className="font-medium">{p.completion_probability}%</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">
                            {isEn ? "ETA" : "수료 예상"}
                          </div>
                          <div className="font-medium">
                            {p.predicted_completion_date}
                            <span className="text-xs text-muted-foreground ml-1">
                              (D-{p.predicted_completion_days})
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">
                            {isEn ? "Last access" : "마지막 접속"}
                          </div>
                          <div className="font-medium">
                            {snap?.days_since_last_access == null
                              ? "-"
                              : isEn
                              ? `${snap.days_since_last_access}d ago`
                              : `${snap.days_since_last_access}일 전`}
                          </div>
                        </div>
                      </div>

                      {p.risk_reasons?.length > 0 && (
                        <div className="text-sm">
                          <div className="text-xs text-muted-foreground mb-1">
                            {isEn ? "Risk factors" : "위험 요인"}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {p.risk_reasons.map((r, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="font-normal whitespace-normal text-left"
                              >
                                {r}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {p.recommendation && (
                        <div className="rounded-md bg-muted/40 p-3 border border-border/50 text-sm">
                          <div className="flex items-start gap-2">
                            <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                            <div>
                              <div className="text-xs font-medium text-muted-foreground mb-0.5">
                                {isEn ? "Recommended action" : "맞춤 개입 제안"}
                              </div>
                              <div>{p.recommendation}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}