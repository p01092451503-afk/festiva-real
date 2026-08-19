import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, ChevronRight, CheckCircle2, Play, FileText,
  Video, BarChart3, ExternalLink, Clock, X, RotateCcw, List, FolderOpen,
  Lock as LockIcon, Maximize,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useVideoProgress } from "@/hooks/useVideoProgress";
import { logContentAccess } from "@/hooks/useTrafficLogger";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VideoPlayerSkeleton } from "@/components/PageSkeletons";
import { formatDurationMs } from "@/lib/duration";
import { ContentProtection } from "@/components/ContentProtection";
import LessonExtras from "@/components/LessonExtras";
import { ContentCommentsTrigger } from "@/components/ContentComments";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const contentTypeIcon: Record<string, React.ElementType> = {
  video: Video, document: FileText, quiz: BarChart3, assignment: FileText, live: Video,
};

const getYouTubeVideoId = (url: string | null) => {
  if (!url) return null;

  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return parsed.pathname.split("/").filter(Boolean)[0] || null;
    }

    if (["youtube.com", "m.youtube.com", "music.youtube.com"].includes(host)) {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v");
      }

      const parts = parsed.pathname.split("/").filter(Boolean);
      const markerIndex = parts.findIndex((part) => ["embed", "shorts", "live"].includes(part));
      if (markerIndex !== -1) {
        return parts[markerIndex + 1] || null;
      }
    }
  } catch {
    // Fall through to regex parsing
  }

  const fallbackMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([^&?#/]+)/);
  return fallbackMatch?.[1] || null;
};

const getVimeoVideoId = (url: string | null) => {
  if (!url) return null;
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match?.[1] || null;
};

const ContentPlayer = () => {
  const { courseId, contentId } = useParams<{ courseId: string; contentId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // Derive route prefix from current path (e.g. /student, /teacher, /admin)
  const routePrefix = location.pathname.startsWith("/admin/") ? "/admin" : location.pathname.startsWith("/teacher/") ? "/teacher" : "/student";
  const { user, profile } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mangoPopupOpen, setMangoPopupOpen] = useState(false);
  const [mangoElapsed, setMangoElapsed] = useState(0);
  const mangoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [mobileCurriculumOpen, setMobileCurriculumOpen] = useState(false);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  // Resume vs restart choice — null = not decided this session
  const [resumeChoice, setResumeChoice] = useState<"resume" | "restart" | null>(null);
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);

  const contentTypeLabel: Record<string, string> = {
    video: t("course.video"), document: t("course.document"),
    quiz: t("course.quiz"), assignment: t("course.assignment"), live: t("course.live"),
  };

  const { data: course } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").eq("id", courseId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  // B2C enrollment check
  const { data: b2cEnrollment, isLoading: b2cEnrollmentLoading, isFetched: b2cEnrollmentFetched } = useQuery({
    queryKey: ["b2c-enrollment-check", courseId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select("id, status")
        .eq("user_id", user!.id)
        .eq("course_id", courseId!)
        .eq("status", "approved")
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && !!courseId && !!course?.is_b2c,
  });

  const { data: courseI18n } = useQuery({
    queryKey: ["course-i18n", courseId],
    queryFn: async () => {
      const { data } = await supabase.from("course_i18n").select("*").eq("course_id", courseId!);
      return data || [];
    },
    enabled: !!courseId,
  });

  const { data: contents = [] } = useQuery({
    queryKey: ["course-contents", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("course_contents").select("*").eq("course_id", courseId!).order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  const { data: contentI18nData = [] } = useQuery({
    queryKey: ["content-i18n", courseId],
    queryFn: async () => {
      const contentIds = contents.map(c => c.id);
      if (contentIds.length === 0) return [];
      const { data } = await supabase.from("course_content_i18n").select("*").in("content_id", contentIds);
      return data || [];
    },
    enabled: contents.length > 0,
  });

  const { data: progressData = [] } = useQuery({
    queryKey: ["content-progress", courseId, user?.id],
    queryFn: async () => {
      const contentIds = contents.map((c) => c.id);
      if (contentIds.length === 0) return [];
      const { data, error } = await supabase.from("content_progress").select("*").eq("user_id", user!.id).in("content_id", contentIds);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && contents.length > 0,
  });

  const { data: completionCriteria } = useQuery({
    queryKey: ["completion-criteria", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("completion_criteria")
        .select("min_progress_pct")
        .eq("course_id", courseId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  const getI18n = (cId: string) => contentI18nData.find((i: any) => i.content_id === cId && i.language_code === "en");
  const stripLessonPrefix = (title: string) => title.replace(/^\d+차시\.\s*/, "");
  const getTitle = (c: any) => { if (isEn) { const en = getI18n(c.id); return stripLessonPrefix(en?.title || c.title); } return stripLessonPrefix(c.title); };
  const getDescription = (c: any) => { if (isEn) { const en = getI18n(c.id); return en?.description || c.description; } return c.description; };
  const getVideoUrl = (c: any) => { if (isEn) { const en = getI18n(c.id); return en?.video_url || c.video_url; } return c.video_url; };
  const getVideoProvider = (c: any) => { if (isEn) { const en = getI18n(c.id); return en?.video_provider || c.video_provider; } return c.video_provider; };
  const getCourseTitle = () => { if (isEn) { const en = courseI18n?.find((i: any) => i.language_code === "en"); return en?.title || course?.title || ""; } return course?.title || ""; };

  const isMangoboard = (url: string | null) => url?.includes("mangoboard.net") ?? false;
  const isCardContent = (desc: string | null) => desc?.startsWith("[card-content]") ?? false;
  
  const getCardUrls = (desc: string | null, fallbackUrl: string | null): string[] => {
    if (!desc?.startsWith("[card-content]")) return fallbackUrl ? [fallbackUrl] : [];
    const payload = desc.replace("[card-content]", "");
    try {
      const parsed = JSON.parse(payload);
      if (parsed.urls && parsed.urls.length > 0) return parsed.urls;
    } catch { /* old format */ }
    return fallbackUrl ? [fallbackUrl] : [];
  };

  const [cardIndex, setCardIndex] = useState(0);
  const [kollusEmbedUrl, setKollusEmbedUrl] = useState<string | null>(null);
  const [kollusLoading, setKollusLoading] = useState(false);
  const [bunnyEmbedUrl, setBunnyEmbedUrl] = useState<string | null>(null);
  const [bunnyLoading, setBunnyLoading] = useState(false);
  const [bunnyTokenExpiresAt, setBunnyTokenExpiresAt] = useState<number | null>(null);
  // Bunny 인코딩(트랜스코딩) 진행 상태 — status 4/5 = 재생 가능
  const [bunnyEncoding, setBunnyEncoding] = useState(false);

  const currentContent = contents.find((c) => c.id === contentId);

  // Log content access for traffic monitoring
  useEffect(() => {
    if (user?.id && contentId && courseId && currentContent) {
      logContentAccess(
        user.id, contentId, courseId,
        currentContent.content_type || "video",
        currentContent.video_provider,
        profile?.tenant_id,
      );
    }
  }, [contentId, user?.id, courseId, currentContent]);
  const currentIndex = contents.findIndex((c) => c.id === contentId);
  
  const nextContent = currentIndex < contents.length - 1 ? contents[currentIndex + 1] : null;
  const progressMap = new Map(progressData.map((p) => [p.content_id, p]));
  const currentProgress = progressMap.get(contentId || "");
  const completedCount = progressData.filter((p) => p.completed).length;
  const overallProgress = contents.length > 0 ? Math.round((completedCount / contents.length) * 100) : 0;

  const localVideoUrlForHook = currentContent ? getVideoUrl(currentContent) : null;
  const localProviderForHook = currentContent ? getVideoProvider(currentContent) : null;
  const youtubeVideoId = getYouTubeVideoId(localVideoUrlForHook);
  const vimeoVideoId = getVimeoVideoId(localVideoUrlForHook);

  const isYouTube = (url: string | null, provider: string | null) =>
    provider === "youtube" || url?.includes("youtube.com") || url?.includes("youtu.be");
  const isVimeo = (url: string | null, provider: string | null) =>
    provider === "vimeo" || url?.includes("vimeo.com");
  const bunnyGuidForHook = currentContent
    ? (currentContent.bunny_video_guid ||
        (typeof localVideoUrlForHook === "string" && localVideoUrlForHook.startsWith("bunny://")
          ? localVideoUrlForHook.replace("bunny://", "").trim()
          : null))
    : null;
  const isBunnyTrackable = !!(
    currentContent &&
    (localProviderForHook === "bunny" || bunnyGuidForHook) &&
    bunnyEmbedUrl
  );
  const isTrackableVideo = !!(
    currentContent &&
    !isMangoboard(localVideoUrlForHook) &&
    (
      (isYouTube(localVideoUrlForHook, localProviderForHook) && youtubeVideoId) ||
      (isVimeo(localVideoUrlForHook, localProviderForHook) && vimeoVideoId) ||
      isBunnyTrackable
    )
  );

  const videoProgress = useVideoProgress({
    userId: user?.id,
    contentId,
    courseId,
    durationMinutes: currentContent?.duration_minutes ?? undefined,
    existingProgress: currentProgress,
    enabled: isTrackableVideo,
  });

  const videoIframeRef = useRef<HTMLIFrameElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);

  const handleFullscreen = useCallback(async () => {
    const el = videoContainerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if ((el as any).webkitRequestFullscreen) {
        await (el as any).webkitRequestFullscreen();
      } else if ((videoIframeRef.current as any)?.webkitEnterFullscreen) {
        (videoIframeRef.current as any).webkitEnterFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen failed:", err);
      toast({
        title: "전체화면 전환 실패",
        description: "브라우저가 전체화면을 지원하지 않거나 차단했습니다. 외부 브라우저(Chrome/Safari)에서 열어주세요.",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    if (videoProgress.autoCompleted) {
      toast({ title: t("contentPlayer.autoCompleted"), description: t("contentPlayer.autoCompletedDesc") });
      queryClient.invalidateQueries({ queryKey: ["content-progress", courseId, user?.id] });
    }
  }, [videoProgress.autoCompleted]);

  // Open the "resume vs restart" dialog when a saved position exists
  useEffect(() => {
    if (!isTrackableVideo) return;
    if (resumeChoice !== null) return;
    if (currentProgress?.completed) return;
    if ((videoProgress.resumePosition ?? 0) > 5) {
      setResumeDialogOpen(true);
    }
  }, [
    isTrackableVideo,
    currentProgress?.completed,
    videoProgress.resumePosition,
    resumeChoice,
    contentId,
  ]);

  // Once the user picks "resume" and the player is ready, jump to saved position
  useEffect(() => {
    if (resumeChoice !== "resume") return;
    if (!videoProgress.playerReady) return;
    const target = videoProgress.resumePosition;
    if (target > 0) {
      videoProgress.seekTo(target);
    }
  }, [resumeChoice, videoProgress.playerReady]);

  const videoIframeCallback = useCallback(
    (el: HTMLElement | null) => {
      if (!el || !currentContent || !isTrackableVideo) return;
      videoIframeRef.current = el as HTMLIFrameElement;

      if (youtubeVideoId) {
        videoProgress.initYouTube(el, youtubeVideoId);
      } else if (vimeoVideoId) {
        videoProgress.initVimeo(el as HTMLIFrameElement);
      } else if (isBunnyTrackable) {
        videoProgress.initBunny(el as HTMLIFrameElement);
      }
    },
    [
      currentContent?.id,
      isTrackableVideo,
      youtubeVideoId,
      vimeoVideoId,
      isBunnyTrackable,
      videoProgress.initYouTube,
      videoProgress.initVimeo,
      videoProgress.initBunny,
    ]
  );

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [contentId]);

  useEffect(() => {
    setMangoElapsed(0);
    setCardIndex(0);
    // Reset resume decision whenever the lesson changes
    setResumeChoice(null);
    setResumeDialogOpen(false);
  }, [contentId]);

  // Mangoboard timer
  useEffect(() => {
    if (mangoPopupOpen && currentContent && isMangoboard(getVideoUrl(currentContent))) {
      setMangoElapsed(0);
      mangoTimerRef.current = setInterval(() => setMangoElapsed((prev) => prev + 1), 1000);
    } else {
      if (mangoTimerRef.current) { clearInterval(mangoTimerRef.current); mangoTimerRef.current = null; }
    }
    return () => { if (mangoTimerRef.current) clearInterval(mangoTimerRef.current); };
  }, [mangoPopupOpen, currentContent?.id]);

  const requiredSeconds = (currentContent?.duration_minutes || 5) * 60 * 0.8;
  const mangoAutoCompleted = mangoElapsed >= requiredSeconds;

  // ── 차시별 학습 진도율 계산 (관리자가 설정한 완료 기준에 도달했는지 판정) ──
  const completionThresholdPct = completionCriteria?.min_progress_pct ?? 80;
  const currentVideoUrl = currentContent ? getVideoUrl(currentContent) : null;
  const isCardLesson = isCardContent(currentContent?.description ?? null);
  const isMangoLesson = isMangoboard(currentVideoUrl);

  let livePct = 0;
  if (isTrackableVideo) {
    if (videoProgress.duration > 0) {
      livePct = Math.min(100, (videoProgress.currentTime / videoProgress.duration) * 100);
    }
  } else if (isMangoLesson) {
    const totalSec = (currentContent?.duration_minutes || 5) * 60;
    livePct = totalSec > 0 ? Math.min(100, (mangoElapsed / totalSec) * 100) : 0;
  } else if (isCardLesson) {
    // 카드형 콘텐츠는 즉시 완료 표시 가능
    livePct = 100;
  } else {
    // 추적 불가능한 콘텐츠 (외부 자료 등)는 즉시 완료 표시 허용
    livePct = 100;
  }
  const savedPct = currentProgress?.progress_percentage ?? 0;
  const effectivePct = Math.max(livePct, savedPct);
  const canMarkComplete = effectivePct >= completionThresholdPct;

  useEffect(() => {
    if (mangoAutoCompleted && !currentProgress?.completed && mangoPopupOpen) {
      markCompleteMutation.mutate();
    }
  }, [mangoAutoCompleted]);

  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      const existing = currentProgress;
      if (existing) {
        const { error } = await supabase.from("content_progress").update({ completed: true, completed_at: new Date().toISOString(), progress_percentage: 100 }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("content_progress").insert({ user_id: user!.id, content_id: contentId!, completed: true, completed_at: new Date().toISOString(), progress_percentage: 100 });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-progress", courseId] });
      toast({ title: t("course.completed"), description: t("course.learningComplete") });
    },
  });

  const normalizeMangoboardUrl = (url: string) => {
    let normalized = url.trim();
    if (!normalized.startsWith("http")) normalized = "https://" + normalized;
    return normalized;
  };

  const isKollus = (provider: string | null) => provider === "kollus";

  const getBunnyGuid = (content: any, url: string | null): string | null => {
    if (content?.bunny_video_guid) return content.bunny_video_guid;
    if (url?.startsWith("bunny://")) return url.replace("bunny://", "").trim();
    return null;
  };
  const isBunny = (content: any, provider: string | null, url: string | null) =>
    provider === "bunny" || !!getBunnyGuid(content, url);

  // Fetch Kollus embed URL when content changes
  useEffect(() => {
    if (!currentContent || !user?.id) return;
    const provider = getVideoProvider(currentContent);
    const videoUrl = getVideoUrl(currentContent);
    if (!isKollus(provider) || !videoUrl) {
      setKollusEmbedUrl(null);
      return;
    }
    let cancelled = false;
    setKollusLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("kollus-token", {
          body: { media_content_key: videoUrl },
        });
        if (!cancelled && !error && data?.embed_url) {
          setKollusEmbedUrl(data.embed_url);
        }
      } catch (e) {
        console.error("Kollus token error:", e);
      } finally {
        if (!cancelled) setKollusLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentContent?.id, user?.id]);

  // Fetch Bunny Stream signed embed URL when content changes
  useEffect(() => {
    if (!currentContent || !user?.id) return;
    const provider = getVideoProvider(currentContent);
    const videoUrl = getVideoUrl(currentContent);
    const guid = getBunnyGuid(currentContent, videoUrl);
    if (!isBunny(currentContent, provider, videoUrl) || !guid) {
      setBunnyEmbedUrl(null);
      setBunnyTokenExpiresAt(null);
      return;
    }
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    // Only show loading skeleton on the initial fetch — token refreshes
    // happen mid-playback and must NOT unmount the player iframe.
    let isInitialFetch = true;

    const fetchSignedBunnyUrl = async () => {
      if (isInitialFetch) setBunnyLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("bunny-stream-token", {
          body: { video_guid: guid },
        });
        if (!cancelled && !error && data?.embed_url) {
          // Only set the embed URL on the initial fetch. Re-assigning
          // it on token refresh would change the iframe `src` and force
          // the player to reload mid-playback, blocking interactions.
          if (isInitialFetch) {
            setBunnyEmbedUrl(data.embed_url);
          }
          setBunnyTokenExpiresAt(data.expires ?? null);
          const refreshInMs = data.expires
            ? Math.max((Number(data.expires) - Math.floor(Date.now() / 1000) - 120) * 1000, 60_000)
            : 50 * 60 * 1000;
          refreshTimer = setTimeout(fetchSignedBunnyUrl, refreshInMs);
        }
      } catch (e) {
        console.error("Bunny token error:", e);
      } finally {
        if (!cancelled && isInitialFetch) {
          setBunnyLoading(false);
          isInitialFetch = false;
        }
      }
    };

    // Reset embed URL only on content change (initial fetch). On token
    // refresh we keep the previous URL so the player keeps playing until
    // the new signed URL is received (and even then we avoid remount).
    setBunnyEmbedUrl(null);
    setBunnyTokenExpiresAt(null);
    fetchSignedBunnyUrl();

    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [currentContent?.id, user?.id]);

  // Bunny 인코딩 상태 폴링 — 인코딩 중이면 Bunny가 "Processing video" 화면을 보여주므로
  // 우리 안내 화면으로 덮고, 완료되면 자동으로 플레이어를 노출한다.
  useEffect(() => {
    if (!currentContent || !user?.id) return;
    const provider = getVideoProvider(currentContent);
    const videoUrl = getVideoUrl(currentContent);
    const guid = getBunnyGuid(currentContent, videoUrl);
    if (!isBunny(currentContent, provider, videoUrl) || !guid) {
      setBunnyEncoding(false);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const check = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("bunny-stream-info", {
          body: { video_guid: guid },
        });
        if (cancelled) return;
        if (error || data?.fallback) {
          setBunnyEncoding(false);
          return;
        }
        const status = Number(data?.status ?? 4);
        const ready = status >= 3; // 3=재생 가능(부분), 4=완료, 5=해상도 최종
        setBunnyEncoding(!ready);
        if (!ready) timer = setTimeout(check, 15000);
      } catch {
        if (!cancelled) setBunnyEncoding(false);
      }
    };
    check();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [currentContent?.id, user?.id]);

  const getVideoEmbed = (url: string | null, provider: string | null) => {
    if (!url && !currentContent?.bunny_video_guid) return null;
    if (url && isMangoboard(url)) return normalizeMangoboardUrl(url);
    if (isKollus(provider)) return kollusEmbedUrl;
    if (isBunny(currentContent, provider, url)) return bunnyEmbedUrl;

    const resolvedYouTubeId = url ? getYouTubeVideoId(url) : null;
    if (url && (provider === "youtube" || url.includes("youtube.com") || url.includes("youtu.be")) && resolvedYouTubeId) {
      const params = new URLSearchParams({
        enablejsapi: "1",
        rel: "0",
        modestbranding: "1",
        ...(resumeChoice === "resume" && videoProgress.resumePosition > 0 && !currentProgress?.completed
          ? { start: String(videoProgress.resumePosition) }
          : {}),
      });
      return `https://www.youtube.com/embed/${resolvedYouTubeId}?${params.toString()}`;
    }

    const resolvedVimeoId = url ? getVimeoVideoId(url) : null;
    if (url && (provider === "vimeo" || url.includes("vimeo.com")) && resolvedVimeoId) {
      const shouldResume =
        resumeChoice === "resume" &&
        videoProgress.resumePosition > 0 &&
        !currentProgress?.completed;
      return shouldResume
        ? `https://player.vimeo.com/video/${resolvedVimeoId}#t=${Math.round(videoProgress.resumePosition)}s`
        : `https://player.vimeo.com/video/${resolvedVimeoId}`;
    }

    return url;
  };

  const handleClose = () => {
    navigate(`${routePrefix}/courses/${courseId}?view=learn`);
  };

  // B2C access guard: non-enrolled users can only view preview content
  useEffect(() => {
    if (!course?.is_b2c) return;
    if (!currentContent || currentContent.is_preview) return;
    // Only enforce after enrollment query has resolved to avoid false negatives during loading
    if (b2cEnrollmentLoading || !b2cEnrollmentFetched) return;
    if (!b2cEnrollment) {
      toast({ title: "수강 신청 후 이용 가능합니다", description: "해당 콘텐츠는 수강 등록이 필요합니다." });
      navigate(`/store/courses/${courseId}`);
    }
  }, [course?.is_b2c, currentContent?.id, b2cEnrollment, b2cEnrollmentLoading, b2cEnrollmentFetched]);

  if (!currentContent) {
    return (
      <div className="fixed inset-0 z-[60] bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">{t("course.contentNotFound")}</p>
          <Button variant="outline" onClick={handleClose}>{t("course.backToCourse")}</Button>
        </div>
      </div>
    );
  }

  const localTitle = getTitle(currentContent);
  const localDesc = getDescription(currentContent);
  const localVideoUrl = getVideoUrl(currentContent);
  const localProvider = getVideoProvider(currentContent);
  const embedUrl = getVideoEmbed(localVideoUrl, localProvider);

  return (
    <div
      className="fixed inset-0 z-[60] bg-background flex flex-col"
      style={{
        height: "100dvh",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <ContentProtection />
      {/* Top header */}
      <header className="flex items-center gap-3 sm:gap-4 px-4 lg:px-6 h-14 border-b border-border bg-background shrink-0">
        <button onClick={handleClose} className="p-2 rounded-lg hover:bg-accent text-muted-foreground transition-colors" title={t("common.close")}>
          <X className="h-5 w-5" />
        </button>
        <div className="h-6 w-px bg-border hidden sm:block" />
        <Badge
          variant="secondary"
          className="text-sm font-bold px-3 py-1 max-w-[40%] sm:max-w-[50%] whitespace-nowrap overflow-hidden text-ellipsis block"
          title={getCourseTitle()}
        >
          {getCourseTitle()}
        </Badge>
        <div className="flex items-center gap-3 ml-auto shrink-0">
          <button onClick={() => setMobileCurriculumOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-accent text-muted-foreground transition-colors" title={t("course.learningProgress")}>
            <List className="h-5 w-5" />
          </button>
          <span className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground text-base">{currentIndex + 1}</span> / {contents.length} {t("course.lesson")}
          </span>
          <Progress value={overallProgress} className="w-28 h-2 hidden sm:block" />
          <span className="text-sm font-bold text-foreground">{overallProgress}%</span>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 py-6 lg:px-8 lg:py-8">
            {/* Media area */}
            <div className="bg-foreground/5 rounded-2xl overflow-hidden mb-6 relative">
              {isCardContent(currentContent.description) ? (() => {
                const urls = getCardUrls(currentContent.description, localVideoUrl);
                const totalCards = urls.length;
                const currentUrl = urls[cardIndex] || urls[0] || "";
                const isImage = currentUrl.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i);
                return (
                  <div className="flex flex-col items-center py-6 space-y-4">
                    {/* Card display */}
                    <div className="relative w-72 sm:w-80">
                      <div className="rounded-2xl overflow-hidden border border-border shadow-lg" style={{ aspectRatio: "9/16" }}>
                        {isImage ? (
                          <img src={currentUrl} alt={`${localTitle} - ${cardIndex + 1}/${totalCards}`} className="w-full h-full object-cover" />
                        ) : currentUrl ? (
                          <iframe src={currentUrl} className="w-full h-full" title={`${localTitle} - ${cardIndex + 1}`} allowFullScreen />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">{t("contentPlayer.noCard", "카드 없음")}</div>
                        )}
                      </div>

                      {/* Navigation arrows */}
                      {totalCards > 1 && (
                        <>
                          <button
                            onClick={() => setCardIndex(Math.max(0, cardIndex - 1))}
                            disabled={cardIndex === 0}
                            aria-label={t("common.previous", "이전")}
                            className="absolute left-[-40px] top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 border border-border shadow flex items-center justify-center disabled:opacity-30 hover:bg-background transition-colors"
                          >
                            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => setCardIndex(Math.min(totalCards - 1, cardIndex + 1))}
                            disabled={cardIndex === totalCards - 1}
                            aria-label={t("common.next", "다음")}
                            className="absolute right-[-40px] top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 border border-border shadow flex items-center justify-center disabled:opacity-30 hover:bg-background transition-colors"
                          >
                            <ChevronRight className="h-5 w-5" aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>

                    {/* Card indicator */}
                    {totalCards > 1 && (
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1.5">
                          {urls.map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setCardIndex(i)}
                              aria-label={t("contentPlayer.goToCard", { n: i + 1, defaultValue: `카드 ${i + 1}` })}
                              aria-current={i === cardIndex ? "true" : undefined}
                              className={`h-2 rounded-full transition-all ${i === cardIndex ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"}`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">{cardIndex + 1} / {totalCards}</span>
                      </div>
                    )}
                  </div>
                );
              })() : isMangoboard(localVideoUrl) && embedUrl ? (
                <button
                  onClick={() => setMangoPopupOpen(true)}
                  aria-label={t("course.startLearning")}
                  className="relative aspect-video w-full flex items-center justify-center group cursor-pointer bg-gradient-to-br from-blue-500/10 to-indigo-500/10"
                >
                  <div className="text-center space-y-4">
                    <div className="h-20 w-20 rounded-full bg-primary/90 group-hover:bg-primary mx-auto flex items-center justify-center transition-all group-hover:scale-110 shadow-lg">
                      <Play className="h-8 w-8 text-primary-foreground ml-1" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-foreground">{t("course.startLearning")}</p>
                      <p className="text-sm text-muted-foreground mt-1">{t("course.clickToLearn")}</p>
                    </div>
                  </div>
                </button>
              ) : currentContent.content_type === "video" && embedUrl ? (
                <div className="relative" key={`video-wrap-${contentId}`}>
                  <div ref={videoContainerRef} className="aspect-video w-full relative bg-black group/video">
                    <iframe
                      key={`video-${contentId}-${resumeChoice === "resume" ? "resume" : "initial"}`}
                      ref={isTrackableVideo ? videoIframeCallback : undefined}
                      id={`video-player-${contentId}`}
                      src={embedUrl}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen *"
                      allowFullScreen
                      referrerPolicy="no-referrer-when-downgrade"
                      title={localTitle}
                    />
                    {bunnyEncoding && (
                      <div className="absolute inset-0 z-30 flex items-center justify-center bg-background">
                        <div className="text-center space-y-4 px-6">
                          <div className="mx-auto h-12 w-12 rounded-full border-4 border-primary/25 border-t-primary animate-spin" />
                          <div className="space-y-1.5">
                            <p className="text-base font-semibold text-foreground">영상 변환(인코딩) 중입니다</p>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              업로드된 영상을 재생용으로 변환하고 있습니다. 보통 영상 길이의 20~50% 정도 시간이 걸리며,
                              완료되면 이 화면이 자동으로 플레이어로 바뀝니다.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {resumeDialogOpen && (
                      <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-3 sm:p-0">
                        <div
                          role="alertdialog"
                          aria-modal="true"
                          aria-labelledby="resume-dialog-title"
                          aria-describedby="resume-dialog-desc"
                          className="w-full max-w-[18rem] sm:max-w-md rounded-lg bg-background p-4 sm:p-6 shadow-2xl"
                        >
                          <h3 id="resume-dialog-title" className="text-sm sm:text-lg font-semibold text-foreground">
                            {t("contentPlayer.resumeDialogTitle")}
                          </h3>
                          <p id="resume-dialog-desc" className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                            {t("contentPlayer.resumeDialogDescription", {
                              time: formatTime(videoProgress.resumePosition || 0),
                            })}
                          </p>
                          <div className="mt-4 sm:mt-6 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setResumeChoice("restart");
                                setResumeDialogOpen(false);
                                videoProgress.seekTo(0);
                              }}
                              className="h-8 sm:h-10 rounded-md border border-input bg-background px-3 sm:px-4 text-xs sm:text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                            >
                              {t("contentPlayer.resumeRestart")}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setResumeChoice("resume");
                                setResumeDialogOpen(false);
                              }}
                              className="h-8 sm:h-10 rounded-md bg-primary px-3 sm:px-4 text-xs sm:text-sm font-medium text-primary-foreground hover:bg-primary/90"
                            >
                              {t("contentPlayer.resumeContinue")}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {kollusLoading && (
                    <div className="absolute inset-0">
                      <VideoPlayerSkeleton />
                    </div>
                  )}
                  {isTrackableVideo && (
                    <div className="px-4 py-2.5 bg-secondary/60 flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground shrink-0">{t("contentPlayer.watchProgress")}</span>
                      <Progress value={videoProgress.duration > 0 ? (videoProgress.currentTime / videoProgress.duration) * 100 : (currentProgress?.progress_percentage || 0)} className="h-1.5 flex-1" />
                      <span className="text-muted-foreground font-medium shrink-0">
                        {videoProgress.duration > 0
                          ? `${formatTime(videoProgress.currentTime)} / ${formatTime(videoProgress.duration)}`
                          : `${Math.round(currentProgress?.progress_percentage || 0)}%`}
                      </span>
                      {videoProgress.resumePosition > 0 && !currentProgress?.completed && (
                        <Badge variant="outline" className="text-[10px] gap-1 shrink-0">
                          <RotateCcw className="h-3 w-3" />
                          {t("contentPlayer.resumeFrom", { time: formatTime(videoProgress.resumePosition) })}
                        </Badge>
                      )}
                      {!currentProgress?.completed && (
                        <span className="text-[10px] text-muted-foreground/70 shrink-0">{t("contentPlayer.autoCompleteAt80")}</span>
                      )}
                    </div>
                  )}
                </div>
              ) : kollusLoading || bunnyLoading ? (
                <VideoPlayerSkeleton />
              ) : currentContent.content_type === "video" && localVideoUrl ? (
                <div className="aspect-video w-full flex items-center justify-center">
                  <a href={localVideoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-base text-muted-foreground hover:text-foreground transition-colors">
                    <ExternalLink className="h-5 w-5" /> {t("course.openExternal")}
                  </a>
                </div>
              ) : (
                <div className="aspect-video w-full flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <div className="h-16 w-16 rounded-2xl bg-accent mx-auto flex items-center justify-center">
                      {currentContent.content_type === "document" ? <FileText className="h-7 w-7 text-accent-foreground" /> : <Play className="h-7 w-7 text-accent-foreground" />}
                    </div>
                    <p className="text-base text-muted-foreground">{contentTypeLabel[currentContent.content_type || "video"]}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Content info - Toss-style clean sections */}
            <div className="space-y-6 mt-2">

              {/* 과정 · 차시 · 학습상태 한줄 통합 */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Content source badge */}
                {(() => {
                  const url = localVideoUrl;
                  const provider = currentContent.video_provider;
                  let sourceLabel = "";
                  let sourceColor = "";
                  if (isMangoboard(url)) {
                    sourceLabel = "Mangoboard";
                    sourceColor = "bg-blue-500 text-white";
                  } else if (provider === "youtube" || url?.includes("youtube.com") || url?.includes("youtu.be")) {
                    sourceLabel = "YouTube";
                    sourceColor = "bg-rose-500 text-white";
                  } else if (provider === "vimeo" || url?.includes("vimeo.com")) {
                    sourceLabel = "Vimeo";
                    sourceColor = "bg-sky-500 text-white";
                  } else if (provider === "upload") {
                    sourceLabel = "CDN";
                    sourceColor = "bg-emerald-500 text-white";
                  } else if ((provider as string) === "bunny" || (currentContent as any)?.bunny_video_guid) {
                    sourceLabel = "CDN Stream";
                    sourceColor = "bg-orange-500 text-white";
                  } else if (provider === "custom" && !isMangoboard(url)) {
                    sourceLabel = t("createCourse.customInput");
                    sourceColor = "bg-amber-500 text-white";
                  }
                  return sourceLabel ? (
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md shrink-0 ${sourceColor}`}>
                      {sourceLabel}
                    </span>
                  ) : null;
                })()}
                <h2
                  className="text-base sm:text-lg font-bold text-foreground tracking-tight border-b-2 border-foreground/80 pb-0.5 min-w-0 break-words [overflow-wrap:anywhere] basis-full sm:basis-auto sm:shrink"
                  title={localTitle}
                >
                  {localTitle}
                </h2>
                <Badge variant="outline" className="text-xs font-semibold px-2.5 py-1 rounded-lg uppercase tracking-wider shrink-0">
                  {contentTypeLabel[currentContent.content_type || "video"]}
                </Badge>
                {currentContent.duration_minutes && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground shrink-0">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="font-medium">{formatDurationMs(currentContent.duration_minutes)}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  {currentProgress?.completed ? (
                    <Badge variant="outline" className="text-xs font-semibold px-3 py-1.5 rounded-xl border-green-300 bg-emerald-500 text-white dark:bg-emerald-500 dark:text-white dark:border-green-700 dark:bg-green-900/30 dark:text-green-400 gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t("course.alreadyCompleted")}
                    </Badge>
                  ) : user ? (
                    <Badge variant="outline" className="text-xs font-semibold px-3 py-1.5 rounded-xl gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {t("course.inProgress")} {Math.round(currentProgress?.progress_percentage || 0)}%
                    </Badge>
                  ) : null}
                </div>
              </div>


              {/* Notes & Up Next — fills empty space below the player */}
              {contentId && courseId && routePrefix === "/student" && (
                <LessonExtras
                  contentId={contentId}
                  courseId={courseId}
                  routePrefix={routePrefix}
                  nextContent={
                    nextContent
                      ? {
                          id: nextContent.id,
                          title: (isEn
                            ? (contentI18nData as any[]).find(
                                (r: any) => r.content_id === nextContent.id && r.language_code === "en",
                              )?.title
                            : null) || nextContent.title,
                          duration_minutes: nextContent.duration_minutes,
                          content_type: nextContent.content_type,
                          video_provider: nextContent.video_provider,
                          video_url: nextContent.video_url,
                        }
                      : null
                  }
                  isLocked={
                    !!(course as any)?.is_sequential && !currentProgress?.completed
                  }
                  nextIndex={nextContent ? currentIndex + 2 : undefined}
                  totalCount={contents.length}
                  overallProgress={overallProgress}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right sidebar - curriculum panel */}
        <aside className={`hidden lg:flex flex-col border-l border-border bg-card transition-all duration-300 ${sidebarOpen ? "w-96 mr-4" : "w-0 overflow-hidden"}`}>
          {sidebarOpen && (
            <>
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{t("course.learningProgress")}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{completedCount} / {contents.length} {t("course.completed")}</p>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span>{t("course.progress")}</span>
                  <span className="font-semibold text-foreground">{overallProgress}%</span>
                </div>
                <Progress value={overallProgress} className="h-2" />
              </div>
              <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {contents.map((c, idx) => {
                  const isActive = c.id === contentId;
                  const isCompleted = progressMap.get(c.id)?.completed;
                  return (
                    <button
                      key={c.id}
                      ref={isActive ? activeItemRef : undefined}
                      onClick={() => navigate(`${routePrefix}/courses/${courseId}/content/${c.id}`)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 text-sm transition-all ${isActive ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/20" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"}`}
                    >
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-medium ${isCompleted ? "bg-green-500 text-white" : isActive ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>
                        {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
                      </div>
                      <span className="truncate flex-1">{getTitle(c)}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${c.video_provider === "custom" ? "bg-sky-500 text-white dark:bg-sky-500 dark:text-white" : "bg-rose-500 text-white dark:bg-rose-500 dark:text-white"}`}>
                          {c.video_provider === "custom" ? t("course.flip") : t("course.video")}
                        </span>
                        {c.duration_minutes && <span className="text-[10px] text-muted-foreground">{formatDurationMs(c.duration_minutes)}</span>}
                      </div>
                    </button>
                  );
                })}
              </nav>
            </>
          )}
        </aside>

        {/* Sidebar toggle when closed */}
        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)} className="hidden lg:flex items-center gap-1 absolute right-4 top-20 z-30 px-3 py-2 bg-primary text-primary-foreground border border-border rounded-xl hover:bg-primary/90 transition-colors shadow-sm">
            <List className="h-4 w-4" />
            <span className="text-xs font-medium">{t("course.learningProgress")}</span>
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Mangoboard Popup */}
      {mangoPopupOpen && currentContent && isMangoboard(localVideoUrl) && embedUrl && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center">
          <button onClick={() => setMangoPopupOpen(false)} className="absolute top-4 right-4 z-[110] p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
            <X className="h-6 w-6" />
          </button>
          <div className="absolute top-4 left-4 right-16 z-[110]">
            <div className="flex items-center gap-3 bg-black/60 backdrop-blur-sm rounded-xl px-4 py-2.5">
              <Clock className="h-4 w-4 text-white/70 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between text-[11px] text-white/80 mb-1">
                  <span>{t("contentPlayer.learningTime")}</span>
                  <span>
                    {Math.floor(mangoElapsed / 60)}:{String(mangoElapsed % 60).padStart(2, "0")}
                    {" / "}
                    {Math.floor(requiredSeconds / 60)}:{String(Math.round(requiredSeconds % 60)).padStart(2, "0")}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-1000 ${mangoAutoCompleted ? "bg-green-400" : "bg-white/70"}`} style={{ width: `${Math.min((mangoElapsed / requiredSeconds) * 100, 100)}%` }} />
                </div>
              </div>
              {mangoAutoCompleted && <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />}
            </div>
          </div>
          <div className="w-[95vw] h-[calc(95vh-60px)] sm:h-[95vh] sm:w-auto" style={{ aspectRatio: window.innerWidth < 640 ? undefined : "9/16", maxWidth: "95vw" }}>
            <iframe
              src={embedUrl}
              className="w-full h-full border-0 rounded-lg"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation"
              referrerPolicy="no-referrer-when-downgrade"
              title={localTitle}
              style={{ WebkitOverflowScrolling: 'touch' }}
            />
          </div>
        </div>
      )}
      {/* Mobile curriculum drawer */}
      <Drawer open={mobileCurriculumOpen} onOpenChange={setMobileCurriculumOpen}>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-base">{t("course.learningProgress")}</DrawerTitle>
            <p className="text-xs text-muted-foreground">{completedCount} / {contents.length} {t("course.completed")} · {overallProgress}%</p>
            <Progress value={overallProgress} className="h-2 mt-2" />
          </DrawerHeader>
          <ScrollArea className="flex-1 px-4 pb-4 max-h-[55vh]">
            <div className="space-y-0.5">
              {contents.map((c, idx) => {
                const isActive = c.id === contentId;
                const isCompleted = progressMap.get(c.id)?.completed;
                return (
                  <button
                    key={c.id}
                    onClick={() => { setMobileCurriculumOpen(false); navigate(`${routePrefix}/courses/${courseId}/content/${c.id}`); }}
                    className={`w-full text-left px-3 py-3 rounded-xl flex items-center gap-3 text-sm transition-all ${isActive ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/20" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"}`}
                  >
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-medium ${isCompleted ? "bg-green-500 text-white" : isActive ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>
                      {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                    </div>
                    <span className="truncate flex-1">{getTitle(c)}</span>
                    {c.duration_minutes && <span className="text-[11px] text-muted-foreground shrink-0">{formatDurationMs(c.duration_minutes)}</span>}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      {contentId && (
        <ContentCommentsTrigger contentId={contentId} courseId={courseId} />
      )}
    </div>
  );
};

export default ContentPlayer;
