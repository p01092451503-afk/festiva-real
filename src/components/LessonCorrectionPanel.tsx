import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Mic,
  MicOff,
  Loader2,
  Send,
  AlertCircle,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Issue {
  type: string;
  original: string;
  suggestion: string;
  explanation: string;
}

interface Correction {
  id: string;
  student_answer: string;
  corrected_text: string;
  score: number | null;
  issues: Issue[];
  suggestions: string[];
  overall_feedback: string | null;
  input_mode: string;
  created_at: string;
}

interface Props {
  contentId: string;
}

const ANSWER_MAX = 4000;

export const LessonCorrectionPanel = ({ contentId }: Props) => {
  const { user } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [answer, setAnswer] = useState("");
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recogRef = useRef<any>(null);
  const baseTextRef = useRef("");

  const speechSupported =
    typeof window !== "undefined" &&
    (("SpeechRecognition" in window) || ("webkitSpeechRecognition" in window));

  // History
  const { data: history = [] } = useQuery({
    queryKey: ["lesson-corrections", user?.id, contentId],
    queryFn: async () => {
      if (!user?.id) return [] as Correction[];
      const { data, error } = await supabase
        .from("lesson_corrections")
        .select("*")
        .eq("user_id", user.id)
        .eq("content_id", contentId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return ((data ?? []) as unknown) as Correction[];
    },
    enabled: !!user?.id && !!contentId,
    staleTime: 60_000,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("lecture-correction", {
        body: {
          content_id: contentId,
          student_answer: answer,
          input_mode: listening || baseTextRef.current ? "voice" : "text",
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as Correction;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lesson-corrections", user?.id, contentId] });
      setAnswer("");
      baseTextRef.current = "";
      setInterim("");
      toast({ title: "AI 첨삭이 완료되었습니다." });
    },
    onError: (e: any) => {
      toast({
        title: "첨삭 실패",
        description: e?.message || "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lesson_corrections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lesson-corrections", user?.id, contentId] });
    },
  });

  // Speech recognition lifecycle
  const startListening = async () => {
    if (!speechSupported) {
      toast({
        title: "음성 인식을 지원하지 않는 브라우저",
        description: "Chrome 등 최신 브라우저에서 사용해주세요.",
        variant: "destructive",
      });
      return;
    }
    try {
      // Trigger mic permission early.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      toast({
        title: "마이크 권한이 필요합니다",
        description: "브라우저 설정에서 마이크를 허용해주세요.",
        variant: "destructive",
      });
      return;
    }
    const SR: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recog = new SR();
    recog.lang = "ko-KR";
    recog.continuous = true;
    recog.interimResults = true;
    baseTextRef.current = answer ? answer + (answer.endsWith(" ") ? "" : " ") : "";
    recog.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (finalText) {
        baseTextRef.current = (baseTextRef.current + finalText).slice(0, ANSWER_MAX);
      }
      const merged = (baseTextRef.current + interimText).slice(0, ANSWER_MAX);
      setInterim(interimText);
      setAnswer(merged);
    };
    recog.onerror = (e: any) => {
      console.error("Speech error:", e?.error);
      setListening(false);
      if (e?.error === "not-allowed") {
        toast({
          title: "마이크 권한이 거부되었습니다",
          variant: "destructive",
        });
      }
    };
    recog.onend = () => {
      setListening(false);
      setInterim("");
    };
    recog.start();
    recogRef.current = recog;
    setListening(true);
  };

  const stopListening = () => {
    try {
      recogRef.current?.stop();
    } catch { /* noop */ }
    setListening(false);
  };

  useEffect(() => () => {
    try { recogRef.current?.abort?.(); } catch { /* noop */ }
  }, []);

  const canSubmit = answer.trim().length > 0 && !submitMutation.isPending && !listening;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground flex items-start gap-2">
        <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
        <p>
          강의 내용을 듣고, 배운 내용을 한국어로 직접 말하거나 입력해보세요. AI가 강의 자막(전사문)을
          근거로 문법·표현·내용 반영도를 첨삭해 드립니다. 더 정확한 피드백을 받으려면 먼저 <strong>AI 요약</strong>을 한 번 실행해 자막을 분석해두세요.
        </p>
      </div>

      <div className="space-y-2">
        <Textarea
          value={answer}
          onChange={(e) => {
            const v = e.target.value.slice(0, ANSWER_MAX);
            setAnswer(v);
            baseTextRef.current = v;
          }}
          placeholder="배운 내용을 요약하거나 핵심 표현을 한국어로 작성해보세요. 마이크 버튼으로 말하기 입력도 가능합니다."
          className="min-h-[140px] resize-y text-sm leading-relaxed"
          disabled={submitMutation.isPending}
        />
        {interim && (
          <p className="text-xs text-muted-foreground italic">인식 중… {interim}</p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {listening ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={stopListening}
                className="gap-1.5"
              >
                <MicOff className="h-3.5 w-3.5" />
                녹음 중지
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={startListening}
                disabled={submitMutation.isPending || !speechSupported}
                className="gap-1.5"
                title={!speechSupported ? "이 브라우저는 음성 인식을 지원하지 않습니다" : "음성으로 답안 작성"}
              >
                <Mic className="h-3.5 w-3.5" />
                {speechSupported ? "음성으로 말하기" : "음성 미지원"}
              </Button>
            )}
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {answer.length} / {ANSWER_MAX}
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => submitMutation.mutate()}
            disabled={!canSubmit}
            className="gap-1.5"
          >
            {submitMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            AI 첨삭 받기
          </Button>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border/70 rounded-lg">
          아직 첨삭 기록이 없습니다. 첫 답안을 작성하고 AI 첨삭을 받아보세요.
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((h) => (
            <CorrectionCard
              key={h.id}
              correction={h}
              onDelete={() => deleteMutation.mutate(h.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const CorrectionCard = ({
  correction,
  onDelete,
}: {
  correction: Correction;
  onDelete: () => void;
}) => {
  const created = new Date(correction.created_at).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const score = correction.score ?? 0;
  const scoreColor =
    score >= 80
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
      : score >= 60
        ? "bg-amber-500/10 text-amber-600 dark:text-amber-300"
        : "bg-rose-500/10 text-rose-600 dark:text-rose-300";

  return (
    <article className="rounded-xl border border-border bg-card p-4 space-y-3">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={cn("whitespace-nowrap tabular-nums", scoreColor)}>
            점수 {score}
          </Badge>
          <Badge variant="outline" className="whitespace-nowrap text-[10px]">
            {correction.input_mode === "voice" ? "음성" : "텍스트"}
          </Badge>
          <span className="text-[11px] text-muted-foreground">{created}</span>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          aria-label="첨삭 기록 삭제"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-md bg-muted/40 p-3 space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground">내 답안</p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {correction.student_answer}
          </p>
        </div>
        <div className="rounded-md bg-emerald-500/5 border border-emerald-500/20 p-3 space-y-1">
          <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> 첨삭 결과
          </p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {correction.corrected_text}
          </p>
        </div>
      </div>

      {correction.issues?.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground">주요 첨삭 포인트</p>
          <ul className="space-y-1.5">
            {correction.issues.map((iss, idx) => (
              <li
                key={idx}
                className="text-xs rounded-md border border-border/70 px-3 py-2 space-y-0.5"
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="secondary" className="text-[10px]">{iss.type}</Badge>
                  <span className="line-through text-muted-foreground">{iss.original}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-medium text-foreground">{iss.suggestion}</span>
                </div>
                <p className="text-muted-foreground">{iss.explanation}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {correction.suggestions?.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground">강의 핵심 보강 제안</p>
          <ul className="list-disc pl-5 space-y-0.5 text-xs text-muted-foreground">
            {correction.suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {correction.overall_feedback && (
        <div className="text-xs rounded-md bg-primary/5 border border-primary/15 p-3 flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
          <p className="leading-relaxed">{correction.overall_feedback}</p>
        </div>
      )}
    </article>
  );
};