import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Wand2, Copy, Check, Trash2, History, Loader2, Info, Coins } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

type Tone = "neutral" | "formal" | "casual" | "business" | "academic";

type Diff = { type: "equal" | "add" | "remove"; text: string };
type Issue = {
  type: "grammar" | "spelling" | "vocabulary" | "style" | "punctuation";
  original: string;
  suggestion: string;
  explanation_ko: string;
};
type Alternative = { text: string; note_ko: string };

type CorrectionResult = {
  id: string | null;
  original_text: string;
  corrected_text: string;
  diffs: Diff[];
  issues: Issue[];
  alternatives: Alternative[];
  cefr_level: string;
  overall_feedback_ko: string;
  tone: Tone;
  created_at: string | null;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null;
};

type HistoryRow = {
  id: string;
  original_text: string;
  corrected_text: string;
  diffs: Diff[] | null;
  issues: Issue[] | null;
  alternatives: Alternative[] | null;
  cefr_level: string | null;
  overall_feedback_ko: string | null;
  tone: string;
  created_at: string;
};

const TONE_LABEL: Record<Tone, string> = {
  neutral: "기본",
  formal: "격식",
  casual: "캐주얼",
  business: "비즈니스",
  academic: "학술",
};

const ISSUE_LABEL: Record<Issue["type"], string> = {
  grammar: "문법",
  spelling: "철자",
  vocabulary: "어휘",
  style: "스타일",
  punctuation: "구두점",
};

const ISSUE_VARIANT: Record<Issue["type"], "default" | "secondary" | "destructive" | "outline"> = {
  grammar: "destructive",
  spelling: "destructive",
  vocabulary: "default",
  style: "secondary",
  punctuation: "outline",
};

const SAMPLE = "I have went to the library yesterday for studying english but the books was not available so I am going there again tomorrow.";

// Gemini 2.5 Flash via Lovable AI Gateway pricing (USD per 1M tokens).
// Used only to give the user a transparent rough estimate per request.
const PRICE_INPUT_PER_M = 0.3;
const PRICE_OUTPUT_PER_M = 2.5;
const USD_TO_KRW = 1380;

const estimateCostKRW = (usage?: CorrectionResult["usage"]) => {
  if (!usage) return null;
  const inT = usage.prompt_tokens ?? 0;
  const outT = usage.completion_tokens ?? 0;
  const usd = (inT / 1_000_000) * PRICE_INPUT_PER_M + (outT / 1_000_000) * PRICE_OUTPUT_PER_M;
  return usd * USD_TO_KRW;
};

const EnglishCorrection = () => {
  const { user } = useUser();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [tone, setTone] = useState<Tone>("neutral");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CorrectionResult | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: history = [] } = useQuery({
    queryKey: ["english-corrections", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("english_corrections")
        .select(
          "id, original_text, corrected_text, diffs, issues, alternatives, cefr_level, overall_feedback_ko, tone, created_at",
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as unknown as HistoryRow[];
    },
    enabled: !!user?.id,
  });

  const handleCorrect = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast({ title: "영어 문장을 입력해주세요." });
      return;
    }
    if (trimmed.length > 4000) {
      toast({ title: "최대 4000자까지 입력 가능합니다.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("correct-english", {
        body: { text: trimmed, tone },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult(data as CorrectionResult);
      qc.invalidateQueries({ queryKey: ["english-corrections", user?.id] });
    } catch (e) {
      console.error(e);
      toast({
        title: "교정에 실패했습니다",
        description: e instanceof Error ? e.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast({ title: "복사되었습니다." });
    setTimeout(() => setCopied(false), 1500);
  };

  const loadHistory = (row: HistoryRow) => {
    setText(row.original_text);
    setTone((row.tone as Tone) || "neutral");
    setResult({
      id: row.id,
      original_text: row.original_text,
      corrected_text: row.corrected_text,
      diffs: row.diffs || [],
      issues: row.issues || [],
      alternatives: row.alternatives || [],
      cefr_level: row.cefr_level || "-",
      overall_feedback_ko: row.overall_feedback_ko || "",
      tone: (row.tone as Tone) || "neutral",
      created_at: row.created_at,
    });
  };

  const deleteHistory = async (id: string) => {
    const { error } = await supabase.from("english_corrections").delete().eq("id", id);
    if (error) {
      toast({ title: "삭제에 실패했습니다.", variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["english-corrections", user?.id] });
    if (result?.id === id) setResult(null);
  };

  return (
    <DashboardLayout>
      <div className="w-full min-w-0 space-y-6">
        {/* Header */}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="h-6 w-6" />
            AI 영어 문장 교정
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            영어 문장을 입력하면 AI가 문법·어휘·표현을 다듬고, 변경 사항과 대안 표현을 한국어로 설명해드립니다.
          </p>
        </div>

        {/* Credit usage notice */}
        <div className="rounded-md border bg-muted/30 p-3 sm:p-4 flex items-start gap-3 min-w-0">
          <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="min-w-0 text-xs sm:text-sm leading-relaxed text-muted-foreground">
            <p>
              본 기능은 <span className="font-medium text-foreground">Google Gemini 2.5 Flash</span> 모델을 사용하며,
              요청 1회당 약 <span className="font-medium text-foreground">1~5원</span> 수준의 AI 크레딧이 소모됩니다.
              크레딧은 학원(워크스페이스) 단위로 차감되며, 잔액은 관리자가 워크스페이스 설정에서 확인할 수 있습니다.
            </p>
            {result?.usage && (
              <p className="mt-1 text-foreground">
                직전 요청: 입력 {result.usage.prompt_tokens ?? 0} · 출력 {result.usage.completion_tokens ?? 0} ·
                합계 {result.usage.total_tokens ?? 0} 토큰
                {(() => {
                  const krw = estimateCostKRW(result.usage);
                  return krw !== null ? ` (약 ₩${krw.toFixed(2)})` : "";
                })()}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
          {/* Left: input */}
          <Card className="p-4 sm:p-6 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-sm font-medium">원문 입력</div>
              <div className="flex items-center gap-2">
                <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
                  <SelectTrigger className="h-8 w-[120px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TONE_LABEL) as Tone[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {TONE_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="여기에 영어 문장을 입력하거나 붙여넣으세요."
              className="min-h-[280px] text-base leading-relaxed resize-y"
              maxLength={4000}
            />
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <button
                type="button"
                className="underline-offset-2 hover:underline"
                onClick={() => setText(SAMPLE)}
              >
                예시 문장 넣기
              </button>
              <span>{text.length} / 4000</span>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={handleCorrect} disabled={loading} className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    교정 중...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    교정하기
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setText("");
                  setResult(null);
                }}
                disabled={loading}
              >
                초기화
              </Button>
            </div>
          </Card>

          {/* Right: result */}
          <Card className="p-4 sm:p-6 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-sm font-medium">교정 결과</div>
              {result && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">CEFR {result.cefr_level}</Badge>
                  <Badge variant="secondary">{TONE_LABEL[result.tone]}</Badge>
                  {result.usage?.total_tokens ? (
                    <Badge variant="outline" className="gap-1">
                      <Coins className="h-3 w-3" />
                      {result.usage.total_tokens} tok
                    </Badge>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(result.corrected_text)}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </div>

            {!result && !loading && (
              <div className="min-h-[280px] flex items-center justify-center text-sm text-muted-foreground border border-dashed rounded-md">
                교정 결과가 여기에 표시됩니다.
              </div>
            )}

            {loading && (
              <div className="min-h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                AI가 문장을 분석하고 있어요...
              </div>
            )}

            {result && (
              <div className="space-y-5">
                {/* Diff view */}
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    변경사항 하이라이트
                  </div>
                  <div className="rounded-md border bg-muted/30 p-3 text-base leading-relaxed">
                    {result.diffs && result.diffs.length > 0 ? (
                      result.diffs.map((d, i) => {
                        if (d.type === "equal")
                          return <span key={i}>{d.text}</span>;
                        if (d.type === "add")
                          return (
                            <span
                              key={i}
                              className="bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100 rounded px-0.5"
                            >
                              {d.text}
                            </span>
                          );
                        return (
                          <span
                            key={i}
                            className="bg-red-100 text-red-900 line-through dark:bg-red-900/40 dark:text-red-100 rounded px-0.5"
                          >
                            {d.text}
                          </span>
                        );
                      })
                    ) : (
                      <span>{result.corrected_text}</span>
                    )}
                  </div>
                </div>

                {/* Corrected clean */}
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    교정된 문장
                  </div>
                  <div className="rounded-md border p-3 text-base leading-relaxed">
                    {result.corrected_text}
                  </div>
                </div>

                {/* Issues */}
                {result.issues && result.issues.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      세부 교정 ({result.issues.length})
                    </div>
                    <ul className="space-y-2">
                      {result.issues.map((it, i) => (
                        <li
                          key={i}
                          className="border-b-2 border-border/80 pb-2 last:border-b-0"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={ISSUE_VARIANT[it.type]}>
                              {ISSUE_LABEL[it.type]}
                            </Badge>
                            <span className="text-sm line-through text-muted-foreground">
                              {it.original}
                            </span>
                            <span className="text-sm">→</span>
                            <span className="text-sm font-medium">{it.suggestion}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {it.explanation_ko}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Alternatives */}
                {result.alternatives && result.alternatives.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      대안 표현
                    </div>
                    <ul className="space-y-2">
                      {result.alternatives.map((a, i) => (
                        <li key={i} className="rounded-md border p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm">{a.text}</p>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => handleCopy(a.text)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          {a.note_ko && (
                            <p className="text-xs text-muted-foreground mt-1">{a.note_ko}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Feedback */}
                {result.overall_feedback_ko && (
                  <div className="rounded-md bg-muted/40 p-3">
                    <div className="text-xs font-medium text-muted-foreground mb-1">
                      AI 튜터 피드백
                    </div>
                    <p className="text-sm leading-relaxed">{result.overall_feedback_ko}</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* History */}
        <Card className="p-4 sm:p-6 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <History className="h-4 w-4" />
            <div className="text-sm font-medium">최근 교정 기록</div>
            <span className="text-xs text-muted-foreground">최대 20개</span>
          </div>
          {history.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              아직 교정 기록이 없습니다.
            </div>
          ) : (
            <ul>
              {history.map((row) => (
                <li
                  key={row.id}
                  className="border-b-2 border-border/80 last:border-b-0 py-3 flex items-start gap-3"
                >
                  <button
                    type="button"
                    onClick={() => loadHistory(row)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="text-sm truncate">{row.original_text}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{new Date(row.created_at).toLocaleString("ko-KR")}</span>
                      {row.cefr_level && <Badge variant="outline">CEFR {row.cefr_level}</Badge>}
                      {row.tone && (
                        <Badge variant="secondary">
                          {TONE_LABEL[(row.tone as Tone) || "neutral"]}
                        </Badge>
                      )}
                    </div>
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => deleteHistory(row.id)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default EnglishCorrection;