import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { toast } from "sonner";

interface Msg {
  id: string;
  session_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export const SessionChatPanel = ({ sessionId }: { sessionId: string }) => {
  const { profile } = useUser();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] } = useQuery({
    queryKey: ["video-session-messages", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_session_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  const userIds = useMemo(
    () => Array.from(new Set(messages.map((m) => m.user_id))),
    [messages],
  );

  const { data: profiles = [] } = useQuery({
    queryKey: ["video-session-message-profiles", userIds.join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      return data ?? [];
    },
    enabled: userIds.length > 0,
  });

  const nameMap = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p: any) => m.set(p.user_id, p.full_name ?? "익명"));
    return m;
  }, [profiles]);

  useEffect(() => {
    const channel = supabase
      .channel(`video-session-messages:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "video_session_messages", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          qc.setQueryData<Msg[]>(["video-session-messages", sessionId], (prev = []) => {
            if (prev.find((m) => m.id === (payload.new as Msg).id)) return prev;
            return [...prev, payload.new as Msg];
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !profile?.user_id || sending) return;
    setSending(true);
    const { error } = await supabase.from("video_session_messages").insert({
      session_id: sessionId,
      user_id: profile.user_id,
      content: text.slice(0, 2000),
    });
    setSending(false);
    if (error) {
      toast.error("메시지 전송 실패: " + error.message);
      return;
    }
    setDraft("");
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b text-sm font-semibold">채팅</div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center mt-4">아직 메시지가 없습니다.</p>
        ) : (
          messages.map((m) => {
            const mine = m.user_id === profile?.user_id;
            const name = nameMap.get(m.user_id) ?? "참가자";
            return (
              <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <div className="text-[11px] text-muted-foreground mb-0.5">
                  {mine ? "나" : name} · {new Date(m.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                </div>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                    mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            );
          })
        )}
      </div>
      <form
        className="border-t p-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="메시지 입력..."
          maxLength={2000}
          disabled={sending}
        />
        <Button type="submit" size="sm" disabled={!draft.trim() || sending}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};