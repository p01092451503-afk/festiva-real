import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDurationMs } from "@/lib/duration";

type RowStatus = "pending" | "running" | "success" | "skipped" | "failed" | "removed";

interface SyncRow {
  contentId: string;
  courseId: string | null;
  title: string;
  guid: string;
  before: number | null;
  after: number | null;
  status: RowStatus;
  message?: string;
}

interface ContentRow {
  id: string;
  course_id: string | null;
  title: string;
  bunny_video_guid: string | null;
  video_url: string | null;
  duration_minutes: number | null;
}

const extractGuid = (row: ContentRow): string | null => {
  if (row.bunny_video_guid) return row.bunny_video_guid.trim();
  if (row.video_url?.startsWith("bunny://")) {
    return row.video_url.replace("bunny://", "").trim();
  }
  return null;
};

const minutesFromSeconds = (seconds: number): number =>
  Math.round((seconds / 60) * 100) / 100;

/**
 * Admin tool: re-sync `course_contents.duration_minutes` (and i18n mirror)
 * with the actual length stored in Bunny Stream. Can be re-run anytime.
 */
const BunnyDurationSyncDialog = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<SyncRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [summary, setSummary] = useState<{
    total: number;
    updated: number;
    skipped: number;
    failed: number;
  } | null>(null);

  const { data: targets = [], isLoading: loadingTargets } = useQuery({
    queryKey: ["bunny-sync-targets", open],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_contents")
        .select("id, course_id, title, bunny_video_guid, video_url, duration_minutes")
        .or("video_provider.eq.bunny,bunny_video_guid.not.is.null,video_url.like.bunny://%")
        .order("course_id", { ascending: true })
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data as ContentRow[]).filter((r) => extractGuid(r));
    },
  });

  const totalCount = targets.length;

  const sync = useMutation({
    mutationFn: async () => {
      const initial: SyncRow[] = targets.map((t) => ({
        contentId: t.id,
        courseId: t.course_id,
        title: t.title,
        guid: extractGuid(t)!,
        before: t.duration_minutes,
        after: null,
        status: "pending",
      }));
      setRows(initial);
      setProgress(0);
      setPhase("running");
      setSummary(null);

      let updated = 0;
      let skipped = 0;
      let failed = 0;
      const next = [...initial];

      for (let i = 0; i < next.length; i++) {
        next[i] = { ...next[i], status: "running" };
        setRows([...next]);

        try {
          const { data, error } = await supabase.functions.invoke("bunny-stream-info", {
            body: { video_guid: next[i].guid },
          });
          if (error) throw new Error(error.message || "Bunny info call failed");

          // Edge function returns 200 + fallback:true when Bunny rejects the
          // request (404 missing video, 5xx transient, network error). Skip
          // these rows instead of failing the whole batch.
          if (data?.fallback) {
            // If Bunny says the video no longer exists, automatically clean up
            // the dangling reference on this lesson so it stops appearing in
            // future sync runs and the video player no longer tries to load it.
            if (data.error === "BUNNY_VIDEO_NOT_FOUND") {
              const { error: clearErr } = await supabase
                .from("course_contents")
                .update({
                  bunny_video_guid: null,
                  video_url: null,
                  video_provider: null,
                  duration_minutes: null,
                })
                .eq("id", next[i].contentId);
              if (clearErr) throw clearErr;

              await supabase
                .from("course_content_i18n")
                .update({
                  bunny_video_guid: null,
                  video_url: null,
                  video_provider: null,
                  duration_minutes: null,
                })
                .eq("content_id", next[i].contentId);

              next[i] = {
                ...next[i],
                status: "removed",
                message: "CDN에 영상이 없어 차시 매핑을 해제했습니다",
              };
              updated += 1;
              setRows([...next]);
              setProgress(Math.round(((i + 1) / next.length) * 100));
              continue;
            }

            const reason =
              data.error === "BUNNY_NETWORK_ERROR"
                ? "CDN 네트워크 오류 (재시도 권장)"
                : `CDN API 오류 (${data.status ?? "unknown"})`;
            next[i] = { ...next[i], status: "skipped", message: reason };
            skipped += 1;
            setRows([...next]);
            setProgress(Math.round(((i + 1) / next.length) * 100));
            continue;
          }

          const lengthSeconds = Number(data?.length_seconds || 0);
          if (!lengthSeconds || lengthSeconds <= 0) {
            next[i] = {
              ...next[i],
              status: "skipped",
              message: "CDN에 길이 정보가 없습니다",
            };
            skipped += 1;
          } else {
            const minutes = minutesFromSeconds(lengthSeconds);
            const same =
              next[i].before != null &&
              Math.abs(Number(next[i].before) - minutes) < 0.01;

            if (!same) {
              const { error: upErr } = await supabase
                .from("course_contents")
                .update({ duration_minutes: minutes })
                .eq("id", next[i].contentId);
              if (upErr) throw upErr;

              await supabase
                .from("course_content_i18n")
                .update({ duration_minutes: minutes })
                .eq("content_id", next[i].contentId);
            }

            next[i] = {
              ...next[i],
              after: minutes,
              status: same ? "skipped" : "success",
              message: same ? "이미 최신" : undefined,
            };
            if (same) skipped += 1;
            else updated += 1;
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          next[i] = { ...next[i], status: "failed", message };
          failed += 1;
        }

        setRows([...next]);
        setProgress(Math.round(((i + 1) / next.length) * 100));
      }

      const result = { total: next.length, updated, skipped, failed };
      setSummary(result);
      setPhase(failed > 0 ? "error" : "done");
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["video-assets"] });
      queryClient.invalidateQueries({ queryKey: ["course-contents"] });
      toast({
        title: result.failed > 0 ? "동기화 일부 실패" : "동기화 완료",
        description: `갱신 ${result.updated}건 · 변경없음 ${result.skipped}건 · 실패 ${result.failed}건`,
        variant: result.failed > 0 ? "destructive" : undefined,
      });
    },
    onError: (err: Error) => {
      setPhase("error");
      toast({
        title: "동기화 실패",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const headerStatus = useMemo(() => {
    if (sync.isPending || phase === "running") {
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> 진행중
        </Badge>
      );
    }
    if (phase === "done") {
      return (
        <Badge variant="outline" className="gap-1 border-green-300 bg-emerald-500 text-white dark:bg-emerald-500 dark:text-white">
          <CheckCircle2 className="h-3 w-3" /> 성공
        </Badge>
      );
    }
    if (phase === "error") {
      return (
        <Badge variant="outline" className="gap-1 border-destructive text-destructive">
          <XCircle className="h-3 w-3" /> 일부 실패
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" /> 대기중
      </Badge>
    );
  }, [phase, sync.isPending]);

  const reset = () => {
    setRows([]);
    setProgress(0);
    setPhase("idle");
    setSummary(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o && !sync.isPending) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          CDN 길이 동기화
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            CDN 영상 길이 동기화 {headerStatus}
          </DialogTitle>
          <DialogDescription>
            CDN에 업로드된 실제 영상 길이를 가져와 모든 차시의 표시 시간을
            갱신합니다. 언제든지 다시 실행해도 안전합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              대상 차시:{" "}
              <span className="font-semibold text-foreground">
                {loadingTargets ? "..." : `${totalCount}개`}
              </span>
            </span>
            {summary && (
              <span className="text-muted-foreground">
                갱신 {summary.updated} · 변경없음 {summary.skipped} · 실패{" "}
                <span className={summary.failed > 0 ? "text-destructive font-semibold" : ""}>
                  {summary.failed}
                </span>
              </span>
            )}
          </div>
          <Progress value={progress} className="h-2" />

          {rows.length > 0 && (
            <ScrollArea className="h-72 rounded-md border">
              <div className="divide-y">
                {rows.map((r) => (
                  <div
                    key={r.contentId}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.guid}</p>
                      {r.message && (
                        <p className="truncate text-xs text-muted-foreground">{r.message}</p>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {formatDurationMs(r.before)}
                      {r.after != null && (
                        <>
                          {" → "}
                          <span className="font-semibold text-foreground">
                            {formatDurationMs(r.after)}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="shrink-0">
                      {r.status === "pending" && (
                        <Badge variant="outline" className="text-[10px]">대기</Badge>
                      )}
                      {r.status === "running" && (
                        <Badge variant="secondary" className="gap-1 text-[10px]">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          진행
                        </Badge>
                      )}
                      {r.status === "success" && (
                        <Badge
                          variant="outline"
                          className="gap-1 text-[10px] border-green-300 bg-emerald-500 text-white dark:bg-emerald-500 dark:text-white"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          갱신
                        </Badge>
                      )}
                      {r.status === "skipped" && (
                        <Badge variant="outline" className="text-[10px]">유지</Badge>
                      )}
                      {r.status === "removed" && (
                        <Badge
                          variant="outline"
                          className="gap-1 text-[10px] border-amber-300 bg-amber-500 text-white dark:bg-amber-500 dark:text-white"
                        >
                          <XCircle className="h-3 w-3" />
                          매핑해제
                        </Badge>
                      )}
                      {r.status === "failed" && (
                        <Badge
                          variant="outline"
                          className="gap-1 text-[10px] border-destructive text-destructive"
                        >
                          <XCircle className="h-3 w-3" />
                          실패
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={sync.isPending}
          >
            닫기
          </Button>
          <Button
            onClick={() => sync.mutate()}
            disabled={sync.isPending || loadingTargets || totalCount === 0}
          >
            {sync.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> 동기화 중...
              </>
            ) : phase === "done" || phase === "error" ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2" /> 다시 실행
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" /> 동기화 시작
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BunnyDurationSyncDialog;