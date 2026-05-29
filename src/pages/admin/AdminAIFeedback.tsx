import { MessageSquareText, Sparkles, Loader2, ThumbsUp, AlertTriangle, CheckCircle2, Search } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export default function AdminAIFeedback() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");

  const [filterCourse, setFilterCourse] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("submitted");
  const [searchTerm, setSearchTerm] = useState("");
  const [gradeTarget, setGradeTarget] = useState<any>(null);
  const [gradeScore, setGradeScore] = useState("");
  const [gradeFeedback, setGradeFeedback] = useState("");
  const [aiFeedback, setAiFeedback] = useState<null | {
    suggested_score: number;
    summary: string;
    strengths: string[];
    improvements: string[];
    rubric: Array<{ criterion: string; score: number; comment: string }>;
    next_steps: string;
  }>(null);

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["admin-ai-feedback-subs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignment_submissions")
        .select("*, assignments(title, max_score, course_id, courses(title))")
        .order("submitted_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: studentProfiles = [] } = useQuery({
    queryKey: ["admin-ai-feedback-profiles", submissions.map((s: any) => s.student_id)],
    queryFn: async () => {
      const ids = [...new Set(submissions.map((s: any) => s.student_id))];
      if (ids.length === 0) return [];
      const { data, error } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      if (error) throw error;
      return data;
    },
    enabled: submissions.length > 0,
  });

  const profileMap = new Map(studentProfiles.map((p: any) => [p.user_id, p.full_name]));

  const courses = useMemo(() => {
    const map = new Map<string, string>();
    submissions.forEach((s: any) => {
      if (s.assignments?.course_id) map.set(s.assignments.course_id, s.assignments.courses?.title || "-");
    });
    return Array.from(map.entries());
  }, [submissions]);

  const filtered = useMemo(() => {
    return submissions.filter((s: any) => {
      if (filterCourse !== "all" && s.assignments?.course_id !== filterCourse) return false;
      if (filterStatus !== "all" && s.status !== filterStatus) return false;
      if (searchTerm.trim()) {
        const name = (profileMap.get(s.student_id) || "").toLowerCase();
        const title = (s.assignments?.title || "").toLowerCase();
        const q = searchTerm.toLowerCase();
        if (!name.includes(q) && !title.includes(q)) return false;
      }
      return true;
    });
  }, [submissions, filterCourse, filterStatus, searchTerm, profileMap]);

  const aiFeedbackMutation = useMutation({
    mutationFn: async () => {
      if (!gradeTarget?.id) throw new Error("제출물을 선택하세요.");
      const { data, error } = await supabase.functions.invoke("ai-assignment-feedback", {
        body: { submission_id: gradeTarget.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as any;
    },
    onSuccess: (data: any) => {
      setAiFeedback(data);
      toast({ title: isEn ? "AI feedback generated." : "AI 피드백이 생성되었습니다." });
    },
    onError: (e: any) =>
      toast({ title: isEn ? "AI feedback failed" : "AI 피드백 생성 실패", description: e?.message, variant: "destructive" }),
  });

  const applyAiFeedback = () => {
    if (!aiFeedback) return;
    setGradeScore(String(aiFeedback.suggested_score));
    const rubricText = aiFeedback.rubric
      .map((r) => `• ${r.criterion} (${r.score}/100): ${r.comment}`)
      .join("\n");
    const composed = [
      `[총평] ${aiFeedback.summary}`,
      "",
      "[잘한 점]",
      ...aiFeedback.strengths.map((s) => `• ${s}`),
      "",
      "[개선할 점]",
      ...aiFeedback.improvements.map((s) => `• ${s}`),
      "",
      "[평가 항목]",
      rubricText,
      "",
      `[다음 단계] ${aiFeedback.next_steps}`,
    ].join("\n");
    setGradeFeedback(composed);
    toast({ title: isEn ? "Applied to score/feedback fields." : "AI 피드백이 점수/피드백 칸에 채워졌습니다." });
  };

  const gradeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("assignment_submissions").update({
        score: parseInt(gradeScore),
        feedback: gradeFeedback || null,
        status: "graded" as any,
        graded_at: new Date().toISOString(),
        graded_by: user!.id,
      }).eq("id", gradeTarget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ai-feedback-subs"] });
      toast({ title: isEn ? "Graded." : "채점되었습니다." });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openDialog = (sub: any) => {
    setGradeTarget(sub);
    setGradeScore(sub.score?.toString() || "");
    setGradeFeedback(sub.feedback || "");
    setAiFeedback(null);
  };

  const closeDialog = () => {
    setGradeTarget(null);
    setGradeScore("");
    setGradeFeedback("");
    setAiFeedback(null);
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 min-w-0">
        <div className="flex items-start gap-3">
          <MessageSquareText className="h-7 w-7 text-foreground mt-1" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              {isEn ? "AI Assignment Feedback" : "AI 과제 피드백"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isEn
                ? "Generate AI-assisted feedback and suggested scores for student submissions across all courses."
                : "전체 과목 학생 제출물에 대해 AI 기반 피드백과 추천 점수를 자동으로 생성합니다."}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Select value={filterCourse} onValueChange={setFilterCourse}>
            <SelectTrigger className="w-full sm:w-64 h-10 rounded-xl">
              <SelectValue placeholder={isEn ? "Course" : "강의"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isEn ? "All courses" : "전체 강의"}</SelectItem>
              {courses.map(([id, title]) => (
                <SelectItem key={id} value={id}>{title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-48 h-10 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isEn ? "All status" : "전체 상태"}</SelectItem>
              <SelectItem value="submitted">{isEn ? "Submitted" : "제출됨"}</SelectItem>
              <SelectItem value="graded">{isEn ? "Graded" : "채점됨"}</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isEn ? "Search student or assignment..." : "학생명 또는 과제명 검색..."}
              className="pl-9 h-10 rounded-xl"
            />
          </div>
        </div>

        {/* List */}
        <div className="border-2 border-border/80 rounded-md overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">{isEn ? "Loading..." : "불러오는 중..."}</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              {isEn ? "No submissions found." : "표시할 제출물이 없습니다."}
            </div>
          ) : (
            <ul className="divide-y-2 divide-border/80">
              {filtered.map((s: any) => (
                <li key={s.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{profileMap.get(s.student_id) || "-"}</span>
                      <Badge variant="outline" className="text-[10px]">{s.assignments?.courses?.title || "-"}</Badge>
                      {s.status === "graded" ? (
                        <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-0">
                          <CheckCircle2 className="h-3 w-3 mr-1" />{isEn ? "Graded" : "채점됨"} · {s.score}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">{isEn ? "Submitted" : "제출됨"}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{s.assignments?.title}</p>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => openDialog(s)}>
                    <Sparkles className="h-3.5 w-3.5" />
                    {isEn ? "AI Feedback" : "AI 피드백"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Grade + AI dialog */}
      <Dialog open={!!gradeTarget} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEn ? "Grade with AI Feedback" : "AI 피드백으로 채점"}</DialogTitle>
            <DialogDescription>
              {gradeTarget && (
                <>
                  {profileMap.get(gradeTarget.student_id) || "-"} · {gradeTarget.assignments?.title}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {gradeTarget && (
            <div className="space-y-4">
              {/* Submission text */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">{isEn ? "Submission" : "제출 내용"}</p>
                <div className="text-sm border rounded-md p-3 bg-muted/30 max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {gradeTarget.submission_text || (isEn ? "(No text)" : "(텍스트 없음)")}
                </div>
              </div>

              {/* AI feedback section */}
              <div className="border-2 border-border/80 rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4" /> {isEn ? "AI Feedback" : "AI 피드백"}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => aiFeedbackMutation.mutate()}
                    disabled={aiFeedbackMutation.isPending || !gradeTarget?.submission_text}
                    className="rounded-xl gap-1.5"
                  >
                    {aiFeedbackMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {aiFeedback ? (isEn ? "Regenerate" : "다시 생성") : (isEn ? "Generate" : "AI 피드백 생성")}
                  </Button>
                </div>

                {aiFeedback && (
                  <div className="space-y-3 text-sm">
                    <Badge variant="secondary" className="text-xs">
                      {isEn ? "Suggested" : "추천 점수"} {aiFeedback.suggested_score} / {gradeTarget.assignments?.max_score || 100}
                    </Badge>
                    <p className="text-sm text-muted-foreground">{aiFeedback.summary}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1 mb-1">
                          <ThumbsUp className="h-3 w-3" /> {isEn ? "Strengths" : "잘한 점"}
                        </p>
                        <ul className="text-xs space-y-1 list-disc list-inside text-muted-foreground">
                          {aiFeedback.strengths.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-amber-600 flex items-center gap-1 mb-1">
                          <AlertTriangle className="h-3 w-3" /> {isEn ? "Improvements" : "개선할 점"}
                        </p>
                        <ul className="text-xs space-y-1 list-disc list-inside text-muted-foreground">
                          {aiFeedback.improvements.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    </div>
                    <Button size="sm" onClick={applyAiFeedback} className="rounded-xl w-full">
                      {isEn ? "Apply to score & feedback" : "점수·피드백에 적용"}
                    </Button>
                  </div>
                )}
              </div>

              {/* Manual grade */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  {isEn ? "Score" : "점수"} (/ {gradeTarget.assignments?.max_score || 100})
                </label>
                <Input type="number" value={gradeScore} onChange={(e) => setGradeScore(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">{isEn ? "Feedback" : "피드백"}</label>
                <Textarea rows={6} value={gradeFeedback} onChange={(e) => setGradeFeedback(e.target.value)} className="rounded-xl" />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} className="rounded-xl">{isEn ? "Cancel" : "취소"}</Button>
            <Button
              onClick={() => gradeMutation.mutate()}
              disabled={gradeMutation.isPending || !gradeScore}
              className="rounded-xl"
            >
              {gradeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isEn ? "Save grade" : "채점 저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}