import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Library, Plus, Pencil, Trash2, Search, Filter, X, Upload } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import QuestionBankBulkUpload from "@/components/QuestionBankBulkUpload";
import AIQuestionGenerator from "@/components/admin/AIQuestionGenerator";

type Difficulty = "easy" | "medium" | "hard";
type Level = "beginner" | "intermediate" | "advanced";
type QType = "multiple_choice_4" | "multiple_choice_5" | "short_answer" | "essay" | "ox";

interface FormState {
  course_id: string | null;
  category_id: string | null;
  tags: string;
  difficulty: Difficulty;
  learner_level: Level;
  question_type: QType;
  question_text: string;
  options: string[];
  correct_answer: string;
  points: number;
  explanation: string;
  hint: string;
  is_active: boolean;
}

const emptyForm: FormState = {
  course_id: null,
  category_id: null,
  tags: "",
  difficulty: "medium",
  learner_level: "intermediate",
  question_type: "multiple_choice_4",
  question_text: "",
  options: ["", "", "", ""],
  correct_answer: "",
  points: 10,
  explanation: "",
  hint: "",
  is_active: true,
};

const diffLabel = (d: Difficulty, isEn: boolean) =>
  ({ easy: isEn ? "Easy" : "쉬움", medium: isEn ? "Medium" : "보통", hard: isEn ? "Hard" : "어려움" }[d]);
const levelLabel = (l: Level, isEn: boolean) =>
  ({ beginner: isEn ? "Beginner" : "입문", intermediate: isEn ? "Intermediate" : "중급", advanced: isEn ? "Advanced" : "고급" }[l]);
const qtypeLabel = (q: QType, isEn: boolean) =>
  ({ multiple_choice_4: isEn ? "4 Choices" : "4지선다", multiple_choice_5: isEn ? "5 Choices" : "5지선다", short_answer: isEn ? "Short" : "단답형", essay: isEn ? "Essay" : "서술형", ox: isEn ? "True/False" : "OX" }[q]);

const diffBadge = (d: Difficulty) =>
  ({ easy: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200", medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200", hard: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200" }[d]);

export default function AdminQuestionBank() {
  const { user } = useUser();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterDiff, setFilterDiff] = useState<string>("all");
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [filterScope, setFilterScope] = useState<string>("all"); // all|global|course
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  // Categories
  const { data: categories = [] } = useQuery({
    queryKey: ["qbank-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("question_bank_categories" as any).select("*").order("display_order");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Courses (for scope filter / form)
  const { data: courses = [] } = useQuery({
    queryKey: ["qbank-courses-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("id,title").order("title");
      if (error) throw error;
      return data || [];
    },
  });

  // Questions
  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["question-bank", filterDiff, filterLevel, filterScope, filterCategory],
    queryFn: async () => {
      let q: any = supabase.from("question_bank" as any).select("*").order("created_at", { ascending: false });
      if (filterDiff !== "all") q = q.eq("difficulty", filterDiff);
      if (filterLevel !== "all") q = q.eq("learner_level", filterLevel);
      if (filterCategory !== "all") q = q.eq("category_id", filterCategory);
      if (filterScope === "global") q = q.is("course_id", null);
      if (filterScope === "course") q = q.not("course_id", "is", null);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return questions;
    const s = search.toLowerCase();
    return questions.filter((q) => q.question_text?.toLowerCase().includes(s) || q.tags?.some((t: string) => t.toLowerCase().includes(s)));
  }, [questions, search]);

  const courseMap = useMemo(() => Object.fromEntries(courses.map((c: any) => [c.id, c.title])), [courses]);
  const categoryMap = useMemo(() => Object.fromEntries(categories.map((c: any) => [c.id, isEn ? c.name_en || c.name : c.name])), [categories, isEn]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        course_id: form.course_id || null,
        category_id: form.category_id || null,
        tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean),
        difficulty: form.difficulty,
        learner_level: form.learner_level,
        question_type: form.question_type,
        question_text: form.question_text,
        options: ["multiple_choice_4", "multiple_choice_5", "ox"].includes(form.question_type) ? form.options : null,
        correct_answer: form.correct_answer,
        points: form.points,
        explanation: form.explanation || null,
        hint: form.hint || null,
        is_active: form.is_active,
      };
      if (editingId) {
        const { error } = await supabase.from("question_bank" as any).update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        payload.created_by = user!.id;
        const { error } = await supabase.from("question_bank" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["question-bank"] });
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast({ title: editingId ? (isEn ? "Question updated" : "문항 수정 완료") : (isEn ? "Question added" : "문항 추가 완료") });
    },
    onError: (e: any) => toast({ title: t("common.error", "오류"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("question_bank" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["question-bank"] });
      toast({ title: isEn ? "Deleted" : "삭제 완료" });
    },
    onError: (e: any) => toast({ title: t("common.error", "오류"), description: e.message, variant: "destructive" }),
  });

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (q: any) => {
    setEditingId(q.id);
    const opts = q.options || [];
    setForm({
      course_id: q.course_id,
      category_id: q.category_id,
      tags: (q.tags || []).join(", "),
      difficulty: q.difficulty,
      learner_level: q.learner_level,
      question_type: q.question_type,
      question_text: q.question_text,
      options:
        q.question_type === "multiple_choice_5"
          ? [...opts, ...Array(Math.max(0, 5 - opts.length)).fill("")]
          : q.question_type === "multiple_choice_4"
          ? [...opts, ...Array(Math.max(0, 4 - opts.length)).fill("")]
          : q.question_type === "ox"
          ? ["O", "X"]
          : [],
      correct_answer: q.correct_answer,
      points: q.points,
      explanation: q.explanation || "",
      hint: q.hint || "",
      is_active: q.is_active,
    });
    setDialogOpen(true);
  };

  const handleTypeChange = (type: QType) => {
    let options: string[] = [];
    if (type === "multiple_choice_4") options = ["", "", "", ""];
    else if (type === "multiple_choice_5") options = ["", "", "", "", ""];
    else if (type === "ox") options = ["O", "X"];
    setForm((f) => ({ ...f, question_type: type, options, correct_answer: "" }));
  };

  const isChoice = ["multiple_choice_4", "multiple_choice_5", "ox"].includes(form.question_type);

  return (
    <DashboardLayout>
      <div className="space-y-6 min-w-0">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Library className="h-7 w-7 text-foreground mt-1" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              {isEn ? "Question Bank" : "문제은행 관리"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isEn
                ? "Manage questions by difficulty, learner level, and category. Used for randomized assessments."
                : "난이도·수준·카테고리별로 문항을 관리합니다. 평가 생성 시 조건에 맞춰 자동 출제됩니다."}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <AIQuestionGenerator compact onSaved={() => qc.invalidateQueries({ queryKey: ["question-bank"] })} />
            <Button variant="outline" onClick={() => setBulkOpen(true)}>
              <Upload className="h-4 w-4 mr-1" /> {isEn ? "Bulk Upload" : "엑셀 업로드"}
            </Button>
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" /> {isEn ? "New Question" : "문항 추가"}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center border-b-2 border-border/80 pb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isEn ? "Search question or tag..." : "문항/태그 검색..."} className="pl-9" />
          </div>
          <Select value={filterDiff} onValueChange={setFilterDiff}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isEn ? "All difficulty" : "전체 난이도"}</SelectItem>
              <SelectItem value="easy">{diffLabel("easy", isEn)}</SelectItem>
              <SelectItem value="medium">{diffLabel("medium", isEn)}</SelectItem>
              <SelectItem value="hard">{diffLabel("hard", isEn)}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterLevel} onValueChange={setFilterLevel}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isEn ? "All level" : "전체 수준"}</SelectItem>
              <SelectItem value="beginner">{levelLabel("beginner", isEn)}</SelectItem>
              <SelectItem value="intermediate">{levelLabel("intermediate", isEn)}</SelectItem>
              <SelectItem value="advanced">{levelLabel("advanced", isEn)}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterScope} onValueChange={setFilterScope}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isEn ? "All scope" : "전체 범위"}</SelectItem>
              <SelectItem value="global">{isEn ? "Global pool" : "전역 공용"}</SelectItem>
              <SelectItem value="course">{isEn ? "Course-bound" : "강의별"}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isEn ? "All categories" : "전체 카테고리"}</SelectItem>
              {categories.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{isEn ? c.name_en || c.name : c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        <div className="text-sm text-muted-foreground">
          {isLoading
            ? (isEn ? "Loading..." : "불러오는 중...")
            : (isEn ? `${filtered.length} questions` : `총 ${filtered.length}문항`)}
        </div>
        <div className="space-y-0 border-t-2 border-border/80">
          {filtered.map((q) => (
            <div key={q.id} className="border-b-2 border-border/80 py-4 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 min-w-0">
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-sm sm:text-base leading-relaxed line-clamp-2">{q.question_text}</p>
                <div className="flex flex-wrap gap-1.5 items-center">
                  <Badge variant="outline" className={`${diffBadge(q.difficulty)} border-0 whitespace-nowrap`}>{diffLabel(q.difficulty, isEn)}</Badge>
                  <Badge variant="secondary" className="whitespace-nowrap">{levelLabel(q.learner_level, isEn)}</Badge>
                  <Badge variant="outline" className="whitespace-nowrap">{qtypeLabel(q.question_type, isEn)}</Badge>
                  <Badge variant="outline" className="whitespace-nowrap">{q.points}{isEn ? "pt" : "점"}</Badge>
                  {q.category_id && categoryMap[q.category_id] && (
                    <Badge variant="outline" className="whitespace-nowrap">{categoryMap[q.category_id]}</Badge>
                  )}
                  <Badge variant="outline" className="whitespace-nowrap">
                    {q.course_id ? (isEn ? "Course: " : "강의: ") + (courseMap[q.course_id] || "—") : (isEn ? "Global" : "전역 공용")}
                  </Badge>
                  {!q.is_active && <Badge variant="destructive" className="whitespace-nowrap">{isEn ? "Inactive" : "비활성"}</Badge>}
                  {(q.tags || []).map((t: string) => <span key={t} className="text-xs text-muted-foreground">#{t}</span>)}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => openEdit(q)}><Pencil className="h-4 w-4" /></Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{isEn ? "Delete question?" : "문항을 삭제할까요?"}</AlertDialogTitle>
                      <AlertDialogDescription>{isEn ? "This cannot be undone." : "되돌릴 수 없습니다."}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel", "취소")}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteMutation.mutate(q.id)}>{t("common.delete", "삭제")}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
          {!isLoading && filtered.length === 0 && (
            <div className="py-16 text-center text-muted-foreground text-sm">
              {isEn ? "No questions yet. Click 'New Question' to add one." : "등록된 문항이 없습니다. ‘문항 추가’를 눌러 시작하세요."}
            </div>
          )}
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? (isEn ? "Edit Question" : "문항 수정") : (isEn ? "New Question" : "문항 추가")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Scope */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{isEn ? "Scope" : "범위"}</Label>
                <Select value={form.course_id || "global"} onValueChange={(v) => setForm((f) => ({ ...f, course_id: v === "global" ? null : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">{isEn ? "Global (all courses)" : "전역 공용"}</SelectItem>
                    {courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{isEn ? "Category" : "카테고리"}</Label>
                <Select value={form.category_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, category_id: v === "none" ? null : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{isEn ? "(None)" : "(없음)"}</SelectItem>
                    {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{isEn ? c.name_en || c.name : c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Meta */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>{isEn ? "Difficulty" : "난이도"}</Label>
                <Select value={form.difficulty} onValueChange={(v: Difficulty) => setForm((f) => ({ ...f, difficulty: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">{diffLabel("easy", isEn)}</SelectItem>
                    <SelectItem value="medium">{diffLabel("medium", isEn)}</SelectItem>
                    <SelectItem value="hard">{diffLabel("hard", isEn)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{isEn ? "Learner Level" : "학습자 수준"}</Label>
                <Select value={form.learner_level} onValueChange={(v: Level) => setForm((f) => ({ ...f, learner_level: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">{levelLabel("beginner", isEn)}</SelectItem>
                    <SelectItem value="intermediate">{levelLabel("intermediate", isEn)}</SelectItem>
                    <SelectItem value="advanced">{levelLabel("advanced", isEn)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{isEn ? "Type" : "유형"}</Label>
                <Select value={form.question_type} onValueChange={(v: QType) => handleTypeChange(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice_4">{qtypeLabel("multiple_choice_4", isEn)}</SelectItem>
                    <SelectItem value="multiple_choice_5">{qtypeLabel("multiple_choice_5", isEn)}</SelectItem>
                    <SelectItem value="ox">{qtypeLabel("ox", isEn)}</SelectItem>
                    <SelectItem value="short_answer">{qtypeLabel("short_answer", isEn)}</SelectItem>
                    <SelectItem value="essay">{qtypeLabel("essay", isEn)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>{isEn ? "Question" : "문항"}</Label>
              <Textarea value={form.question_text} onChange={(e) => setForm((f) => ({ ...f, question_text: e.target.value }))} rows={3} />
            </div>

            {isChoice && (
              <div className="space-y-2">
                <Label>{isEn ? "Options" : "보기"}</Label>
                {form.options.map((opt, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className="text-xs w-6 text-muted-foreground">{String.fromCharCode(65 + i)}.</span>
                    <Input
                      value={opt}
                      onChange={(e) => {
                        const next = [...form.options];
                        next[i] = e.target.value;
                        setForm((f) => ({ ...f, options: next }));
                      }}
                      disabled={form.question_type === "ox"}
                    />
                    <Switch
                      checked={form.correct_answer === opt && opt !== ""}
                      onCheckedChange={(checked) => checked && setForm((f) => ({ ...f, correct_answer: opt }))}
                    />
                    <span className="text-xs text-muted-foreground w-10">{isEn ? "Correct" : "정답"}</span>
                  </div>
                ))}
              </div>
            )}

            {!isChoice && (
              <div>
                <Label>{isEn ? "Correct Answer / Sample" : "정답 / 모범답안"}</Label>
                <Textarea value={form.correct_answer} onChange={(e) => setForm((f) => ({ ...f, correct_answer: e.target.value }))} rows={2} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{isEn ? "Points" : "배점"}</Label>
                <Input type="number" value={form.points} onChange={(e) => setForm((f) => ({ ...f, points: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>{isEn ? "Tags (comma-separated)" : "태그 (쉼표 구분)"}</Label>
                <Input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder={isEn ? "safety, basic" : "안전, 기초"} />
              </div>
            </div>

            <div>
              <Label>{isEn ? "Hint" : "힌트"}</Label>
              <Input value={form.hint} onChange={(e) => setForm((f) => ({ ...f, hint: e.target.value }))} />
            </div>

            <div>
              <Label>{isEn ? "Explanation" : "해설"}</Label>
              <Textarea value={form.explanation} onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))} rows={2} />
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
              <Label>{isEn ? "Active (available for assessments)" : "활성 (평가 출제 대상)"}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel", "취소")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.question_text.trim() || saveMutation.isPending}>
              {t("common.save", "저장")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuestionBankBulkUpload
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        isEn={isEn}
        courses={courses as any}
        categories={categories as any}
      />
    </DashboardLayout>
  );
}