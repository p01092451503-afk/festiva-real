import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Loader2, Bot, User as UserIcon, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type ChatMessage = { role: "user" | "assistant"; content: string };

const storageKey = (contentId: string) => `lessonTutor:${contentId}`;

export const LessonTutorPanel = ({ contentId }: { contentId: string }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 차시별로 대화 내역을 로컬에 잠시 보관 (페이지 이동 시 유지, 새 차시면 비움)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey(contentId));
      setMessages(raw ? JSON.parse(raw) : []);
    } catch {
      setMessages([]);
    }
    setInput("");
  }, [contentId]);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey(contentId), JSON.stringify(messages));
    } catch {
      /* ignore quota */
    }
    // 새 메시지가 오면 아래로 스크롤
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [messages, contentId]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("lecture-tutor", {
        body: { content_id: contentId, messages: next },
      });
      if (error) throw error;
      const reply = (data as { reply?: string })?.reply;
      if (!reply) throw new Error("응답이 비어 있습니다.");
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      console.error("lesson tutor error", err);
      toast({
        title: "AI 튜터 응답 실패",
        description: err instanceof Error ? err.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
      // 실패 시 마지막 user 메시지는 남겨두되 입력창에 되돌려 재시도 가능하게
      setInput(text);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setMessages([]);
    setInput("");
    try {
      sessionStorage.removeItem(storageKey(contentId));
    } catch {
      /* ignore */
    }
  };

  const suggestions = [
    "이 차시의 핵심 내용을 3줄로 알려줘",
    "어려운 용어를 쉽게 풀어 설명해줘",
    "예시를 하나 들어 설명해줘",
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* 안내 */}
      <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
        <p className="leading-relaxed">
          강의의 자막(전사문)·요약을 근거로 질문에 답해드립니다. 더 정확한 답을 받으려면{" "}
          <span className="font-medium text-foreground">AI 요약</span>을 먼저 한 번 실행해 주세요.
        </p>
      </div>

      {/* 대화 영역 */}
      <div
        ref={scrollRef}
        className="min-h-[220px] max-h-[420px] overflow-y-auto rounded-lg border border-border bg-background p-3 space-y-3"
      >
        {messages.length === 0 && !loading && (
          <div className="py-6 text-center space-y-3">
            <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">AI 튜터에게 질문해보세요</p>
              <p className="mt-1 text-xs text-muted-foreground">
                강의 내용에 대해 모르는 것을 자유롭게 물어볼 수 있어요.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 pt-1">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setInput(s)}
                  className="rounded-full border border-border bg-card px-3 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}
          >
            {m.role === "assistant" && (
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Bot className="h-3.5 w-3.5" />
              </span>
            )}
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground",
              )}
            >
              {m.role === "assistant" ? (
                <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-headings:my-2">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{m.content}</p>
              )}
            </div>
            {m.role === "user" && (
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground">
                <UserIcon className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            AI 튜터가 답변을 작성 중입니다…
          </div>
        )}
      </div>

      {/* 입력 */}
      <div className="space-y-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 1000))}
          placeholder="강의 내용에 대해 궁금한 점을 입력하세요 (Enter 전송, Shift+Enter 줄바꿈)"
          className="min-h-[72px] resize-y text-sm"
          maxLength={1000}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          disabled={loading}
        />
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={reset}
            disabled={loading || messages.length === 0}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <Trash2 className="h-3 w-3" />
            대화 초기화
          </button>
          <Button size="sm" onClick={send} disabled={loading || !input.trim()} className="gap-1.5">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            보내기
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LessonTutorPanel;