import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, CheckCircle2, Star } from "lucide-react";
import { useTranslatedLabel } from "@/hooks/useTranslatedLabel";

interface StudentSurveyProps {
  courseId: string;
}

// Inline helper so each translated string gets its own hook instance
const TLabel = ({ text }: { text: string }) => {
  const v = useTranslatedLabel(text);
  return <>{v || text}</>;
};

const StudentSurvey = ({ courseId }: StudentSurveyProps) => {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const [answers, setAnswers] = useState<Record<string, { text?: string; value?: number }>>({});

  const { data: survey } = useQuery({
    queryKey: ["course-survey", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("surveys")
        .select("*")
        .eq("course_id", courseId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  const { data: questions = [] } = useQuery({
    queryKey: ["survey-questions", survey?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_questions")
        .select("*")
        .eq("survey_id", survey!.id)
        .order("order_index");
      if (error) throw error;
      return data;
    },
    enabled: !!survey?.id,
  });

  const { data: existingResponse } = useQuery({
    queryKey: ["survey-response", survey?.id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_responses")
        .select("id")
        .eq("survey_id", survey!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!survey?.id && !!user?.id,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      // Validate required questions
      for (const q of questions) {
        if (q.is_required) {
          const ans = answers[q.id];
          if (!ans || (!ans.text && !ans.value)) {
            throw new Error(`필수 질문에 답해주세요: ${q.question_text}`);
          }
        }
      }

      // Create response
      const { data: response, error: rErr } = await supabase
        .from("survey_responses")
        .insert({ survey_id: survey!.id, user_id: user!.id })
        .select("id")
        .single();
      if (rErr) throw rErr;

      // Create answers
      const answerRows = questions.map((q: any) => ({
        response_id: response.id,
        question_id: q.id,
        answer_text: answers[q.id]?.text || null,
        answer_value: answers[q.id]?.value || null,
      }));

      const { error: aErr } = await supabase.from("survey_answers").insert(answerRows);
      if (aErr) throw aErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["survey-response"] });
      toast({ title: "설문이 제출되었습니다. 감사합니다!" });
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  if (!survey || questions.length === 0) return null;

  if (existingResponse) {
    return (
      <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
        <CardContent className="flex items-center gap-3 py-4">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-700 dark:text-green-300">
            {isEn ? "You have already submitted this survey." : "설문에 이미 응답하셨습니다."}
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ClipboardList className="h-5 w-5" /> <TLabel text={survey.title} />
        </CardTitle>
        {survey.description && (
          <p className="text-sm text-muted-foreground"><TLabel text={survey.description} /></p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {questions.map((q: any, i: number) => (
          <div key={q.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {i + 1}. <TLabel text={q.question_text} />
              </span>
              {q.is_required && (
                <Badge variant="destructive" className="text-[10px] h-4">
                  {isEn ? "Required" : "필수"}
                </Badge>
              )}
            </div>

            {q.question_type === "multiple_choice" && (
              <RadioGroup
                value={answers[q.id]?.text || ""}
                onValueChange={v => setAnswers(prev => ({ ...prev, [q.id]: { text: v } }))}
              >
                {((q.options as string[]) || []).map((opt: string, oi: number) => (
                  <div key={oi} className="flex items-center space-x-2">
                    <RadioGroupItem value={opt} id={`${q.id}-${oi}`} />
                    <Label htmlFor={`${q.id}-${oi}`} className="text-sm"><TLabel text={opt} /></Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {q.question_type === "text" && (
              <Textarea
                value={answers[q.id]?.text || ""}
                onChange={e => setAnswers(prev => ({ ...prev, [q.id]: { text: e.target.value } }))}
                placeholder={isEn ? "Enter your answer" : "답변을 입력하세요"}
                rows={3}
              />
            )}

            {q.question_type === "rating" && (
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAnswers(prev => ({ ...prev, [q.id]: { value: v } }))}
                    className="p-1 transition-colors"
                  >
                    <Star
                      className={`h-7 w-7 ${(answers[q.id]?.value || 0) >= v ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending} className="w-full">
          {submitMutation.isPending
            ? (isEn ? "Submitting..." : "제출 중...")
            : (isEn ? "Submit Survey" : "설문 제출")}
        </Button>
      </CardContent>
    </Card>
  );
};

export default StudentSurvey;
