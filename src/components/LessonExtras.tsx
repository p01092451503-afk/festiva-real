import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  NotebookPen,
  PlayCircle,
  Sparkles,
  CheckCircle2,
  Video,
  FileText,
  Layers,
  GraduationCap,
  MessageCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LessonSummaryPanel } from "@/components/LessonSummaryPanel";
import { LessonTutorPanel } from "@/components/LessonTutorPanel";
import { cn } from "@/lib/utils";

type NextContent = {
  id: string;
  title: string;
  duration_minutes?: number | null;
  content_type?: string | null;
  video_provider?: string | null;
  video_url?: string | null;
} | null;

interface LessonExtrasProps {
  contentId: string;
  courseId: string;
  routePrefix: string;
  nextContent: NextContent;
  isLocked?: boolean;
  className?: string;
  /** 1-based index of the next lesson within the course. */
  nextIndex?: number;
  /** Total number of lessons in the course. */
  totalCount?: number;
  /** Overall course progress percentage (0-100). */
  overallProgress?: number;
}

// Map a content/provider to a presentation badge.
const getContentBadge = (
  content_type?: string | null,
  video_provider?: string | null,
) => {
  if (content_type === "card") {
    return {
      Icon: Layers,
      labelKey: "lessonExtras.badge.card",
      labelFallback: "카드",
      cls: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    };
  }
  if (content_type === "assessment") {
    return {
      Icon: GraduationCap,
      labelKey: "lessonExtras.badge.assessment",
      labelFallback: "평가",
      cls: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
    };
  }
  if (content_type === "document" || content_type === "pdf") {
    return {
      Icon: FileText,
      labelKey: "lessonExtras.badge.document",
      labelFallback: "자료",
      cls: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
    };
  }
  if (video_provider === "custom") {
    return {
      Icon: Video,
      labelKey: "lessonExtras.badge.flipLearning",
      labelFallback: "플립러닝",
      cls: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
    };
  }
  return {
    Icon: Video,
    labelKey: "lessonExtras.badge.video",
    labelFallback: "동영상",
    cls: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  };
};

// Try to extract a YouTube thumbnail from a video URL.
const getYouTubeThumb = (url?: string | null): string | null => {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([\w-]{11})/,
  );
  return m ? `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` : null;
};

export const LessonExtras = ({
  contentId,
  courseId,
  routePrefix,
  nextContent,
  isLocked = false,
  className,
  nextIndex,
  totalCount,
  overallProgress,
}: LessonExtrasProps) => {
  const { t } = useTranslation();
  const { user } = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [note, setNote] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");

  // Load existing note for this lesson.
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setNote("");
    setSavedAt(null);
    lastSavedRef.current = "";

    if (!user?.id || !contentId) {
      setLoaded(true);
      return;
    }

    (async () => {
      const { data } = await supabase
        .from("lesson_notes")
        .select("note, updated_at")
        .eq("user_id", user.id)
        .eq("content_id", contentId)
        .maybeSingle();
      if (cancelled) return;
      const text = data?.note ?? "";
      setNote(text);
      lastSavedRef.current = text;
      if (data?.updated_at) setSavedAt(new Date(data.updated_at));
      setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, contentId]);

  // Debounced auto-save.
  useEffect(() => {
    if (!loaded || !user?.id || !contentId) return;
    if (note === lastSavedRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaving(true);
      const trimmed = note.trim();
      let error;
      if (trimmed.length === 0) {
        // Empty note → remove the row entirely so it disappears from
        // the "My Notes" list instead of lingering as a blank entry.
        ({ error } = await supabase
          .from("lesson_notes")
          .delete()
          .eq("user_id", user.id)
          .eq("content_id", contentId));
      } else {
        ({ error } = await supabase
          .from("lesson_notes")
          .upsert(
            { user_id: user.id, content_id: contentId, note },
            { onConflict: "user_id,content_id" },
          ));
      }
      setSaving(false);
      if (!error) {
        lastSavedRef.current = note;
        setSavedAt(new Date());
        // Refresh the "My Notes" page so deletions/edits show up immediately.
        queryClient.invalidateQueries({ queryKey: ["my-lesson-notes", user.id] });
      }
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [note, loaded, user?.id, contentId, queryClient]);

  const savedLabel = useMemo(() => {
    if (saving) return t("contentPlayer.notesSaving");
    if (!savedAt) return null;
    const time = savedAt.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    return t("contentPlayer.notesSavedAt", { time });
  }, [saving, savedAt, t]);

  const charCount = note.length;
  const NOTE_MAX = 2000;

  return (
    <section
      className={cn("mt-4 grid grid-cols-1 lg:grid-cols-5 gap-3 sm:gap-4 items-start", className)}
      aria-label={t("contentPlayer.notes")}
    >
      {/* Notes */}
      <div className="lg:col-span-3 rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm">
        <Tabs defaultValue="notes" className="w-full">
          <TabsList className="grid grid-cols-3 w-full mb-3">
            <TabsTrigger value="notes" className="gap-1.5 text-sm">
              <NotebookPen className="h-3.5 w-3.5" />
              {t("contentPlayer.notes")}
            </TabsTrigger>
            <TabsTrigger value="summary" className="gap-1.5 text-sm">
              <Sparkles className="h-3.5 w-3.5" />
              AI 요약
            </TabsTrigger>
            <TabsTrigger value="tutor" className="gap-1.5 text-sm">
              <MessageCircle className="h-3.5 w-3.5" />
              AI 튜터
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="mt-0 space-y-2">
            {savedLabel && (
              <div
                className={cn(
                  "flex items-center gap-1 text-[11px]",
                  saving ? "text-muted-foreground" : "text-emerald-600 dark:text-emerald-400",
                )}
                aria-live="polite"
              >
                {!saving && <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
                {savedLabel}
              </div>
            )}
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
              placeholder={t("contentPlayer.notesPlaceholder")}
              className="min-h-[120px] sm:min-h-[140px] resize-y text-sm leading-relaxed"
              maxLength={NOTE_MAX}
              aria-label={t("contentPlayer.notes")}
              onFocus={(e) => {
                const el = e.currentTarget;
                window.setTimeout(() => {
                  try {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                  } catch {
                    el.scrollIntoView();
                  }
                }, 300);
              }}
            />
            <div className="flex justify-end text-[11px] text-muted-foreground tabular-nums">
              {charCount} / {NOTE_MAX}
            </div>
          </TabsContent>

          <TabsContent value="summary" className="mt-0">
            <LessonSummaryPanel contentId={contentId} />
          </TabsContent>

          <TabsContent value="tutor" className="mt-0">
            <LessonTutorPanel contentId={contentId} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Up next / completion card */}
      <div className="lg:col-span-2">
        {nextContent ? (
          (() => {
            const badge = getContentBadge(nextContent.content_type, nextContent.video_provider);
            const thumb = getYouTubeThumb(nextContent.video_url);
            const isFinal =
              typeof nextIndex === "number" &&
              typeof totalCount === "number" &&
              nextIndex === totalCount;
            const positionLabel =
              typeof nextIndex === "number" && typeof totalCount === "number"
                ? `${nextIndex} / ${totalCount}`
                : null;
            return (
          <button
            type="button"
            onClick={() =>
              !isLocked &&
              navigate(`${routePrefix}/courses/${courseId}/content/${nextContent.id}`)
            }
            disabled={isLocked}
            className={cn(
              "group relative w-full text-left rounded-2xl border border-border bg-gradient-to-br from-card to-violet-500/[0.04] p-4 sm:p-5 shadow-sm h-full flex flex-col justify-between gap-3 transition-all overflow-hidden",
              !isLocked && "hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5",
              isLocked && "opacity-60 cursor-not-allowed",
            )}
            aria-label={`${t("contentPlayer.upNext")}: ${nextContent.title}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-300 shrink-0">
                  <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground truncate">
                  {isFinal ? t("contentPlayer.lastLesson") : t("contentPlayer.upNext")}
                </h3>
                {positionLabel && (
                  <span className="text-[11px] font-medium text-muted-foreground/80 tabular-nums shrink-0">
                    · {positionLabel}
                  </span>
                )}
              </div>
              <ChevronRight
                className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-1 transition-transform group-hover:translate-x-1"
                aria-hidden="true"
              />
            </div>

            <div className="flex items-stretch gap-3 min-w-0">
              {/* Thumbnail or icon tile */}
              <div className="relative h-16 w-24 sm:h-20 sm:w-28 shrink-0 rounded-lg overflow-hidden bg-muted">
                {thumb ? (
                  <img
                    src={thumb}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className={cn("absolute inset-0 flex items-center justify-center", badge.cls)}>
                    <badge.Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              <div className="min-w-0 flex flex-col justify-center gap-1.5">
                <span className={cn("inline-flex items-center gap-1 self-start rounded-full px-2 py-0.5 text-[10px] font-semibold", badge.cls)}>
                  <badge.Icon className="h-3 w-3" aria-hidden="true" />
                  {t(badge.labelKey, badge.labelFallback)}
                </span>
                <p className="text-sm sm:text-base font-semibold text-foreground line-clamp-2 leading-snug">
                  {nextContent.title}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {nextContent.duration_minutes
                    ? `${nextContent.duration_minutes}${t("common.minutes")}`
                    : t("contentPlayer.upNextHint")}
                </p>
              </div>
            </div>

            {typeof overallProgress === "number" && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{t("contentPlayer.courseProgress")}</span>
                  <span className="font-semibold text-foreground tabular-nums">{overallProgress}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-primary transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, overallProgress))}%` }}
                  />
                </div>
              </div>
            )}
          </button>
            );
          })()
        ) : (
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm h-full flex flex-col justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 shrink-0">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("contentPlayer.lastLesson")}
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {t("contentPlayer.lastLessonHint")}
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default LessonExtras;