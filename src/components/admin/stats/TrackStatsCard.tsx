import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Layers, ArrowRight, Users, GraduationCap, BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface TrackRow {
  id: string;
  name: string;
  name_en: string | null;
  is_active: boolean;
  sort_order: number;
}
interface StepRow { id: string; track_id: string }
interface StepCourseRow { step_id: string; course_id: string; is_required: boolean }
interface EnrollRow { user_id: string; course_id: string; progress: number | null; completed_at: string | null }

interface Props {
  /** Layout variant. "compact" hides the description column. */
  variant?: "full" | "compact";
  /** Maximum number of tracks shown before the "View all" link. */
  limit?: number;
}

/**
 * Track-aware aggregate stats card. Lists every active learning track with
 * the number of unique learners enrolled in any of its required courses, the
 * average completion progress across those enrollments, and the number of
 * learners who completed every required course in the track.
 * Reused by /admin and /admin/traffic.
 */
export default function TrackStatsCard({ variant = "full", limit = 5 }: Props) {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");

  const { data: tracks = [] } = useQuery({
    queryKey: ["admin-track-stats-tracks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_tracks")
        .select("id, name, name_en, is_active, sort_order")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as TrackRow[];
    },
    staleTime: 60_000,
  });

  const { data: steps = [] } = useQuery({
    queryKey: ["admin-track-stats-steps"],
    queryFn: async () => {
      const { data, error } = await supabase.from("track_steps").select("id, track_id");
      if (error) throw error;
      return data as StepRow[];
    },
    staleTime: 60_000,
  });

  const { data: stepCourses = [] } = useQuery({
    queryKey: ["admin-track-stats-step-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("track_step_courses")
        .select("step_id, course_id, is_required");
      if (error) throw error;
      return data as StepCourseRow[];
    },
    staleTime: 60_000,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["admin-track-stats-enrollments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("user_id, course_id, progress, completed_at")
        .eq("status", "approved");
      if (error) throw error;
      return data as EnrollRow[];
    },
    staleTime: 60_000,
  });

  // Build trackId -> required courseIds (Set) from steps + step courses.
  const stepToTrack = new Map<string, string>();
  steps.forEach((s) => stepToTrack.set(s.id, s.track_id));
  const trackRequiredCourses = new Map<string, Set<string>>();
  stepCourses.forEach((sc) => {
    if (!sc.is_required) return;
    const trackId = stepToTrack.get(sc.step_id);
    if (!trackId) return;
    if (!trackRequiredCourses.has(trackId)) trackRequiredCourses.set(trackId, new Set());
    trackRequiredCourses.get(trackId)!.add(sc.course_id);
  });

  // Per-user completion map across the required courses.
  const userCourseDone = new Map<string, Set<string>>(); // userId -> done courses
  const userCourseProgress = new Map<string, Map<string, number>>(); // userId -> (courseId -> progress)
  enrollments.forEach((e) => {
    if (!userCourseProgress.has(e.user_id)) userCourseProgress.set(e.user_id, new Map());
    userCourseProgress.get(e.user_id)!.set(e.course_id, Number(e.progress) || 0);
    if (e.completed_at != null || (Number(e.progress) || 0) >= 100) {
      if (!userCourseDone.has(e.user_id)) userCourseDone.set(e.user_id, new Set());
      userCourseDone.get(e.user_id)!.add(e.course_id);
    }
  });

  const rows = tracks.map((tr) => {
    const required = trackRequiredCourses.get(tr.id) || new Set<string>();
    if (required.size === 0) {
      return { id: tr.id, name: isEn && tr.name_en ? tr.name_en : tr.name, learners: 0, avgProgress: 0, completers: 0, courseCount: 0 };
    }
    // Learners = unique users enrolled in any required course of the track
    const learners = new Set<string>();
    let progressSum = 0;
    let progressCount = 0;
    enrollments.forEach((e) => {
      if (required.has(e.course_id)) {
        learners.add(e.user_id);
        progressSum += Number(e.progress) || 0;
        progressCount += 1;
      }
    });
    // Completers = users who completed every required course
    let completers = 0;
    learners.forEach((uid) => {
      const done = userCourseDone.get(uid) || new Set();
      let all = true;
      for (const cid of required) {
        if (!done.has(cid)) { all = false; break; }
      }
      if (all) completers += 1;
    });
    const avgProgress = progressCount > 0 ? Math.round(progressSum / progressCount) : 0;
    return {
      id: tr.id,
      name: isEn && tr.name_en ? tr.name_en : tr.name,
      learners: learners.size,
      avgProgress,
      completers,
      courseCount: required.size,
    };
  });

  const visible = rows.slice(0, limit);
  const compact = variant === "compact";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-6">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {isEn ? "Learning Tracks" : "학습 트랙 현황"}
        </CardTitle>
        <Link to="/admin/tracks">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground">
            {t("common.viewAll")} <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 space-y-3">
        {tracks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {isEn ? "No active learning tracks yet." : "활성화된 학습 트랙이 없습니다."}
          </p>
        ) : (
          <div className="space-y-3">
            {visible.map((row) => (
              <div key={row.id} className="space-y-1.5 pb-3 last:pb-0 border-b border-border/60 last:border-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{row.name}</p>
                    {!compact && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {isEn
                          ? `${row.courseCount} required courses`
                          : `필수 강의 ${row.courseCount}개`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                    <span className="inline-flex items-center gap-1" title={isEn ? "Learners" : "수강자"}>
                      <Users className="h-3 w-3" aria-hidden="true" />
                      {row.learners}
                    </span>
                    <span className="inline-flex items-center gap-1" title={isEn ? "Completers" : "완주자"}>
                      <GraduationCap className="h-3 w-3" aria-hidden="true" />
                      {row.completers}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={row.avgProgress} className="h-1.5 flex-1" />
                  <span className="text-xs text-muted-foreground w-10 text-right">{row.avgProgress}%</span>
                </div>
              </div>
            ))}
            {rows.length === 0 && (
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <BookOpen className="h-3 w-3" aria-hidden="true" />
                {isEn ? "Tracks have no required courses yet." : "트랙에 필수 강의가 등록되지 않았습니다."}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}