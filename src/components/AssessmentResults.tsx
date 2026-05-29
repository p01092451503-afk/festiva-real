import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X, ChevronDown, ChevronRight, Search, MessageSquare, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useUser } from "@/contexts/UserContext";
import { toast } from "sonner";

interface Props {
  courseId: string;
  assessmentId: string;
  assessmentTitle: string;
  passingScore: number;
}

interface GradeState {
  answerId: string;
  pointsEarned: number;
  feedback: string;
  maxPoints: number;
}

export default function AssessmentResults({ courseId, assessmentId, assessmentTitle, passingScore }: Props) {
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [grading, setGrading] = useState<Record<string, GradeState>>({});

  const { data: attempts = [], isLoading } = useQuery({
    queryKey: ["assessment-results", assessmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_attempts")
        .select("*")
        .eq("assessment_id", assessmentId)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!assessmentId,
  });

  const userIds = [...new Set(attempts.map((a: any) => a.user_id))];

  const { data: profiles = [] } = useQuery({
    queryKey: ["assessment-result-profiles", userIds],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, department, employee_id")
        .in("user_id", userIds);
      if (error) throw error;
      return data;
    },
    enabled: userIds.length > 0,
  });

  const { data: expandedAnswers = [] } = useQuery({
    queryKey: ["assessment-result-answers", expandedStudent],
    queryFn: async () => {
      if (!expandedStudent) return [];
      const studentAttempts = attempts.filter((a: any) => a.user_id === expandedStudent);
      const latestAttempt = studentAttempts[0];
      if (!latestAttempt) return [];
      const { data, error } = await supabase
        .from("assessment_answers")
        .select("*, assessment_questions(question_text, correct_answer, question_type, options, explanation, points)")
        .eq("attempt_id", latestAttempt.id);
      if (error) throw error;
      return data;
    },
    enabled: !!expandedStudent,
  });

  // Grade mutation
  const gradeMutation = useMutation({
    mutationFn: async ({ answerId, pointsEarned, feedback, isCorrect }: {
      answerId: string; pointsEarned: number; feedback: string; isCorrect: boolean;
    }) => {
      const { error } = await supabase
        .from("assessment_answers")
        .update({
          points_earned: pointsEarned,
          is_correct: isCorrect,
          feedback,
          graded_by: user?.id,
          graded_at: new Date().toISOString(),
        })
        .eq("id", answerId);
      if (error) throw error;
    },
    onSuccess: async (_, variables) => {
      // Recalculate attempt score
      const studentAttempts = attempts.filter((a: any) => a.user_id === expandedStudent);
      const latestAttempt = studentAttempts[0];
      if (latestAttempt) {
        const { data: allAnswers } = await supabase
          .from("assessment_answers")
          .select("points_earned, assessment_questions(points)")
          .eq("attempt_id", latestAttempt.id);

        if (allAnswers) {
          const totalScore = allAnswers.reduce((sum: number, a: any) => sum + Number(a.points_earned || 0), 0);
          const totalPoints = allAnswers.reduce((sum: number, a: any) => sum + Number(a.assessment_questions?.points || 0), 0);
          const scorePercent = totalPoints > 0 ? Math.round((totalScore / totalPoints) * 100) : 0;
          const passed = scorePercent >= passingScore;

          await supabase
            .from("assessment_attempts")
            .update({ score: totalScore, total_points: totalPoints, passed })
            .eq("id", latestAttempt.id);
        }
      }

      // Clear grading state for this answer
      setGrading(prev => {
        const next = { ...prev };
        delete next[variables.answerId];
        return next;
      });

      queryClient.invalidateQueries({ queryKey: ["assessment-result-answers", expandedStudent] });
      queryClient.invalidateQueries({ queryKey: ["assessment-results", assessmentId] });
      toast.success(isEn ? "Grading saved" : "채점이 저장되었습니다");
    },
    onError: () => {
      toast.error(isEn ? "Failed to save grading" : "채점 저장에 실패했습니다");
    },
  });

  const profileMap = new Map(profiles.map((p: any) => [p.user_id, p]));

  const studentSummaries = userIds.map(uid => {
    const studentAttempts = attempts.filter((a: any) => a.user_id === uid);
    const profile = profileMap.get(uid);
    const bestAttempt = studentAttempts.reduce((best: any, a: any) =>
      (!best || Number(a.score) > Number(best.score)) ? a : best, null);
    const latestAttempt = studentAttempts[0];
    return {
      userId: uid,
      name: profile?.full_name || (isEn ? "Unknown" : "알 수 없음"),
      department: profile?.department || "",
      employeeId: profile?.employee_id || "",
      attemptCount: studentAttempts.length,
      bestScore: Number(bestAttempt?.score || 0),
      totalPoints: Number(bestAttempt?.total_points || 0),
      passed: bestAttempt?.passed || false,
      latestScore: Number(latestAttempt?.score || 0),
      latestDate: latestAttempt?.completed_at,
    };
  });

  const filtered = studentSummaries.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.department.toLowerCase().includes(search.toLowerCase()) ||
    s.employeeId.toLowerCase().includes(search.toLowerCase())
  );

  const passedCount = studentSummaries.filter(s => s.passed).length;
  const avgScore = studentSummaries.length > 0
    ? Math.round(studentSummaries.reduce((sum, s) => sum + (s.totalPoints > 0 ? (s.bestScore / s.totalPoints) * 100 : 0), 0) / studentSummaries.length)
    : 0;

  // Count pending essay grading
  const pendingGradingCount = expandedAnswers.filter((ans: any) => {
    const q = ans.assessment_questions;
    return (q?.question_type === "essay" || q?.question_type === "short_answer") && ans.is_correct === null;
  }).length;

  const startGrading = (ans: any) => {
    const q = ans.assessment_questions;
    setGrading(prev => ({
      ...prev,
      [ans.id]: {
        answerId: ans.id,
        pointsEarned: Number(ans.points_earned || 0),
        feedback: (ans as any).feedback || "",
        maxPoints: q?.points || 10,
      },
    }));
  };

  const handleGradeSubmit = (answerId: string) => {
    const g = grading[answerId];
    if (!g) return;
    gradeMutation.mutate({
      answerId,
      pointsEarned: g.pointsEarned,
      feedback: g.feedback,
      isCorrect: g.pointsEarned > 0,
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <span className="h-5 w-5 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-secondary/30 p-3 text-center">
          <p className="text-[10px] text-muted-foreground">{isEn ? "Total Students" : "응시자 수"}</p>
          <p className="text-xl font-bold text-foreground">{studentSummaries.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-secondary/30 p-3 text-center">
          <p className="text-[10px] text-muted-foreground">{isEn ? "Passed" : "합격"}</p>
          <p className="text-xl font-bold text-green-600 dark:text-green-400">{passedCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-secondary/30 p-3 text-center">
          <p className="text-[10px] text-muted-foreground">{isEn ? "Failed" : "불합격"}</p>
          <p className="text-xl font-bold text-destructive">{studentSummaries.length - passedCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-secondary/30 p-3 text-center">
          <p className="text-[10px] text-muted-foreground">{isEn ? "Avg Score" : "평균 점수"}</p>
          <p className="text-xl font-bold text-foreground">{avgScore}%</p>
        </div>
      </div>

      {/* Pass rate bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{isEn ? "Pass Rate" : "합격률"}</span>
          <span>{studentSummaries.length > 0 ? Math.round((passedCount / studentSummaries.length) * 100) : 0}%</span>
        </div>
        <Progress value={studentSummaries.length > 0 ? (passedCount / studentSummaries.length) * 100 : 0} className="h-2" />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={isEn ? "Search by name, department..." : "이름, 부서로 검색..."}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Student list */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          {studentSummaries.length === 0
            ? (isEn ? "No students have taken this assessment yet." : "아직 응시한 학생이 없습니다.")
            : (isEn ? "No matching results." : "검색 결과가 없습니다.")}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
          <div className="hidden sm:grid grid-cols-[1fr_100px_100px_80px_80px] gap-2 px-4 py-2 bg-secondary/30 text-[10px] font-semibold text-muted-foreground uppercase">
            <span>{isEn ? "Student" : "학생"}</span>
            <span className="text-center">{isEn ? "Best Score" : "최고 점수"}</span>
            <span className="text-center">{isEn ? "Result" : "결과"}</span>
            <span className="text-center">{isEn ? "Attempts" : "응시 횟수"}</span>
            <span className="text-center">{isEn ? "Detail" : "상세"}</span>
          </div>

          {filtered.map(student => {
            const isExpanded = expandedStudent === student.userId;
            const scorePercent = student.totalPoints > 0 ? Math.round((student.bestScore / student.totalPoints) * 100) : 0;

            return (
              <div key={student.userId}>
                <div
                  className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_100px_100px_80px_80px] gap-2 px-4 py-3 items-center hover:bg-accent/20 transition-colors cursor-pointer"
                  onClick={() => setExpandedStudent(isExpanded ? null : student.userId)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{student.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {[student.department, student.employeeId].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="hidden sm:block text-center">
                    <span className="text-sm font-semibold">{student.bestScore}/{student.totalPoints}</span>
                    <p className="text-[10px] text-muted-foreground">{scorePercent}%</p>
                  </div>
                  <div className="hidden sm:flex justify-center">
                    <Badge variant={student.passed ? "default" : "destructive"} className="text-[10px] h-5">
                      {student.passed ? (isEn ? "Pass" : "합격") : (isEn ? "Fail" : "불합격")}
                    </Badge>
                  </div>
                  <div className="hidden sm:block text-center text-xs text-muted-foreground">
                    {student.attemptCount}{isEn ? "" : "회"}
                  </div>
                  <div className="flex items-center justify-center gap-2 sm:gap-0">
                    <Badge variant={student.passed ? "default" : "destructive"} className="text-[10px] h-5 sm:hidden">
                      {student.passed ? (isEn ? "Pass" : "합격") : (isEn ? "Fail" : "불합격")}
                    </Badge>
                    <span className="text-xs text-muted-foreground sm:hidden">{student.bestScore}/{student.totalPoints}</span>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 bg-accent/10">
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-muted-foreground">
                          {isEn ? "Latest attempt answers" : "최근 응시 답안"}
                        </p>
                        {pendingGradingCount > 0 && (
                          <Badge variant="outline" className="text-[10px] border-orange-400 text-orange-600 dark:text-orange-400">
                            <MessageSquare className="h-3 w-3 mr-1" />
                            {isEn ? `${pendingGradingCount} pending grading` : `${pendingGradingCount}개 채점 대기`}
                          </Badge>
                        )}
                      </div>
                      {expandedAnswers.length === 0 ? (
                        <div className="flex justify-center py-4">
                          <span className="h-4 w-4 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {expandedAnswers.map((ans: any, idx: number) => {
                            const q = ans.assessment_questions;
                            const isEssayType = q?.question_type === "essay" || q?.question_type === "short_answer";
                            const needsGrading = isEssayType && ans.is_correct === null;
                            const isGradingThis = grading[ans.id] !== undefined;

                            return (
                              <div key={ans.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm text-foreground flex-1">
                                    <span className="font-semibold text-muted-foreground mr-1.5">{idx + 1}.</span>
                                    {q?.question_text}
                                  </p>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {isEssayType && (
                                      <Badge variant="outline" className="text-[9px] h-4">
                                        {q?.question_type === "essay" ? (isEn ? "Essay" : "서술형") : (isEn ? "Short" : "단답형")}
                                      </Badge>
                                    )}
                                    {ans.is_correct === true && (
                                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-semibold">
                                        <Check className="h-3.5 w-3.5" /> {isEn ? "Correct" : "정답"}
                                      </span>
                                    )}
                                    {ans.is_correct === false && (
                                      <span className="flex items-center gap-1 text-destructive text-xs font-semibold">
                                        <X className="h-3.5 w-3.5" /> {isEn ? "Wrong" : "오답"}
                                      </span>
                                    )}
                                    {ans.is_correct === null && (
                                      <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                                        {isEn ? "Pending" : "채점 대기"}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Student answer */}
                                <div className="rounded-md bg-secondary/50 p-2.5 text-sm text-foreground">
                                  <p className="text-[10px] text-muted-foreground mb-1">{isEn ? "Student Answer" : "학생 답변"}</p>
                                  <p className="whitespace-pre-wrap">{ans.user_answer || (isEn ? "(No answer)" : "(미답변)")}</p>
                                </div>

                                {/* Correct answer for non-essay */}
                                {!isEssayType && (
                                  <div className="text-xs">
                                    <span className="text-muted-foreground">{isEn ? "Correct: " : "정답: "}</span>
                                    <span className="font-medium text-green-600 dark:text-green-400">{q?.correct_answer}</span>
                                  </div>
                                )}

                                {/* Existing feedback display (when already graded) */}
                                {(ans as any).feedback && !isGradingThis && (
                                  <div className="rounded-md bg-primary/5 border border-primary/20 p-2.5">
                                    <p className="text-[10px] text-primary font-medium mb-1">
                                      <MessageSquare className="h-3 w-3 inline mr-1" />
                                      {isEn ? "Instructor Feedback" : "강사 피드백"}
                                    </p>
                                    <p className="text-sm text-foreground whitespace-pre-wrap">{(ans as any).feedback}</p>
                                  </div>
                                )}

                                {/* Points */}
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-muted-foreground">
                                    {ans.points_earned ?? 0}/{q?.points} {isEn ? "points" : "점"}
                                  </span>

                                  {/* Grade button for essay types */}
                                  {isEssayType && !isGradingThis && (
                                    <Button
                                      size="sm"
                                      variant={needsGrading ? "default" : "outline"}
                                      className="h-7 text-xs gap-1"
                                      onClick={() => startGrading(ans)}
                                    >
                                      <MessageSquare className="h-3 w-3" />
                                      {needsGrading
                                        ? (isEn ? "Grade" : "채점하기")
                                        : (isEn ? "Edit Grade" : "채점 수정")}
                                    </Button>
                                  )}
                                </div>

                                {/* Grading form */}
                                {isGradingThis && (
                                  <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3 space-y-3">
                                    <p className="text-xs font-semibold text-primary">
                                      {isEn ? "Manual Grading" : "수동 채점"}
                                    </p>

                                    {/* Score input */}
                                    <div className="flex items-center gap-2">
                                      <label className="text-xs text-muted-foreground whitespace-nowrap">
                                        {isEn ? "Score" : "점수"}
                                      </label>
                                      <Input
                                        type="number"
                                        min={0}
                                        max={grading[ans.id].maxPoints}
                                        value={grading[ans.id].pointsEarned}
                                        onChange={e => setGrading(prev => ({
                                          ...prev,
                                          [ans.id]: { ...prev[ans.id], pointsEarned: Math.min(Number(e.target.value) || 0, prev[ans.id].maxPoints) },
                                        }))}
                                        className="h-8 w-20 text-sm"
                                      />
                                      <span className="text-xs text-muted-foreground">/ {grading[ans.id].maxPoints}</span>
                                    </div>

                                    {/* Feedback textarea */}
                                    <div className="space-y-1">
                                      <label className="text-xs text-muted-foreground">
                                        {isEn ? "Feedback" : "피드백"}
                                      </label>
                                      <Textarea
                                        placeholder={isEn ? "Enter feedback for the student..." : "학생에게 피드백을 입력하세요..."}
                                        value={grading[ans.id].feedback}
                                        onChange={e => setGrading(prev => ({
                                          ...prev,
                                          [ans.id]: { ...prev[ans.id], feedback: e.target.value },
                                        }))}
                                        className="min-h-[60px] text-sm"
                                      />
                                    </div>

                                    {/* Actions */}
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-xs"
                                        onClick={() => setGrading(prev => {
                                          const next = { ...prev };
                                          delete next[ans.id];
                                          return next;
                                        })}
                                      >
                                        {isEn ? "Cancel" : "취소"}
                                      </Button>
                                      <Button
                                        size="sm"
                                        className="h-7 text-xs gap-1"
                                        disabled={gradeMutation.isPending}
                                        onClick={() => handleGradeSubmit(ans.id)}
                                      >
                                        <Save className="h-3 w-3" />
                                        {gradeMutation.isPending
                                          ? (isEn ? "Saving..." : "저장 중...")
                                          : (isEn ? "Save" : "저장")}
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
