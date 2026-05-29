import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { ClipboardList, CheckCircle2 } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { useFeatureModules } from "@/hooks/useFeatureModules";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

const PHASE_LABEL: Record<string, string> = { pre: "사전", post: "사후", general: "상시" };
const TARGET_LABEL: Record<string, string> = { program: "프로그램", project: "프로젝트", general: "공통" };

export default function StudentSurveys() {
  const { user } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { isEnabled, isLoading: modulesLoading } = useFeatureModules();
  const [taking, setTaking] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  const { data: surveys = [] } = useQuery({
    queryKey: ["student-ops-surveys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ops_surveys").select("*").eq("is_active", true).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: myResponses = [] } = useQuery({
    queryKey: ["student-ops-survey-responses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ops_survey_responses").select("survey_id").eq("respondent_id", user!.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const submittedIds = new Set(myResponses.map((r: any) => r.survey_id));

  const submit = useMutation({
    mutationFn: async () => {
      const required = (taking.questions || []).filter((q: any) => q.required);
      for (const q of required) {
        const a = answers[q.id];
        if (a === undefined || a === "" || (Array.isArray(a) && a.length === 0)) {
          throw new Error(`필수 문항을 응답해주세요: ${q.text}`);
        }
      }
      const npsQ = (taking.questions || []).find((q: any) => q.type === "nps");
      const { error } = await supabase.from("ops_survey_responses").insert({
        survey_id: taking.id,
        respondent_id: taking.is_anonymous ? null : user!.id,
        answers,
        nps_score: npsQ ? Number(answers[npsQ.id]) || null : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "응답이 제출되었습니다" });
      qc.invalidateQueries({ queryKey: ["student-ops-survey-responses"] });
      setTaking(null); setAnswers({});
    },
    onError: (e: any) => toast({ title: "제출 실패", description: e.message, variant: "destructive" }),
  });

  if (modulesLoading) return <DashboardLayout><p className="text-sm text-muted-foreground">로딩 중...</p></DashboardLayout>;
  if (!isEnabled("surveys_ops")) return <Navigate to="/student" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <ClipboardList className="h-6 w-6" /> 만족도 조사
          </h1>
          <p className="text-muted-foreground mt-1">참여 중인 프로그램/프로젝트의 만족도 설문에 응답해주세요.</p>
        </div>

        {surveys.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">진행 중인 설문이 없습니다.</CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {surveys.map((s: any) => {
              const done = submittedIds.has(s.id);
              return (
                <Card key={s.id} className="border-b-2 border-border/80">
                  <CardContent className="p-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1 mb-1">
                        <Badge variant="outline">{TARGET_LABEL[s.target_type]}</Badge>
                        <Badge variant="secondary">{PHASE_LABEL[s.phase]}</Badge>
                        {s.is_anonymous && <Badge variant="outline">익명</Badge>}
                        {done && <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />응답 완료</Badge>}
                      </div>
                      <div className="font-semibold">{s.title}</div>
                      {s.description && <p className="text-sm text-muted-foreground mt-1">{s.description}</p>}
                    </div>
                    <Button
                      onClick={() => { setTaking(s); setAnswers({}); }}
                      disabled={done && !s.is_anonymous}
                      variant={done ? "outline" : "default"}
                    >
                      {done ? "응답 보기" : "응답하기"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {taking && (
        <Dialog open onOpenChange={(v) => { if (!v) { setTaking(null); setAnswers({}); } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{taking.title}</DialogTitle>
              <DialogDescription>{taking.description || "아래 문항에 응답해주세요."}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {(taking.questions || []).map((q: any, idx: number) => (
                <Card key={q.id}>
                  <CardContent className="p-4 space-y-2">
                    <Label className="text-sm font-medium">
                      Q{idx + 1}. {q.text} {q.required && <span className="text-destructive">*</span>}
                    </Label>
                    {q.type === "rating" && (
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Button key={n} type="button" size="sm"
                            variant={answers[q.id] === n ? "default" : "outline"}
                            onClick={() => setAnswers((a) => ({ ...a, [q.id]: n }))}>{n}</Button>
                        ))}
                      </div>
                    )}
                    {q.type === "nps" && (
                      <div className="flex flex-wrap gap-1">
                        {Array.from({ length: 11 }, (_, n) => (
                          <Button key={n} type="button" size="sm"
                            variant={answers[q.id] === n ? "default" : "outline"}
                            onClick={() => setAnswers((a) => ({ ...a, [q.id]: n }))}>{n}</Button>
                        ))}
                      </div>
                    )}
                    {q.type === "single" && (
                      <div className="space-y-1">
                        {(q.options || []).map((opt: string) => (
                          <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="radio" name={q.id} checked={answers[q.id] === opt}
                              onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))} />
                            {opt}
                          </label>
                        ))}
                      </div>
                    )}
                    {q.type === "multi" && (
                      <div className="space-y-1">
                        {(q.options || []).map((opt: string) => {
                          const arr: string[] = answers[q.id] || [];
                          const checked = arr.includes(opt);
                          return (
                            <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                              <Checkbox checked={checked}
                                onCheckedChange={(v) => setAnswers((a) => ({
                                  ...a,
                                  [q.id]: v ? [...arr, opt] : arr.filter((x) => x !== opt),
                                }))} />
                              {opt}
                            </label>
                          );
                        })}
                      </div>
                    )}
                    {q.type === "text" && (
                      <Textarea value={answers[q.id] || ""} rows={3}
                        onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setTaking(null); setAnswers({}); }}>취소</Button>
              <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
                {submit.isPending ? "제출 중..." : "응답 제출"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}