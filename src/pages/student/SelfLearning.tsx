import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import {
  Brain,
  CalendarDays,
  Sparkles,
  Loader2,
  Target,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ListChecks,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const WEEKDAYS = [
  { value: 1, label: "월" },
  { value: 2, label: "화" },
  { value: 3, label: "수" },
  { value: 4, label: "목" },
  { value: 5, label: "금" },
  { value: 6, label: "토" },
  { value: 0, label: "일" },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

type QuizQuestion = {
  question: string;
  options: string[];
  answer_index: number;
  explanation: string;
};

const SelfLearning = () => {
  const { t } = useTranslation();
  const { user } = useUser();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "planner";

  /* ---------------- 공통: 수강 강의 ---------------- */
  const { data: enrollments = [] } = useQuery({
    queryKey: ["sl-enrollments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("course_id, progress, courses:course_id(id, title)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!user?.id,
  });

  /* ---------------- 1. 학습 플래너 ---------------- */
  const [planCourse, setPlanCourse] = useState<string>("");
  const [goalDate, setGoalDate] = useState<string>(addDays(21));
  const [dailyMinutes, setDailyMinutes] = useState<number>(30);
  const [studyDays, setStudyDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [planning, setPlanning] = useState(false);

  const { data: plan } = useQuery({
    queryKey: ["sl-plan", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_plans")
        .select("*, courses:course_id(title)")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!user?.id,
  });

  const { data: planItems = [] } = useQuery({
    queryKey: ["sl-plan-items", plan?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_plan_items")
        .select("*")
        .eq("plan_id", plan!.id)
        .order("scheduled_date", { ascending: true })
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!plan?.id,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    planItems.forEach((it) => {
      const list = map.get(it.scheduled_date) || [];
      list.push(it);
      map.set(it.scheduled_date, list);
    });
    return [...map.entries()];
  }, [planItems]);

  const planDone = planItems.filter((i) => i.done).length;

  const createPlan = async () => {
    if (!planCourse) {
      toast({ title: "강의를 선택해주세요", variant: "destructive" });
      return;
    }
    setPlanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-study-plan", {
        body: {
          course_id: planCourse,
          goal_date: goalDate,
          daily_minutes: dailyMinutes,
          study_days: studyDays,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "학습 계획이 생성되었습니다" });
      qc.invalidateQueries({ queryKey: ["sl-plan"] });
    } catch (e) {
      toast({
        title: "계획 생성 실패",
        description: e instanceof Error ? e.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setPlanning(false);
    }
  };

  const toggleItem = async (item: any) => {
    await supabase.from("study_plan_items").update({ done: !item.done }).eq("id", item.id);
    qc.invalidateQueries({ queryKey: ["sl-plan-items", plan?.id] });
  };

  /* ---------------- 2. AI 코치 리포트 ---------------- */
  const [coaching, setCoaching] = useState(false);

  const { data: report } = useQuery({
    queryKey: ["sl-report", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_coach_reports")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!user?.id,
  });

  const runCoach = async () => {
    setCoaching(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-coach-report", { body: {} });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "코치 리포트가 생성되었습니다" });
      qc.invalidateQueries({ queryKey: ["sl-report"] });
    } catch (e) {
      toast({
        title: "리포트 생성 실패",
        description: e instanceof Error ? e.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setCoaching(false);
    }
  };

  /* ---------------- 3. 복습 퀴즈 / 오답노트 ---------------- */
  const [quizCourse, setQuizCourse] = useState<string>("");
  const [quizContent, setQuizContent] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);

  const { data: contents = [] } = useQuery({
    queryKey: ["sl-contents", quizCourse],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_contents")
        .select("id, title, order_index")
        .eq("course_id", quizCourse)
        .eq("is_published", true)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!quizCourse,
  });

  const { data: wrongNotes = [] } = useQuery({
    queryKey: ["sl-wrong-notes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("review_wrong_notes")
        .select("*")
        .eq("user_id", user!.id)
        .order("next_review_at", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!user?.id,
  });

  const dueNotes = wrongNotes.filter((n) => !n.resolved && n.next_review_at <= todayStr());

  const generateQuiz = async () => {
    if (!quizContent) {
      toast({ title: "차시를 선택해주세요", variant: "destructive" });
      return;
    }
    setGenerating(true);
    setActiveQuiz(null);
    setAnswers({});
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-review-quiz", {
        body: { content_id: quizContent, count: 5 },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setActiveQuiz((data as any).quiz);
    } catch (e) {
      toast({
        title: "문제 생성 실패",
        description: e instanceof Error ? e.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const submitQuiz = async () => {
    if (!activeQuiz) return;
    const questions: QuizQuestion[] = activeQuiz.questions || [];
    let score = 0;
    const wrongRows: any[] = [];
    questions.forEach((q, i) => {
      const picked = answers[i];
      if (picked === q.answer_index) score += 1;
      else
        wrongRows.push({
          user_id: user!.id,
          quiz_id: activeQuiz.id,
          content_id: activeQuiz.content_id,
          question: q.question,
          options: q.options,
          correct_answer: q.options[q.answer_index],
          user_answer: picked != null ? q.options[picked] : null,
          explanation: q.explanation,
        });
    });

    await supabase
      .from("review_quizzes")
      .update({ score, total: questions.length, completed_at: new Date().toISOString() })
      .eq("id", activeQuiz.id);
    if (wrongRows.length) await supabase.from("review_wrong_notes").insert(wrongRows);

    setResult({ score, total: questions.length });
    qc.invalidateQueries({ queryKey: ["sl-wrong-notes"] });
  };

  // 간격 반복: 1일 → 3일 → 7일 → 14일 → 해결
  const reviewNote = async (note: any, remembered: boolean) => {
    const intervals = [1, 3, 7, 14];
    const stage = remembered ? note.review_stage + 1 : 0;
    const resolved = remembered && stage >= intervals.length;
    const next = new Date();
    next.setDate(next.getDate() + (intervals[Math.min(stage, intervals.length - 1)] || 1));
    await supabase
      .from("review_wrong_notes")
      .update({
        review_stage: stage,
        resolved,
        next_review_at: next.toISOString().slice(0, 10),
      })
      .eq("id", note.id);
    qc.invalidateQueries({ queryKey: ["sl-wrong-notes"] });
  };

  const setTab = (v: string) => {
    params.set("tab", v);
    setParams(params, { replace: true });
  };

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2">
            <Brain className="h-5 w-5 sm:h-6 sm:w-6 text-primary" aria-hidden="true" />
            {t("nav.selfLearning", "AI 자기주도학습")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            학습 계획을 세우고, AI 코치의 진단을 받고, 복습으로 마무리하세요.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="planner" className="gap-1.5">
              <CalendarDays className="h-4 w-4" /> 학습 플래너
            </TabsTrigger>
            <TabsTrigger value="coach" className="gap-1.5">
              <Sparkles className="h-4 w-4" /> AI 코치
            </TabsTrigger>
            <TabsTrigger value="review" className="gap-1.5">
              <ListChecks className="h-4 w-4" /> 복습 퀴즈
              {dueNotes.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">
                  {dueNotes.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ---------- 플래너 ---------- */}
          <TabsContent value="planner" className="mt-4 space-y-4">
            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">학습 목표 설정</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs">강의</Label>
                  <Select value={planCourse} onValueChange={setPlanCourse}>
                    <SelectTrigger>
                      <SelectValue placeholder="강의 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {enrollments.map((e) => (
                        <SelectItem key={e.course_id} value={e.course_id}>
                          {e.courses?.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">목표 완료일</Label>
                  <Input
                    type="date"
                    value={goalDate}
                    min={todayStr()}
                    onChange={(e) => setGoalDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">하루 학습시간(분)</Label>
                  <Input
                    type="number"
                    min={10}
                    max={600}
                    value={dailyMinutes}
                    onChange={(e) => setDailyMinutes(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">학습 요일</Label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((d) => {
                    const on = studyDays.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() =>
                          setStudyDays((prev) =>
                            on ? prev.filter((v) => v !== d.value) : [...prev, d.value],
                          )
                        }
                        className={cn(
                          "h-8 w-9 rounded-md border text-xs transition-colors",
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Button onClick={createPlan} disabled={planning} className="gap-1.5">
                {planning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                AI 학습 계획 만들기
              </Button>
            </Card>

            {plan && (
              <Card className="p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold truncate">
                      {plan.courses?.title} — {plan.goal_date}까지
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {planDone}/{planItems.length}차시 완료 · 하루 {plan.daily_minutes}분 목표
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {planItems.length ? Math.round((planDone / planItems.length) * 100) : 0}%
                  </Badge>
                </div>
                <Progress value={planItems.length ? (planDone / planItems.length) * 100 : 0} />

                {plan.ai_advice && (
                  <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground prose prose-sm max-w-none dark:prose-invert prose-p:my-1">
                    <ReactMarkdown>{plan.ai_advice}</ReactMarkdown>
                  </div>
                )}

                <div className="space-y-3">
                  {grouped.map(([date, items]) => (
                    <div key={date} className="border-b-2 border-border/80 pb-3 last:border-0">
                      <p
                        className={cn(
                          "text-xs font-medium mb-2",
                          date === todayStr() ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {date}
                        {date === todayStr() && " · 오늘"}
                      </p>
                      <ul className="space-y-1.5">
                        {items.map((it) => (
                          <li key={it.id} className="flex items-center gap-2 min-w-0">
                            <Checkbox checked={it.done} onCheckedChange={() => toggleItem(it)} />
                            <Link
                              to={`/student/courses/${plan.course_id}/content/${it.content_id}`}
                              className={cn(
                                "text-sm truncate hover:underline min-w-0",
                                it.done ? "text-muted-foreground line-through" : "text-foreground",
                              )}
                            >
                              {it.title}
                            </Link>
                            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                              {it.estimated_minutes}분
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </TabsContent>

          {/* ---------- AI 코치 ---------- */}
          <TabsContent value="coach" className="mt-4 space-y-4">
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">AI 학습 코치 리포트</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    최근 30일 진도·평가·접속 패턴을 분석해 강점과 다음 행동을 제안합니다.
                  </p>
                </div>
                <Button onClick={runCoach} disabled={coaching} className="gap-1.5">
                  {coaching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  리포트 생성
                </Button>
              </div>
            </Card>

            {report ? (
              <div className="space-y-4">
                <Card className="p-5 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {new Date(report.created_at).toLocaleString("ko-KR")} 기준
                  </p>
                  <p className="text-sm leading-relaxed text-foreground">{report.summary}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    {[
                      { label: "평균 진도", value: `${report.metrics?.avg_course_progress ?? 0}%` },
                      { label: "완료 차시", value: report.metrics?.completed_contents ?? 0 },
                      { label: "30일 학습일", value: `${report.metrics?.active_days_30d ?? 0}일` },
                      {
                        label: "평균 점수",
                        value:
                          report.metrics?.avg_assessment_score != null
                            ? `${report.metrics.avg_assessment_score}점`
                            : "-",
                      },
                    ].map((m) => (
                      <div key={m.label} className="rounded-lg border border-border p-3">
                        <p className="text-[11px] text-muted-foreground">{m.label}</p>
                        <p className="text-lg font-semibold tabular-nums">{m.value}</p>
                      </div>
                    ))}
                  </div>
                </Card>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Card className="p-5 space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-primary" /> 강점
                    </h3>
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      {(report.strengths || []).map((s: string, i: number) => (
                        <li key={i}>· {s}</li>
                      ))}
                    </ul>
                  </Card>
                  <Card className="p-5 space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-primary" /> 보완할 점
                    </h3>
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      {(report.weaknesses || []).map((s: string, i: number) => (
                        <li key={i}>· {s}</li>
                      ))}
                    </ul>
                  </Card>
                </div>

                <Card className="p-5 space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <ArrowRight className="h-4 w-4 text-primary" /> 다음 행동
                  </h3>
                  <ol className="space-y-2">
                    {(report.actions || []).map((a: string, i: number) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
                          {i + 1}
                        </span>
                        <span className="text-foreground">{a}</span>
                      </li>
                    ))}
                  </ol>
                </Card>
              </div>
            ) : (
              <Card className="p-10 text-center text-sm text-muted-foreground">
                아직 생성된 리포트가 없습니다. 리포트 생성 버튼을 눌러보세요.
              </Card>
            )}
          </TabsContent>

          {/* ---------- 복습 ---------- */}
          <TabsContent value="review" className="mt-4 space-y-4">
            <Card className="p-5 space-y-4">
              <h2 className="text-sm font-semibold">AI 복습 퀴즈 만들기</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs">강의</Label>
                  <Select
                    value={quizCourse}
                    onValueChange={(v) => {
                      setQuizCourse(v);
                      setQuizContent("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="강의 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {enrollments.map((e) => (
                        <SelectItem key={e.course_id} value={e.course_id}>
                          {e.courses?.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs">차시</Label>
                  <Select value={quizContent} onValueChange={setQuizContent} disabled={!quizCourse}>
                    <SelectTrigger>
                      <SelectValue placeholder="차시 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {contents.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={generateQuiz} disabled={generating} className="gap-1.5">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                복습 문제 5개 생성
              </Button>
            </Card>

            {activeQuiz && (
              <Card className="p-5 space-y-5">
                <h2 className="text-sm font-semibold">{activeQuiz.title}</h2>
                {(activeQuiz.questions as QuizQuestion[]).map((q, i) => {
                  const picked = answers[i];
                  return (
                    <div key={i} className="space-y-2 border-b-2 border-border/80 pb-4 last:border-0">
                      <p className="text-sm font-medium">
                        {i + 1}. {q.question}
                      </p>
                      <div className="grid gap-1.5">
                        {q.options.map((o, oi) => {
                          const isCorrect = result && oi === q.answer_index;
                          const isWrongPick = result && picked === oi && oi !== q.answer_index;
                          return (
                            <button
                              key={oi}
                              type="button"
                              disabled={!!result}
                              onClick={() => setAnswers((p) => ({ ...p, [i]: oi }))}
                              className={cn(
                                "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                                picked === oi && !result
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/40",
                                isCorrect && "border-primary bg-primary/10",
                                isWrongPick && "border-destructive bg-destructive/10",
                              )}
                            >
                              {o}
                            </button>
                          );
                        })}
                      </div>
                      {result && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{q.explanation}</p>
                      )}
                    </div>
                  );
                })}
                {result ? (
                  <p className="text-sm font-medium">
                    결과: {result.score} / {result.total} 정답
                    {result.score < result.total && " — 틀린 문제는 오답노트에 저장되었습니다."}
                  </p>
                ) : (
                  <Button onClick={submitQuiz} disabled={Object.keys(answers).length === 0}>
                    채점하기
                  </Button>
                )}
              </Card>
            )}

            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">오답노트 (간격 반복 복습)</h2>
                <Badge variant="secondary">오늘 복습 {dueNotes.length}개</Badge>
              </div>
              {wrongNotes.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  아직 오답이 없습니다. 복습 퀴즈를 풀어보세요.
                </p>
              ) : (
                <ul className="space-y-3">
                  {wrongNotes.map((n) => (
                    <li key={n.id} className="border-b-2 border-border/80 pb-3 last:border-0 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium min-w-0">{n.question}</p>
                        {n.resolved ? (
                          <Badge variant="secondary" className="shrink-0">
                            완료
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="shrink-0 whitespace-nowrap">
                            복습일 {n.next_review_at}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        정답: <span className="text-foreground">{n.correct_answer}</span>
                        {n.user_answer && ` · 내 답: ${n.user_answer}`}
                      </p>
                      {n.explanation && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{n.explanation}</p>
                      )}
                      {!n.resolved && (
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => reviewNote(n, true)}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> 이제 알겠어요
                          </Button>
                          <Button size="sm" variant="ghost" className="gap-1" onClick={() => reviewNote(n, false)}>
                            <XCircle className="h-3.5 w-3.5" /> 아직 어려워요
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default SelfLearning;
