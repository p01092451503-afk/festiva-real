import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Eye, EyeOff, ClipboardCheck, Users, Languages, Loader2 } from "lucide-react";
import AssessmentResults from "@/components/AssessmentResults";
import AssessmentPoolRules from "@/components/AssessmentPoolRules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { translateKoToEn, autoTranslateInBackground } from "@/lib/translate";
import AIQuestionGenerator from "@/components/admin/AIQuestionGenerator";

type QuestionType = "multiple_choice_4" | "multiple_choice_5" | "short_answer" | "essay" | "ox";

interface QuestionForm {
  question_type: QuestionType;
  question_text: string;
  options: string[];
  correct_answer: string;
  points: number;
  explanation: string;
  hint: string;
  // EN fields
  en_question_text: string;
  en_options: string[];
  en_correct_answer: string;
  en_explanation: string;
  en_hint: string;
  // Manual edit flags
  en_question_text_manual: boolean;
  en_options_manual: boolean;
  en_correct_answer_manual: boolean;
  en_explanation_manual: boolean;
  en_hint_manual: boolean;
}

const emptyQuestion: QuestionForm = {
  question_type: "multiple_choice_4",
  question_text: "",
  options: ["", "", "", ""],
  correct_answer: "",
  points: 10,
  explanation: "",
  hint: "",
  en_question_text: "",
  en_options: ["", "", "", ""],
  en_correct_answer: "",
  en_explanation: "",
  en_hint: "",
  en_question_text_manual: false,
  en_options_manual: false,
  en_correct_answer_manual: false,
  en_explanation_manual: false,
  en_hint_manual: false,
};

const questionTypeLabels: Record<QuestionType, { ko: string; en: string }> = {
  multiple_choice_4: { ko: "4지선다", en: "4 Choices" },
  multiple_choice_5: { ko: "5지선다", en: "5 Choices" },
  short_answer: { ko: "단답형", en: "Short Answer" },
  essay: { ko: "서술형", en: "Essay" },
  ox: { ko: "OX", en: "True/False" },
};

export default function AssessmentManager({ courseId }: { courseId: string }) {
  const { user } = useUser();
  const { isAdmin, isSuperAdmin } = useUserRole();
  // Hard guard: AI 문제 생성 버튼은 admin/super_admin 전용 + role-switcher가 admin인 경우에만 노출
  const activeRoleLS = (() => {
    try { return localStorage.getItem("nf-active-role"); } catch { return null; }
  })();
  const canUseAIGen =
    (isAdmin || isSuperAdmin) && (!activeRoleLS || activeRoleLS === "admin");
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const queryClient = useQueryClient();

  const [assessmentDialogOpen, setAssessmentDialogOpen] = useState(false);
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [questionForm, setQuestionForm] = useState<QuestionForm>(emptyQuestion);
  const [showResults, setShowResults] = useState(false);

  // Assessment form with EN fields
  const [assessmentForm, setAssessmentForm] = useState({
    title: "",
    description: "",
    passing_score: 60,
    max_attempts: 3,
    time_limit_minutes: null as number | null,
    completion_threshold: 100,
    require_assessment_for_completion: false,
    randomize_questions: true,
    is_published: false,
    selection_mode: "fixed" as "fixed" | "random_pool",
  });
  const [enTitle, setEnTitle] = useState("");
  const [enDescription, setEnDescription] = useState("");
  const [enTitleManual, setEnTitleManual] = useState(false);
  const [enDescManual, setEnDescManual] = useState(false);
  const [translatingAssessment, setTranslatingAssessment] = useState(false);
  const [translatingQuestion, setTranslatingQuestion] = useState(false);

  // Auto-sync KO → EN for assessment
  useEffect(() => {
    if (!enTitleManual) setEnTitle(assessmentForm.title);
  }, [assessmentForm.title, enTitleManual]);

  useEffect(() => {
    if (!enDescManual) setEnDescription(assessmentForm.description);
  }, [assessmentForm.description, enDescManual]);

  // Auto-sync KO → EN for question
  useEffect(() => {
    if (!questionForm.en_question_text_manual) {
      setQuestionForm(f => ({ ...f, en_question_text: f.question_text }));
    }
  }, [questionForm.question_text, questionForm.en_question_text_manual]);

  useEffect(() => {
    if (!questionForm.en_correct_answer_manual) {
      setQuestionForm(f => ({ ...f, en_correct_answer: f.correct_answer }));
    }
  }, [questionForm.correct_answer, questionForm.en_correct_answer_manual]);

  useEffect(() => {
    if (!questionForm.en_explanation_manual) {
      setQuestionForm(f => ({ ...f, en_explanation: f.explanation }));
    }
  }, [questionForm.explanation, questionForm.en_explanation_manual]);

  useEffect(() => {
    if (!questionForm.en_hint_manual) {
      setQuestionForm(f => ({ ...f, en_hint: f.hint }));
    }
  }, [questionForm.hint, questionForm.en_hint_manual]);

  useEffect(() => {
    if (!questionForm.en_options_manual) {
      setQuestionForm(f => ({ ...f, en_options: [...f.options] }));
    }
  }, [questionForm.options, questionForm.en_options_manual]);

  // Fetch assessment
  const { data: assessment, isLoading } = useQuery({
    queryKey: ["assessment", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select("*")
        .eq("course_id", courseId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch questions
  const { data: questions = [] } = useQuery({
    queryKey: ["assessment-questions", assessment?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_questions")
        .select("*")
        .eq("assessment_id", assessment!.id)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!assessment?.id,
  });

  // Fetch assessment i18n
  const { data: assessmentI18n } = useQuery({
    queryKey: ["assessment-i18n", assessment?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_i18n" as any)
        .select("*")
        .eq("assessment_id", assessment!.id)
        .eq("language_code", "en")
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!assessment?.id,
  });

  // Fetch question i18n
  const { data: questionI18nList = [] } = useQuery({
    queryKey: ["assessment-question-i18n", assessment?.id],
    queryFn: async () => {
      const qIds = questions.map((q: any) => q.id);
      if (qIds.length === 0) return [];
      const { data, error } = await supabase
        .from("assessment_question_i18n" as any)
        .select("*")
        .in("question_id", qIds)
        .eq("language_code", "en");
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: questions.length > 0,
  });

  const questionI18nMap = new Map((questionI18nList || []).map((qi: any) => [qi.question_id, qi]));

  // Create/update assessment
  const upsertAssessmentMutation = useMutation({
    mutationFn: async () => {
      let assessmentId = assessment?.id;
      if (assessment) {
        const { error } = await supabase.from("assessments").update({
          ...assessmentForm,
        }).eq("id", assessment.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("assessments").insert({
          ...assessmentForm,
          course_id: courseId,
          created_by: user!.id,
        }).select("id").single();
        if (error) throw error;
        assessmentId = data.id;
      }

      // Save EN i18n
      if (assessmentId && (enTitle.trim() || enDescription.trim())) {
        const { error } = await supabase.from("assessment_i18n" as any).upsert({
          assessment_id: assessmentId,
          language_code: "en",
          title: enTitle || assessmentForm.title,
          description: enDescription || null,
        } as any, { onConflict: "assessment_id,language_code" });
        if (error) console.error("i18n save error:", error);
      } else if (assessmentId) {
        // No manual EN provided → fire background AI translation
        autoTranslateInBackground("assessment", [assessmentId]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment", courseId] });
      queryClient.invalidateQueries({ queryKey: ["assessment-i18n"] });
      setAssessmentDialogOpen(false);
      toast({ title: t("assessment.saved") });
    },
    onError: (e: any) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  // Add/update question
  const upsertQuestionMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        assessment_id: assessment!.id,
        question_type: questionForm.question_type,
        question_text: questionForm.question_text,
        options: ["multiple_choice_4", "multiple_choice_5", "ox"].includes(questionForm.question_type)
          ? questionForm.options
          : null,
        correct_answer: questionForm.correct_answer,
        points: questionForm.points,
        explanation: questionForm.explanation || null,
        hint: questionForm.hint || null,
      };

      let questionId = editingQuestionId;
      if (editingQuestionId) {
        const { error } = await supabase.from("assessment_questions").update(payload).eq("id", editingQuestionId);
        if (error) throw error;
      } else {
        const maxOrder = questions.length > 0 ? Math.max(...questions.map((q: any) => q.order_index ?? 0)) + 1 : 0;
        const { data, error } = await supabase.from("assessment_questions").insert({ ...payload, order_index: maxOrder }).select("id").single();
        if (error) throw error;
        questionId = data.id;
      }

      // Save EN i18n
      if (questionId) {
        const hasManualEn =
          (questionForm.en_question_text || "").trim() ||
          (questionForm.en_explanation || "").trim() ||
          (questionForm.en_hint || "").trim();
        const enPayload: any = {
          question_id: questionId,
          language_code: "en",
          question_text: questionForm.en_question_text || questionForm.question_text,
          options: ["multiple_choice_4", "multiple_choice_5", "ox"].includes(questionForm.question_type)
            ? questionForm.en_options
            : null,
          correct_answer: questionForm.en_correct_answer || questionForm.correct_answer,
          explanation: questionForm.en_explanation || null,
          hint: questionForm.en_hint || null,
        };
        if (hasManualEn) {
          const { error } = await supabase.from("assessment_question_i18n" as any).upsert(
            enPayload,
            { onConflict: "question_id,language_code" }
          );
          if (error) console.error("question i18n save error:", error);
        } else {
          // No manual EN provided → fire background AI translation
          autoTranslateInBackground("question", [questionId]);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-questions", assessment?.id] });
      queryClient.invalidateQueries({ queryKey: ["assessment-question-i18n"] });
      setQuestionDialogOpen(false);
      setEditingQuestionId(null);
      setQuestionForm(emptyQuestion);
      toast({ title: editingQuestionId ? t("assessment.questionUpdated") : t("assessment.questionAdded") });
    },
    onError: (e: any) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assessment_questions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-questions", assessment?.id] });
      toast({ title: t("assessment.questionDeleted") });
    },
    onError: (e: any) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const togglePublishMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("assessments").update({ is_published: !assessment!.is_published }).eq("id", assessment!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment", courseId] });
      toast({ title: assessment?.is_published ? t("assessment.unpublished") : t("assessment.published") });
    },
  });

  const openEditAssessment = () => {
    if (assessment) {
      setAssessmentForm({
        title: assessment.title,
        description: assessment.description || "",
        passing_score: assessment.passing_score,
        max_attempts: assessment.max_attempts,
        time_limit_minutes: assessment.time_limit_minutes,
        completion_threshold: Number(assessment.completion_threshold),
        require_assessment_for_completion: assessment.require_assessment_for_completion,
        randomize_questions: assessment.randomize_questions,
        is_published: assessment.is_published,
        selection_mode: ((assessment as any).selection_mode || "fixed") as "fixed" | "random_pool",
      });
      setEnTitle(assessmentI18n?.title || assessment.title);
      setEnDescription(assessmentI18n?.description || assessment.description || "");
      setEnTitleManual(!!assessmentI18n);
      setEnDescManual(!!assessmentI18n);
    } else {
      setAssessmentForm({
        title: isEn ? "Course Assessment" : "과정 평가",
        description: "",
        passing_score: 60,
        max_attempts: 3,
        time_limit_minutes: null,
        completion_threshold: 100,
        require_assessment_for_completion: false,
        randomize_questions: true,
        is_published: false,
        selection_mode: "fixed",
      });
      setEnTitle("");
      setEnDescription("");
      setEnTitleManual(false);
      setEnDescManual(false);
    }
    setAssessmentDialogOpen(true);
  };

  const openAddQuestion = () => {
    setEditingQuestionId(null);
    setQuestionForm(emptyQuestion);
    setQuestionDialogOpen(true);
  };

  const openEditQuestion = (q: any) => {
    setEditingQuestionId(q.id);
    const opts = q.options || [];
    const i18n = questionI18nMap.get(q.id);
    const enOpts = i18n?.options || [];

    setQuestionForm({
      question_type: q.question_type,
      question_text: q.question_text,
      options: q.question_type === "multiple_choice_5"
        ? [...opts, ...Array(5 - opts.length).fill("")]
        : q.question_type === "multiple_choice_4"
        ? [...opts, ...Array(4 - opts.length).fill("")]
        : q.question_type === "ox"
        ? ["O", "X"]
        : [],
      correct_answer: q.correct_answer,
      points: q.points,
      explanation: q.explanation || "",
      hint: q.hint || "",
      en_question_text: i18n?.question_text || q.question_text,
      en_options: q.question_type === "multiple_choice_5"
        ? [...enOpts, ...Array(Math.max(0, 5 - enOpts.length)).fill("")]
        : q.question_type === "multiple_choice_4"
        ? [...enOpts, ...Array(Math.max(0, 4 - enOpts.length)).fill("")]
        : q.question_type === "ox"
        ? ["O", "X"]
        : [],
      en_correct_answer: i18n?.correct_answer || q.correct_answer,
      en_explanation: i18n?.explanation || q.explanation || "",
      en_hint: i18n?.hint || q.hint || "",
      en_question_text_manual: !!i18n,
      en_options_manual: !!i18n,
      en_correct_answer_manual: !!i18n,
      en_explanation_manual: !!i18n,
      en_hint_manual: !!i18n,
    });
    setQuestionDialogOpen(true);
  };

  const handleTypeChange = (type: QuestionType) => {
    let options: string[] = [];
    let enOptions: string[] = [];
    if (type === "multiple_choice_4") { options = ["", "", "", ""]; enOptions = ["", "", "", ""]; }
    else if (type === "multiple_choice_5") { options = ["", "", "", "", ""]; enOptions = ["", "", "", "", ""]; }
    else if (type === "ox") { options = ["O", "X"]; enOptions = ["O", "X"]; }
    setQuestionForm(f => ({ ...f, question_type: type, options, en_options: enOptions, correct_answer: "", en_correct_answer: "", en_options_manual: false, en_correct_answer_manual: false }));
  };

  // Translate assessment
  const handleTranslateAssessment = async () => {
    const texts = [assessmentForm.title, assessmentForm.description].filter(Boolean);
    if (!texts.length) return;
    setTranslatingAssessment(true);
    try {
      const results = await translateKoToEn(texts);
      let idx = 0;
      if (assessmentForm.title) { setEnTitle(results[idx++] || ""); setEnTitleManual(true); }
      if (assessmentForm.description) { setEnDescription(results[idx++] || ""); setEnDescManual(true); }
    } catch { /* silent */ }
    finally { setTranslatingAssessment(false); }
  };

  // Translate question
  const handleTranslateQuestion = async () => {
    const texts: string[] = [];
    const fields: string[] = [];
    if (questionForm.question_text) { texts.push(questionForm.question_text); fields.push("question_text"); }
    if (questionForm.correct_answer && questionForm.question_type !== "ox") { texts.push(questionForm.correct_answer); fields.push("correct_answer"); }
    if (questionForm.explanation) { texts.push(questionForm.explanation); fields.push("explanation"); }
    if (questionForm.hint) { texts.push(questionForm.hint); fields.push("hint"); }
    // Options for MCQ (not OX)
    if (["multiple_choice_4", "multiple_choice_5"].includes(questionForm.question_type)) {
      questionForm.options.forEach((opt, i) => {
        if (opt.trim()) { texts.push(opt); fields.push(`option_${i}`); }
      });
    }
    if (!texts.length) return;
    setTranslatingQuestion(true);
    try {
      const results = await translateKoToEn(texts);
      const newEnOptions = [...questionForm.en_options];
      let idx = 0;
      const updates: Partial<QuestionForm> = {};
      for (const field of fields) {
        if (field === "question_text") { updates.en_question_text = results[idx]; updates.en_question_text_manual = true; }
        else if (field === "correct_answer") { updates.en_correct_answer = results[idx]; updates.en_correct_answer_manual = true; }
        else if (field === "explanation") { updates.en_explanation = results[idx]; updates.en_explanation_manual = true; }
        else if (field === "hint") { updates.en_hint = results[idx]; updates.en_hint_manual = true; }
        else if (field.startsWith("option_")) {
          const optIdx = parseInt(field.split("_")[1]);
          newEnOptions[optIdx] = results[idx] || "";
          updates.en_options_manual = true;
        }
        idx++;
      }
      updates.en_options = newEnOptions;
      setQuestionForm(f => ({ ...f, ...updates }));
    } catch { /* silent */ }
    finally { setTranslatingQuestion(false); }
  };

  const totalPoints = questions.reduce((s: number, q: any) => s + (q.points || 0), 0);

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
          {t("assessment.title")}
        </h2>
        <div className="flex items-center gap-2">
          {assessment && (
            <>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setShowResults(!showResults)}>
                <Users className="h-3 w-3" />
                {showResults ? (isEn ? "Questions" : "문항 관리") : (isEn ? "Results" : "결과 보기")}
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => togglePublishMutation.mutate()}>
                {assessment.is_published ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {assessment.is_published ? t("assessment.unpublishBtn") : t("assessment.publishBtn")}
              </Button>
            </>
          )}
          <Button size="sm" className="h-8 text-xs gap-1" onClick={openEditAssessment}>
            {assessment ? <Pencil className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {assessment ? t("assessment.editSettings") : t("assessment.create")}
          </Button>
        </div>
      </div>

      {/* Assessment content */}
      {!assessment ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center space-y-2">
          <ClipboardCheck className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("assessment.noAssessment")}</p>
          <Button variant="outline" size="sm" onClick={openEditAssessment} className="text-xs">
            {t("assessment.create")}
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="bg-secondary/30 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{assessment.title}</span>
                <Badge variant={assessment.is_published ? "default" : "secondary"} className="text-[10px] h-5">
                  {assessment.is_published ? t("assessment.publishedStatus") : t("assessment.draftStatus")}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t("assessment.passingScore")}: {assessment.passing_score}{t("common.points")} | {t("assessment.maxAttempts")}: {assessment.max_attempts}{isEn ? " times" : "회"} | {t("assessment.completionThreshold")}: {Number(assessment.completion_threshold)}% | {t("assessment.questionCount")}: {questions.length}{isEn ? "" : "문항"} ({totalPoints}{t("common.points")})
              </p>
            </div>
            {!showResults && (
              <div className="flex gap-2">
                {canUseAIGen && (
                  <AIQuestionGenerator
                    compact
                    // 풀 출제 모드에서는 평가에 직접 추가하지 않고 문제은행에 적재
                    assessmentId={
                      (assessment as any).selection_mode === "random_pool"
                        ? undefined
                        : assessment.id
                    }
                    courseId={courseId}
                    onSaved={() => {
                      queryClient.invalidateQueries({ queryKey: ["assessment", courseId] });
                      queryClient.invalidateQueries({ queryKey: ["question-bank"] });
                    }}
                  />
                )}
                {(assessment as any).selection_mode !== "random_pool" && (
                  <Button size="sm" className="h-8 text-xs gap-1" onClick={openAddQuestion}>
                    <Plus className="h-3 w-3" />
                    {t("assessment.addQuestion")}
                  </Button>
                )}
              </div>
            )}
          </div>

          {showResults ? (
            <div className="p-4">
              <AssessmentResults courseId={courseId} assessmentId={assessment.id} assessmentTitle={assessment.title} passingScore={assessment.passing_score} />
            </div>
          ) : (assessment as any).selection_mode === "random_pool" ? (
            <div className="p-4">
              <AssessmentPoolRules assessmentId={assessment.id} />
            </div>
          ) : (
            <>
              {questions.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">{t("assessment.noQuestions")}</div>
              ) : (
                <ol className="divide-y divide-border">
                  {questions.map((q: any, idx: number) => (
                    <li key={q.id} className="flex items-start gap-3 px-4 py-3 hover:bg-accent/20 transition-colors group">
                      <span className="mt-0.5 w-6 shrink-0 text-center font-mono text-xs text-muted-foreground">{idx + 1}</span>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[9px] h-4 shrink-0">
                            {isEn ? questionTypeLabels[q.question_type as QuestionType]?.en : questionTypeLabels[q.question_type as QuestionType]?.ko}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{q.points}{t("common.points")}</span>
                        </div>
                        <p className="text-sm text-foreground line-clamp-2">{q.question_text}</p>
                        {q.options && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(q.options as string[]).map((opt: string, i: number) => (
                              <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${opt === q.correct_answer ? "bg-emerald-500 text-white dark:bg-emerald-500 dark:text-white font-medium" : "bg-muted text-muted-foreground"}`}>
                                {opt || `(${i + 1})`}
                              </span>
                            ))}
                          </div>
                        )}
                        {!q.options && q.correct_answer && (
                          <p className="text-[10px] text-green-600 dark:text-green-400">{t("assessment.answer")}: {q.correct_answer}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button type="button" className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => openEditQuestion(q)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button type="button" className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("assessment.deleteQuestion")}</AlertDialogTitle>
                              <AlertDialogDescription>{t("assessment.deleteQuestionConfirm")}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteQuestionMutation.mutate(q.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                {t("common.delete")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </div>
      )}

      {/* Assessment Settings Dialog */}
      <Dialog open={assessmentDialogOpen} onOpenChange={setAssessmentDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">{assessment ? t("assessment.editSettings") : t("assessment.create")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Title */}
            <div className="space-y-1">
              <Label className="text-xs">{t("assessment.assessmentTitle")}</Label>
              <Input className="h-9 text-sm" value={assessmentForm.title} onChange={e => setAssessmentForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            {/* Description */}
            <div className="space-y-1">
              <Label className="text-xs">{t("assessment.description")}</Label>
              <Textarea className="text-sm" value={assessmentForm.description} onChange={e => setAssessmentForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>

            <Separator />


            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t("assessment.passingScore")}</Label>
                <Input className="h-9 text-sm" type="number" value={assessmentForm.passing_score} onChange={e => setAssessmentForm(f => ({ ...f, passing_score: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("assessment.maxAttempts")}</Label>
                <Input
                  className="h-9 text-sm"
                  type="number"
                  min={1}
                  max={99}
                  value={assessmentForm.max_attempts}
                  onChange={e => setAssessmentForm(f => ({ ...f, max_attempts: Math.max(1, Number(e.target.value) || 1) }))}
                />
                <p className="text-[10px] text-muted-foreground">
                  {isEn ? "Number of times a student may attempt this assessment." : "학습자가 평가에 응시할 수 있는 총 횟수입니다."}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t("assessment.timeLimit")}</Label>
                <Input className="h-9 text-sm" type="number" placeholder={isEn ? "No limit" : "제한 없음"} value={assessmentForm.time_limit_minutes ?? ""} onChange={e => setAssessmentForm(f => ({ ...f, time_limit_minutes: e.target.value ? Number(e.target.value) : null }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  {isEn ? "Unlock at progress (%)" : "응시 가능 진도율 (%)"}
                </Label>
                <Input
                  className="h-9 text-sm"
                  type="number"
                  min={0}
                  max={100}
                  value={assessmentForm.completion_threshold}
                  onChange={e => setAssessmentForm(f => ({ ...f, completion_threshold: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))}
                />
                <p className="text-[10px] text-muted-foreground">
                  {isEn
                    ? "Set 100 to require all lessons completed before the assessment unlocks."
                    : "100으로 설정하면 강의의 모든 차시를 완료해야 평가가 노출됩니다."}
                </p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-semibold">{t("assessment.requireForCompletion")}</Label>
                <p className="text-[10px] text-muted-foreground">{t("assessment.requireForCompletionDesc")}</p>
              </div>
              <Switch checked={assessmentForm.require_assessment_for_completion} onCheckedChange={v => setAssessmentForm(f => ({ ...f, require_assessment_for_completion: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-semibold">{t("assessment.randomize")}</Label>
                <p className="text-[10px] text-muted-foreground">{t("assessment.randomizeDesc")}</p>
              </div>
              <Switch checked={assessmentForm.randomize_questions} onCheckedChange={v => setAssessmentForm(f => ({ ...f, randomize_questions: v }))} />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label className="text-xs font-semibold">{isEn ? "Question Source" : "출제 방식"}</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAssessmentForm(f => ({ ...f, selection_mode: "fixed" }))}
                  className={`text-left p-3 rounded-lg border-2 transition-colors ${assessmentForm.selection_mode === "fixed" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                >
                  <p className="text-xs font-semibold">{isEn ? "Fixed Questions" : "고정 출제"}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{isEn ? "Use the questions added below directly." : "아래 등록한 문항을 그대로 출제"}</p>
                </button>
                <button
                  type="button"
                  onClick={() => setAssessmentForm(f => ({ ...f, selection_mode: "random_pool" }))}
                  className={`text-left p-3 rounded-lg border-2 transition-colors ${assessmentForm.selection_mode === "random_pool" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                >
                  <p className="text-xs font-semibold">{isEn ? "Random from Bank" : "문제은행 랜덤 출제"}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{isEn ? "Pull by difficulty / level rules." : "난이도·수준 조건으로 자동 추출"}</p>
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAssessmentDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button size="sm" onClick={() => upsertAssessmentMutation.mutate()} disabled={!assessmentForm.title.trim() || upsertAssessmentMutation.isPending}>
              {upsertAssessmentMutation.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Question Dialog */}
      <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">{editingQuestionId ? t("assessment.editQuestion") : t("assessment.addQuestion")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t("assessment.questionType")}</Label>
                <Select value={questionForm.question_type} onValueChange={(v) => handleTypeChange(v as QuestionType)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(questionTypeLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{isEn ? v.en : v.ko}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("assessment.pointsLabel")}</Label>
                <Input className="h-9 text-sm" type="number" value={questionForm.points} onChange={e => setQuestionForm(f => ({ ...f, points: Number(e.target.value) }))} />
              </div>
            </div>

            {/* KO & EN question text side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t("assessment.questionText")} (KO)</Label>
                <Textarea className="text-sm" value={questionForm.question_text} onChange={e => setQuestionForm(f => ({ ...f, question_text: e.target.value }))} rows={3} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t("assessment.questionText")} (EN)</Label>
                  <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={handleTranslateQuestion} disabled={translatingQuestion || !questionForm.question_text.trim()}>
                    {translatingQuestion ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Languages className="h-2.5 w-2.5" />}
                    {t("course.autoTranslate", "자동 번역")}
                  </Button>
                </div>
                <Textarea className="text-sm" value={questionForm.en_question_text} onChange={e => setQuestionForm(f => ({ ...f, en_question_text: e.target.value, en_question_text_manual: true }))} rows={3} />
              </div>
            </div>

            {/* Options for MCQ and OX */}
            {["multiple_choice_4", "multiple_choice_5", "ox"].includes(questionForm.question_type) && (
              <div className="space-y-2">
                <Label className="text-xs">{t("assessment.options")}</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground">KO</p>
                    {questionForm.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="radio" name="correct_answer" checked={questionForm.correct_answer === opt && opt !== ""} onChange={() => setQuestionForm(f => ({ ...f, correct_answer: opt }))} className="h-4 w-4 text-primary" />
                        {questionForm.question_type === "ox" ? (
                          <span className="text-sm font-medium">{opt}</span>
                        ) : (
                          <Input className="h-8 text-sm flex-1" value={opt} placeholder={`보기 ${i + 1}`}
                            onChange={e => {
                              const newOpts = [...questionForm.options];
                              const wasSelected = questionForm.correct_answer === newOpts[i];
                              newOpts[i] = e.target.value;
                              setQuestionForm(f => ({ ...f, options: newOpts, correct_answer: wasSelected ? e.target.value : f.correct_answer }));
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  {questionForm.question_type !== "ox" && (
                    <div className="space-y-2">
                      <p className="text-[10px] text-muted-foreground">EN</p>
                      {questionForm.en_options.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-4" />
                          <Input className="h-8 text-sm flex-1" value={opt} placeholder={`Option ${i + 1}`}
                            onChange={e => {
                              const newOpts = [...questionForm.en_options];
                              newOpts[i] = e.target.value;
                              setQuestionForm(f => ({ ...f, en_options: newOpts, en_options_manual: true }));
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">{t("assessment.selectCorrect")}</p>
              </div>
            )}

            {/* Short answer / essay correct answer */}
            {["short_answer", "essay"].includes(questionForm.question_type) && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t("assessment.correctAnswer")} (KO)</Label>
                  {questionForm.question_type === "short_answer" ? (
                    <Input className="h-9 text-sm" value={questionForm.correct_answer} onChange={e => setQuestionForm(f => ({ ...f, correct_answer: e.target.value }))} placeholder="정답 (일치하는 답)" />
                  ) : (
                    <Textarea className="text-sm" value={questionForm.correct_answer} onChange={e => setQuestionForm(f => ({ ...f, correct_answer: e.target.value }))} rows={2} placeholder="모범 답안 / 키워드" />
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("assessment.correctAnswer")} (EN)</Label>
                  {questionForm.question_type === "short_answer" ? (
                    <Input className="h-9 text-sm" value={questionForm.en_correct_answer} onChange={e => setQuestionForm(f => ({ ...f, en_correct_answer: e.target.value, en_correct_answer_manual: true }))} placeholder="Exact match answer" />
                  ) : (
                    <Textarea className="text-sm" value={questionForm.en_correct_answer} onChange={e => setQuestionForm(f => ({ ...f, en_correct_answer: e.target.value, en_correct_answer_manual: true }))} rows={2} placeholder="Model answer / keywords" />
                  )}
                </div>
              </div>
            )}

            {/* Explanation */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t("assessment.explanation")} (KO)</Label>
                <Textarea className="text-sm" value={questionForm.explanation} onChange={e => setQuestionForm(f => ({ ...f, explanation: e.target.value }))} rows={2} placeholder="채점 후 표시될 해설 (선택사항)" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("assessment.explanation")} (EN)</Label>
                <Textarea className="text-sm" value={questionForm.en_explanation} onChange={e => setQuestionForm(f => ({ ...f, en_explanation: e.target.value, en_explanation_manual: true }))} rows={2} placeholder="Explanation shown after grading (optional)" />
              </div>
            </div>

            {/* Hint */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{isEn ? "Hint" : "힌트"} (KO)</Label>
                <Textarea className="text-sm" value={questionForm.hint} onChange={e => setQuestionForm(f => ({ ...f, hint: e.target.value }))} rows={2} placeholder="시험 중 학생에게 보여줄 힌트 (선택사항)" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{isEn ? "Hint" : "힌트"} (EN)</Label>
                <Textarea className="text-sm" value={questionForm.en_hint} onChange={e => setQuestionForm(f => ({ ...f, en_hint: e.target.value, en_hint_manual: true }))} rows={2} placeholder="Hint shown to students during test (optional)" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setQuestionDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button size="sm" onClick={() => upsertQuestionMutation.mutate()} disabled={!questionForm.question_text.trim() || !questionForm.correct_answer.trim() || upsertQuestionMutation.isPending}>
              {upsertQuestionMutation.isPending ? t("common.saving") : editingQuestionId ? t("common.edit") : t("common.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
