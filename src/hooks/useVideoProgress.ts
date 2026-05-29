import { useRef, useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

interface UseVideoProgressOptions {
  userId: string | undefined;
  contentId: string | undefined;
  courseId: string | undefined;
  durationMinutes: number | undefined;
  existingProgress: any;
  enabled: boolean;
}

/**
 * Manages YouTube / Vimeo IFrame API progress tracking.
 * – Saves position every 10 s
 * – Auto-completes at 80 %
 * – Resumes from last saved position
 */
export function useVideoProgress({
  userId,
  contentId,
  courseId,
  durationMinutes,
  existingProgress,
  enabled,
}: UseVideoProgressOptions) {
  const queryClient = useQueryClient();
  const [playerReady, setPlayerReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [autoCompleted, setAutoCompleted] = useState(false);
  const ytPlayerRef = useRef<any>(null);
  const vimeoPlayerRef = useRef<any>(null);
  const bunnyPlayerRef = useRef<any>(null);
  const activePlayerTypeRef = useRef<"youtube" | "vimeo" | "bunny" | null>(null);
  const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uiIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const hasResumedRef = useRef(false);
  // Cache of the last known playback snapshot so we can flush on pagehide
  // even when the player API can no longer respond.
  const lastSnapshotRef = useRef<{ cur: number; dur: number }>({ cur: 0, dur: 0 });
  const existingProgressIdRef = useRef<string | null>(existingProgress?.id ?? null);
  const userIdRef = useRef<string | undefined>(userId);
  const contentIdRef = useRef<string | undefined>(contentId);
  const courseIdRef = useRef<string | undefined>(courseId);
  const isCompletedRef = useRef<boolean>(false);
  const autoCompletedRef = useRef<boolean>(false);

  useEffect(() => { existingProgressIdRef.current = existingProgress?.id ?? null; }, [existingProgress?.id]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { contentIdRef.current = contentId; }, [contentId]);
  useEffect(() => { courseIdRef.current = courseId; }, [courseId]);

  const resumePosition = existingProgress?.last_position_seconds || 0;
  const isCompleted = existingProgress?.completed || false;
  useEffect(() => { isCompletedRef.current = isCompleted; }, [isCompleted]);
  useEffect(() => { autoCompletedRef.current = autoCompleted; }, [autoCompleted]);

  // ─── Upsert progress to DB ───
  const saveProgress = useCallback(
    async (posSeconds: number, pct: number, completed: boolean) => {
      if (!userId || !contentId) return;
      const payload = {
        user_id: userId,
        content_id: contentId,
        last_position_seconds: Math.round(posSeconds),
        progress_percentage: Math.round(pct),
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        last_accessed_at: new Date().toISOString(),
      };

      if (existingProgress?.id) {
        await supabase
          .from("content_progress")
          .update(payload)
          .eq("id", existingProgress.id);
      } else {
        await supabase.from("content_progress").insert(payload);
      }

      if (completed) {
        queryClient.invalidateQueries({ queryKey: ["content-progress", courseId] });
        queryClient.invalidateQueries({ queryKey: ["content-progress", courseId, userId] });
      }
    },
    [userId, contentId, courseId, existingProgress?.id, queryClient]
  );

  // ─── YouTube API ───
  const initYouTube = useCallback(
    (el: HTMLElement, videoId: string) => {
      // Load API script once
      if (!(window as any).YT) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }

      const create = () => {
        if (ytPlayerRef.current) {
          try { ytPlayerRef.current.destroy(); } catch {}
          ytPlayerRef.current = null;
        }
        setPlayerReady(false);
        // Use existing iframe element directly
        ytPlayerRef.current = new (window as any).YT.Player(el, {
          events: {
            onReady: () => setPlayerReady(true),
            onStateChange: (e: any) => {
              const YT = (window as any).YT;
              if (e.data === YT.PlayerState.PLAYING) {
                startPolling("youtube");
              } else if (e.data === YT.PlayerState.ENDED) {
                stopPolling();
                void markCompleted("youtube");
              } else {
                stopPolling();
              }
            },
          },
        });
      };

      if ((window as any).YT?.Player) {
        create();
      } else {
        (window as any).onYouTubeIframeAPIReady = create;
      }
    },
    [resumePosition, isCompleted]
  );

  // ─── Vimeo API ───
  const initVimeo = useCallback(
    async (iframeEl: HTMLIFrameElement) => {
      iframeRef.current = iframeEl;
      // Reset previous player + ready state when iframe re-mounts
      if (vimeoPlayerRef.current) {
        try { vimeoPlayerRef.current.destroy?.(); } catch {}
        vimeoPlayerRef.current = null;
      }
      setPlayerReady(false);

      // Load Vimeo player script once
      if (!(window as any).Vimeo) {
        await new Promise<void>((resolve) => {
          const s = document.createElement("script");
          s.src = "https://player.vimeo.com/api/player.js";
          s.onload = () => resolve();
          document.head.appendChild(s);
        });
      }

      const player = new (window as any).Vimeo.Player(iframeEl);
      vimeoPlayerRef.current = player;

      player.ready().then(async () => {
        setPlayerReady(true);
      });

      player.on("play", () => startPolling("vimeo"));
      player.on("pause", () => stopPolling());
      player.on("ended", () => {
        stopPolling();
        void markCompleted("vimeo");
      });
    },
    [resumePosition, isCompleted]
  );

  // ─── Bunny Stream API (uses player.js, same protocol as Vimeo) ───
  const initBunny = useCallback(
    async (iframeEl: HTMLIFrameElement) => {
      iframeRef.current = iframeEl;
      if (bunnyPlayerRef.current) {
        try { bunnyPlayerRef.current.destroy?.(); } catch {}
        bunnyPlayerRef.current = null;
      }
      setPlayerReady(false);

      // Bunny Stream embeds expose the same player.js postMessage API as Vimeo.
      if (!(window as any).playerjs) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://assets.mediadelivery.net/playerjs/playerjs-latest.min.js";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Failed to load player.js"));
          document.head.appendChild(s);
        }).catch((e) => console.warn("playerjs load failed", e));
      }

      const PlayerJS = (window as any).playerjs;
      if (!PlayerJS?.Player) {
        console.warn("playerjs not available – Bunny progress tracking disabled");
        return;
      }

      const player = new PlayerJS.Player(iframeEl);
      bunnyPlayerRef.current = player;

      player.on("ready", () => {
        setPlayerReady(true);
      });
      player.on("play", () => startPolling("bunny"));
      player.on("pause", () => stopPolling());
      player.on("ended", () => {
        stopPolling();
        void markCompleted("bunny");
      });
    },
    [resumePosition, isCompleted]
  );

  // Programmatic seek — call after user chooses "resume" / "restart".
  const seekTo = useCallback(async (seconds: number) => {
    const target = Math.max(0, Math.round(seconds));
    try {
      if (vimeoPlayerRef.current) {
        await vimeoPlayerRef.current.setCurrentTime(target);
      } else if (ytPlayerRef.current?.seekTo) {
        ytPlayerRef.current.seekTo(target, true);
      } else if (bunnyPlayerRef.current?.setCurrentTime) {
        bunnyPlayerRef.current.setCurrentTime(target);
      }
    } catch (e) {
      console.warn("seekTo failed", e);
    }
  }, []);

  const getPlaybackSnapshot = useCallback(async (type: "youtube" | "vimeo" | "bunny") => {
    let cur = 0;
    let dur = 0;

    if (type === "youtube" && ytPlayerRef.current) {
      cur = ytPlayerRef.current.getCurrentTime?.() || 0;
      dur = ytPlayerRef.current.getDuration?.() || 0;
    } else if (type === "vimeo" && vimeoPlayerRef.current) {
      cur = (await vimeoPlayerRef.current.getCurrentTime()) || 0;
      dur = (await vimeoPlayerRef.current.getDuration()) || 0;
    } else if (type === "bunny" && bunnyPlayerRef.current) {
      cur = await new Promise<number>((resolve) => {
        try { bunnyPlayerRef.current.getCurrentTime((v: number) => resolve(v || 0)); }
        catch { resolve(0); }
      });
      dur = await new Promise<number>((resolve) => {
        try { bunnyPlayerRef.current.getDuration((v: number) => resolve(v || 0)); }
        catch { resolve(0); }
      });
    }

    if (dur <= 0 && durationMinutes && durationMinutes > 0) {
      dur = durationMinutes * 60;
    }

    if (cur > 0) {
      lastSnapshotRef.current = { cur, dur };
    } else if (dur > 0 && lastSnapshotRef.current.dur <= 0) {
      lastSnapshotRef.current = { cur: lastSnapshotRef.current.cur, dur };
    }

    return { cur, dur };
  }, [durationMinutes]);

  const saveCurrentPosition = useCallback(async (completedOverride?: boolean) => {
    const type = activePlayerTypeRef.current;
    if (!type) return;
    const { cur, dur } = await getPlaybackSnapshot(type);
    if (cur <= 0 || dur <= 0) return;
    const pct = Math.min(100, (cur / dur) * 100);
    await saveProgress(cur, pct, completedOverride ?? (isCompleted || autoCompleted || pct >= 80));
  }, [autoCompleted, getPlaybackSnapshot, isCompleted, saveProgress]);

  // Force-mark the current video as completed (called on player "ended" events).
  const markCompleted = useCallback(
    async (type: "youtube" | "vimeo" | "bunny") => {
      if (autoCompletedRef.current || isCompletedRef.current) return;
      const { cur, dur } = await getPlaybackSnapshot(type);
      const safeDur = dur > 0 ? dur : (durationMinutes ? durationMinutes * 60 : 0);
      const safeCur = cur > 0 ? cur : safeDur;
      setAutoCompleted(true);
      await saveProgress(safeCur, 100, true);
      queryClient.invalidateQueries({ queryKey: ["content-progress", courseId] });
      queryClient.invalidateQueries({ queryKey: ["content-progress", courseId, userIdRef.current] });
    },
    [getPlaybackSnapshot, saveProgress, durationMinutes, queryClient, courseId],
  );

  // Synchronous flush — must complete before the page actually unloads.
  // Uses navigator.sendBeacon (queued by the browser even if JS context is torn down).
  // Falls back to a keepalive fetch when sendBeacon is unavailable.
  const flushOnExit = useCallback(() => {
    if (!userIdRef.current || !contentIdRef.current) return;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

    const snap = lastSnapshotRef.current;
    if (!snap || snap.cur <= 0 || snap.dur <= 0) return;

    const pct = Math.min(100, Math.round((snap.cur / snap.dur) * 100));
    const completed = isCompletedRef.current || autoCompletedRef.current || pct >= 80;

    const payload = {
      user_id: userIdRef.current,
      content_id: contentIdRef.current,
      last_position_seconds: Math.round(snap.cur),
      progress_percentage: pct,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      last_accessed_at: new Date().toISOString(),
    };

    const existingId = existingProgressIdRef.current;
    const url = existingId
      ? `${SUPABASE_URL}/rest/v1/content_progress?id=eq.${existingId}`
      : `${SUPABASE_URL}/rest/v1/content_progress`;
    const body = JSON.stringify(existingId ? payload : [payload]);

    // Try sendBeacon first — it survives page unload reliably.
    try {
      if (navigator?.sendBeacon && !existingId) {
        // sendBeacon only supports POST; use it for inserts only.
        const blob = new Blob([body], { type: "application/json" });
        const beaconUrl = `${url}?apikey=${SUPABASE_ANON_KEY}`;
        const ok = navigator.sendBeacon(beaconUrl, blob);
        if (ok) return;
      }
    } catch (e) {
      // fall through to fetch
    }

    // Fallback: keepalive fetch (works for both POST and PATCH)
    try {
      void fetch(url, {
        method: existingId ? "PATCH" : "POST",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer: existingId ? "return=minimal" : "return=minimal",
        },
        body,
      });
    } catch {
      /* best-effort only */
    }
  }, []);

  // ─── UI update loop (every 1s) ───
  const startUIPolling = useCallback(
    (type: "youtube" | "vimeo" | "bunny") => {
      if (uiIntervalRef.current) clearInterval(uiIntervalRef.current);
      uiIntervalRef.current = setInterval(async () => {
        const { cur, dur } = await getPlaybackSnapshot(type);
        setCurrentTime(cur);
        setDuration(dur);

        // Auto-complete check
        if (dur > 0) {
          const pct = (cur / dur) * 100;
          if (pct >= 80 && !isCompleted && !autoCompleted) {
            setAutoCompleted(true);
            await saveProgress(cur, pct, true);
          }
        }
      }, 1000);
    },
    [isCompleted, autoCompleted, saveProgress, getPlaybackSnapshot]
  );

  // ─── DB save loop (every 10s) ───
  const startPolling = useCallback(
    (type: "youtube" | "vimeo" | "bunny") => {
      stopPolling();
      activePlayerTypeRef.current = type;
      startUIPolling(type);
      saveIntervalRef.current = setInterval(async () => {
        const { cur, dur } = await getPlaybackSnapshot(type);

        if (dur <= 0) return;
        const pct = (cur / dur) * 100;
        await saveProgress(cur, pct, isCompleted || autoCompleted);
      }, 10000);
    },
    [isCompleted, autoCompleted, saveProgress, startUIPolling, getPlaybackSnapshot]
  );

  const stopPolling = useCallback(() => {
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }
    if (uiIntervalRef.current) {
      clearInterval(uiIntervalRef.current);
      uiIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handlePageExit = () => {
      // Sync flush via sendBeacon — guaranteed to be sent.
      flushOnExit();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushOnExit();
      }
    };

    window.addEventListener("pagehide", handlePageExit);
    window.addEventListener("beforeunload", handlePageExit);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", handlePageExit);
      window.removeEventListener("beforeunload", handlePageExit);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [flushOnExit]);

  // Cleanup
  useEffect(() => {
    return () => {
      // On unmount (route change), flush synchronously via beacon AND
      // attempt the standard async save so the React Query cache stays in sync.
      flushOnExit();
      void saveCurrentPosition();
      stopPolling();
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy(); } catch {}
        ytPlayerRef.current = null;
      }
      vimeoPlayerRef.current = null;
      bunnyPlayerRef.current = null;
      activePlayerTypeRef.current = null;
      lastSnapshotRef.current = { cur: 0, dur: 0 };
    };
  }, [contentId]);

  return {
    initYouTube,
    initVimeo,
    initBunny,
    playerReady,
    currentTime,
    duration,
    autoCompleted,
    resumePosition,
    seekTo,
  };
}
