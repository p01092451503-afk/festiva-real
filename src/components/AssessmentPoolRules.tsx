import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface RuleForm {
  difficulty: string;
  learner_level: string;
  category_id: string;
  tag: string;
  include_global: boolean;
  include_course: boolean;
  question_count: number;
}

const empty: RuleForm = {
  difficulty: "any",
  learner_level: "any",
  category_id: "any",
  tag: "",
  include_global: true,
  include_course: true,
  question_count: 5,
};

export default function AssessmentPoolRules({ assessmentId }: { assessmentId: string }) {
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const qc = useQueryClient();
  const [draft, setDraft] = useState<RuleForm>(empty);

  const { data: rules = [] } = useQuery({
    queryKey: ["pool-rules", assessmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_pool_rules" as any)
        .select("*")
        .eq("assessment_id", assessmentId)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["qbank-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("question_bank_categories" as any).select("*").order("display_order");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const addRule = useMutation({
    mutationFn: async () => {
      const payload: any = {
        assessment_id: assessmentId,
        difficulty: draft.difficulty === "any" ? null : draft.difficulty,
        learner_level: draft.learner_level === "any" ? null : draft.learner_level,
        category_id: draft.category_id === "any" ? null : draft.category_id,
        tag: draft.tag.trim() || null,
        include_global: draft.include_global,
        include_course: draft.include_course,
        question_count: draft.question_count,
        sort_order: rules.length,
      };
      const { error } = await supabase.from("assessment_pool_rules" as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pool-rules", assessmentId] });
      setDraft(empty);
      toast({ title: isEn ? "Rule added" : "출제 규칙 추가됨" });
    },
    onError: (e: any) => toast({ title: t("common.error", "오류"), description: e.message, variant: "destructive" }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assessment_pool_rules" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pool-rules", assessmentId] }),
  });

  const totalQuestions = rules.reduce((s, r) => s + (r.question_count || 0), 0);
  const catMap = Object.fromEntries(categories.map((c: any) => [c.id, isEn ? c.name_en || c.name : c.name]));

  const labelDiff = (d: string | null) =>
    !d ? (isEn ? "Any difficulty" : "전체 난이도") : { easy: isEn ? "Easy" : "쉬움", medium: isEn ? "Medium" : "보통", hard: isEn ? "Hard" : "어려움" }[d];
  const labelLevel = (l: string | null) =>
    !l ? (isEn ? "Any level" : "전체 수준") : { beginner: isEn ? "Beginner" : "입문", intermediate: isEn ? "Intermediate" : "중급", advanced: isEn ? "Advanced" : "고급" }[l];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="bg-secondary/30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-foreground" />
          <span className="text-sm font-semibold">{isEn ? "Random Pool Rules" : "풀 출제 규칙"}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {isEn ? `Total: ${totalQuestions} questions per attempt` : `응시당 총 ${totalQuestions}문항`}
        </span>
      </div>

      {rules.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-muted-foreground">
          {isEn
            ? "No rules yet. Add a rule to pull questions from the bank by difficulty / level."
            : "출제 규칙이 없습니다. 난이도·수준 조건으로 문제은행에서 문항을 추출합니다."}
        </div>
      ) : (
        <ol className="divide-y divide-border">
          {rules.map((r, idx) => (
            <li key={r.id} className="px-4 py-3 flex items-center justify-between gap-3 min-w-0">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-xs font-mono text-muted-foreground">#{idx + 1}</span>
                  <Badge variant="outline" className="text-[10px] whitespace-nowrap">{labelDiff(r.difficulty)}</Badge>
                  <Badge variant="secondary" className="text-[10px] whitespace-nowrap">{labelLevel(r.learner_level)}</Badge>
                  {r.category_id && <Badge variant="outline" className="text-[10px] whitespace-nowrap">{catMap[r.category_id] || "—"}</Badge>}
                  {r.tag && <span className="text-[10px] text-muted-foreground">#{r.tag}</span>}
                  <Badge className="text-[10px] whitespace-nowrap">{r.question_count}{isEn ? " Q" : "문항"}</Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {[r.include_course && (isEn ? "course" : "강의"), r.include_global && (isEn ? "global" : "전역")].filter(Boolean).join(" + ")}
                  </span>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => deleteRule.mutate(r.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </li>
          ))}
        </ol>
      )}

      {/* Add new rule */}
      <div className="border-t border-border p-4 space-y-3 bg-muted/20">
        <p className="text-xs font-semibold text-muted-foreground">{isEn ? "Add Rule" : "규칙 추가"}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <Label className="text-[10px]">{isEn ? "Difficulty" : "난이도"}</Label>
            <Select value={draft.difficulty} onValueChange={(v) => setDraft((d) => ({ ...d, difficulty: v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{isEn ? "Any" : "전체"}</SelectItem>
                <SelectItem value="easy">{isEn ? "Easy" : "쉬움"}</SelectItem>
                <SelectItem value="medium">{isEn ? "Medium" : "보통"}</SelectItem>
                <SelectItem value="hard">{isEn ? "Hard" : "어려움"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">{isEn ? "Level" : "수준"}</Label>
            <Select value={draft.learner_level} onValueChange={(v) => setDraft((d) => ({ ...d, learner_level: v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{isEn ? "Any" : "전체"}</SelectItem>
                <SelectItem value="beginner">{isEn ? "Beginner" : "입문"}</SelectItem>
                <SelectItem value="intermediate">{isEn ? "Intermediate" : "중급"}</SelectItem>
                <SelectItem value="advanced">{isEn ? "Advanced" : "고급"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">{isEn ? "Category" : "카테고리"}</Label>
            <Select value={draft.category_id} onValueChange={(v) => setDraft((d) => ({ ...d, category_id: v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{isEn ? "Any" : "전체"}</SelectItem>
                {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{isEn ? c.name_en || c.name : c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">{isEn ? "Count" : "문항 수"}</Label>
            <Input type="number" min={1} className="h-8 text-xs" value={draft.question_count} onChange={(e) => setDraft((d) => ({ ...d, question_count: Math.max(1, parseInt(e.target.value) || 1) }))} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <Switch checked={draft.include_course} onCheckedChange={(v) => setDraft((d) => ({ ...d, include_course: v }))} />
            <span>{isEn ? "Course pool" : "강의 풀"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Switch checked={draft.include_global} onCheckedChange={(v) => setDraft((d) => ({ ...d, include_global: v }))} />
            <span>{isEn ? "Global pool" : "전역 풀"}</span>
          </div>
          <Input className="h-8 text-xs flex-1 min-w-[120px]" placeholder={isEn ? "Tag (optional)" : "태그 (선택)"} value={draft.tag} onChange={(e) => setDraft((d) => ({ ...d, tag: e.target.value }))} />
          <Button size="sm" className="h-8 text-xs gap-1" onClick={() => addRule.mutate()} disabled={addRule.isPending || (!draft.include_course && !draft.include_global)}>
            <Plus className="h-3 w-3" />
            {isEn ? "Add" : "추가"}
          </Button>
        </div>
      </div>
    </div>
  );
}