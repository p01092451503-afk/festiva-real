import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Send, Loader2, X, Sparkles, Trash2 } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

const SUGGESTIONS = [
  "플랫폼 전체 현황을 요약해줘",
  "최근 7일간 신규 가입자 보여줘",
  "수강 신청 대기중인 건 알려줘",
  "완료 수 기준 상위 학습자 10명 뽑아줘",
];

export default function AdminAssistantFAB() {
  const { user } = useUser();
  const { isAdmin } = useUserRole();
  const { pathname } = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Only show for admins/super_admins on admin routes.
  const allowedRoute =
    !!user &&
    isAdmin &&
    (pathname === "/admin" || pathname.startsWith("/admin/"));

  const { data: messages = [], refetch } = useQuery({
    queryKey: ["admin-assistant-chat", user?.id],
    enabled: !!user && isAdmin && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_chat_messages" as any)
        .select("id, role, content, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return ((data || []) as unknown) as ChatMsg[];
    },
    staleTime: 0,
  });

  useEffect(() => {
    if (open && scrollRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current!.scrollTop = scrollRef.current!.scrollHeight;
      });
    }
  }, [open, messages.length]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setInput("");
    setSending(true);

    // optimistic user message
    const optimistic: ChatMsg = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: msg,
      created_at: new Date().toISOString(),
    };
    qc.setQueryData(
      ["admin-assistant-chat", user?.id],
      (prev: ChatMsg[] | undefined) => [...(prev || []), optimistic],
    );

    try {
      const history = (messages as ChatMsg[]).slice(-12).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const { data, error } = await supabase.functions.invoke("admin-assistant-chat", {
        body: { message: msg, history },
      });
      if (error) {
        let errMsg = error.message || "요청 실패";
        try {
          const resp: Response | undefined = (error as any)?.context?.response;
          if (resp) {
            const j = await resp.clone().json();
            if (j?.error) errMsg = j.error;
          }
        } catch {}
        throw new Error(errMsg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      await refetch();
    } catch (e: any) {
      toast({
        title: "AI 응답 실패",
        description: e?.message || "잠시 후 다시 시도해 주세요.",
        variant: "destructive",
      });
      // rollback optimistic
      await refetch();
    } finally {
      setSending(false);
    }
  };

  const clearAll = async () => {
    if (!user) return;
    if (!confirm("대화 기록을 모두 삭제할까요?")) return;
    const { error } = await supabase
      .from("admin_chat_messages" as any)
      .delete()
      .eq("user_id", user.id);
    if (error) {
      toast({ title: "삭제 실패", description: error.message, variant: "destructive" });
      return;
    }
    await refetch();
  };

  if (!allowedRoute) return null;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="관리자 AI 어시스턴트 열기"
          className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95 sm:bottom-6 sm:right-20"
        >
          <Bot className="h-6 w-6" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            "fixed z-50 flex flex-col bg-background shadow-2xl border border-border",
            // mobile: full-width bottom sheet
            "inset-x-0 bottom-0 h-[85vh] rounded-t-2xl",
            // desktop: floating panel bottom-right
            "sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[640px] sm:w-[440px] sm:rounded-2xl",
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold leading-tight">관리자 AI 어시스턴트</h2>
              <p className="text-xs text-muted-foreground">읽기 전용 · 데이터 조회/요약</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={clearAll}
              aria-label="대화 기록 삭제"
              className="h-8 w-8"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              aria-label="닫기"
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1">
            <div ref={scrollRef} className="space-y-4 p-4">
              {messages.length === 0 && (
                <div className="space-y-3 py-8 text-center">
                  <Bot className="mx-auto h-10 w-10 text-muted-foreground" />
                  <div className="text-sm text-muted-foreground">
                    회원, 강의, 수강 현황 등을 자연어로 물어보세요.
                  </div>
                  <div className="flex flex-col gap-2 px-2 pt-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => send(s)}
                        className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(messages as ChatMsg[]).map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex",
                    m.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {m.content}
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    데이터를 조회하고 있어요…
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Composer */}
          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="무엇이든 물어보세요 (Enter 전송, Shift+Enter 줄바꿈)"
                rows={2}
                className="min-h-[44px] resize-none"
                disabled={sending}
              />
              <Button
                type="button"
                onClick={() => send()}
                disabled={sending || !input.trim()}
                size="icon"
                className="h-11 w-11 shrink-0"
                aria-label="전송"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}