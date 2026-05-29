import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DailyIframe, { type DailyCall } from "@daily-co/daily-js";
import { ArrowLeft, Loader2, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { formatKoreaDateTime } from "@/lib/koreaDateTime";
import { toast } from "sonner";
import { SessionChatPanel } from "@/components/video/SessionChatPanel";

const VideoRoom = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<DailyCall | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorTitle, setErrorTitle] = useState<string>("입장할 수 없습니다");
  const [chatOpen, setChatOpen] = useState(true);

  useEffect(() => {
    if (!sessionId || !containerRef.current) return;
    let cancelled = false;

    const init = async () => {
      setLoading(true);
      setError(null);
      setErrorTitle("입장할 수 없습니다");
      const { data, error: fnErr } = await supabase.functions.invoke("daily-join-token", {
        body: { sessionId },
      });
      if (cancelled) return;
      if (fnErr || !data?.url || !data?.token) {
        let payload: { error?: string; scheduled_start?: string; details?: unknown } = {};
        if (fnErr instanceof FunctionsHttpError) {
          try { payload = await fnErr.context.json(); } catch { /* ignore */ }
        } else if (data && typeof data === "object") {
          payload = data as typeof payload;
        }
        const msg = payload.error;
        if (msg === "too_early") {
          const startStr = payload.scheduled_start
            ? formatKoreaDateTime(payload.scheduled_start, {
                month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
              })
            : null;
          setErrorTitle("아직 입장 시간이 아닙니다");
          setError(
            startStr
              ? `세션 시작: ${startStr}\n시작 10분 전부터 입장할 수 있습니다.`
              : "시작 10분 전부터 입장할 수 있습니다.",
          );
        } else if (msg === "session_ended") {
          setErrorTitle("이미 종료된 세션입니다");
          setError("세션 종료 시간이 지나 입장할 수 없습니다.");
        } else if (msg === "not invited" || msg === "not_invited") {
          setErrorTitle("초대되지 않은 세션입니다");
          setError("이 세션의 참가자로 등록되어 있지 않습니다. 진행자에게 초대를 요청해 주세요.");
        } else if (msg === "session not found") {
          setErrorTitle("세션을 찾을 수 없습니다");
          setError("삭제되었거나 잘못된 링크일 수 있습니다.");
        } else if (msg === "room not ready") {
          setErrorTitle("회의실 준비 중");
          setError("아직 화상 회의실이 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.");
        } else if (msg === "unauthorized") {
          setErrorTitle("로그인이 필요합니다");
          setError("세션에 입장하려면 다시 로그인해 주세요.");
        } else if (msg === "token_failed") {
          setErrorTitle("세션 시간이 종료되었습니다");
          const detailMsg =
            payload.details && typeof payload.details === "object" && "error" in (payload.details as Record<string, unknown>)
              ? String((payload.details as Record<string, unknown>).error)
              : null;
          setError(
            `세션 종료 시간이 지나 입장 토큰을 발급할 수 없습니다.${detailMsg ? `\n(상세: ${detailMsg})` : ""}`,
          );
        } else {
          setErrorTitle("입장할 수 없습니다");
          setError(msg ?? fnErr?.message ?? "입장 토큰을 받지 못했습니다.");
        }
        setLoading(false);
        return;
      }

      try {
        const call = DailyIframe.createFrame(containerRef.current!, {
          showLeaveButton: true,
          iframeStyle: { width: "100%", height: "100%", border: "0", borderRadius: "0" },
        });
        callRef.current = call;
        await call.join({ url: data.url, token: data.token });

        call.on("left-meeting", async () => {
          await supabase
            .from("video_session_participants")
            .update({ left_at: new Date().toISOString() })
            .eq("session_id", sessionId)
            .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "");
          navigate(-1);
        });
        setLoading(false);
      } catch (e) {
        setError((e as Error).message);
        setLoading(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      callRef.current?.destroy().catch(() => {});
      callRef.current = null;
    };
  }, [sessionId, navigate]);

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> 나가기
        </Button>
        <div className="text-sm text-muted-foreground">실시간 화상 세션</div>
        <Button variant="ghost" size="sm" onClick={() => setChatOpen((v) => !v)}>
          {chatOpen ? <X className="h-4 w-4 mr-1" /> : <MessageSquare className="h-4 w-4 mr-1" />}
          채팅
        </Button>
      </div>
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 relative bg-black min-w-0">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <Loader2 className="h-8 w-8 animate-spin mr-2" /> 화상 세션 준비 중…
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center text-white p-8 text-center">
              <div>
                <p className="text-lg font-semibold mb-2">{errorTitle}</p>
                <p className="text-sm text-white/80 mb-6 whitespace-pre-line">{error}</p>
                <Button variant="secondary" onClick={() => navigate(-1)}>돌아가기</Button>
              </div>
            </div>
          )}
          <div ref={containerRef} className="w-full h-full" />
        </div>
        {chatOpen && sessionId && (
          <div className="w-80 shrink-0 border-l bg-background hidden md:flex flex-col min-w-0">
            <SessionChatPanel sessionId={sessionId} />
          </div>
        )}
      </div>
      {chatOpen && sessionId && (
        <div className="md:hidden fixed inset-x-0 bottom-0 top-16 bg-background border-t flex flex-col z-50">
          <SessionChatPanel sessionId={sessionId} />
        </div>
      )}
    </div>
  );
};

export default VideoRoom;