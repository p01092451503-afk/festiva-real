import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Video, Calendar, Play, Clock, AlertCircle } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { formatKoreaDateTime } from "@/lib/koreaDateTime";

const TYPE_LABEL: Record<string, string> = {
  consultation: "1:1 상담",
  lecture: "실시간 강의",
  study: "스터디룸",
};

const VideoSessionsStudent = () => {
  const { profile } = useUser();
  const navigate = useNavigate();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["my-video-sessions", profile?.user_id],
    queryFn: async () => {
      const { data: parts, error: partsError } = await supabase
        .from("video_session_participants")
        .select("session_id")
        .eq("user_id", profile!.user_id);
      if (partsError) throw partsError;
      const ids = (parts ?? []).map((p) => p.session_id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("video_sessions")
        .select("*")
        .in("id", ids)
        .order("scheduled_start", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profile?.user_id,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <DashboardLayout role="student">
      <div className="px-6 py-8 min-w-0">
        <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
          <Video className="h-6 w-6" /> 화상 세션
        </h1>
        <p className="text-muted-foreground mt-1 text-sm mb-6">
          내가 초대된 실시간 화상 세션 일정입니다. 시작 10분 전부터 입장할 수 있습니다.
        </p>

        {isLoading ? (
          <p className="text-muted-foreground">불러오는 중…</p>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border-2 border-dashed border-border/80 rounded-lg">
            예정된 세션이 없습니다.
          </div>
        ) : (
          <div className="space-y-0">
            {sessions.map((s) => {
              const start = new Date(s.scheduled_start).getTime();
              const end = new Date(s.scheduled_end).getTime();
              const canEnter = now >= start - 10 * 60_000 && now <= end + 10 * 60_000;
              const isUpcoming = now < start - 10 * 60_000;
              const isEnded = now > end + 10 * 60_000;
              const remain = Math.max(0, end - now);
              const hh = Math.floor(remain / 3_600_000);
              const mm = Math.floor((remain % 3_600_000) / 60_000);
              const ss = Math.floor((remain % 60_000) / 1000);
              const countdown = hh > 0
                ? `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
                : `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
              return (
                <div key={s.id} className="py-4 border-b-2 border-border/80 flex items-start justify-between gap-4 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{s.title}</h3>
                      <Badge variant="outline" className="whitespace-nowrap">{TYPE_LABEL[s.session_type]}</Badge>
                      {isEnded && <Badge variant="secondary" className="whitespace-nowrap">종료</Badge>}
                      {!isEnded && !isUpcoming && (
                        <Badge className="whitespace-nowrap tabular-nums">
                          종료까지 {countdown}
                        </Badge>
                      )}
                    </div>
                    {s.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{s.description}</p>}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                      <Calendar className="h-3 w-3" />
                      {formatKoreaDateTime(s.scheduled_start)}
                    </div>
                    {isEnded && (
                      <div className="mt-2 flex items-start gap-2 rounded-md border border-border/80 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>
                          세션이 종료되었습니다. 사유: 예정 종료 시간 경과 · 종료 시각 {formatKoreaDateTime(s.scheduled_end)}
                        </span>
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={isEnded ? "secondary" : "default"}
                    disabled={!canEnter || isEnded}
                    onClick={() => navigate(`/video-room/${s.id}`)}
                  >
                    {isEnded ? "세션 종료" : isUpcoming ? <><Clock className="h-4 w-4 mr-1" />대기 중</> : <><Play className="h-4 w-4 mr-1" />입장 <span className="ml-1 text-xs opacity-80 tabular-nums">{countdown}</span></>}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default VideoSessionsStudent;