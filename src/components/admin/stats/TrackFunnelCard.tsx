import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layers, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TrackRow { id: string; name: string; name_en: string | null }
interface StepRow {
  id: string;
  track_id: string;
  name: string;
  name_en: string | null;
  level_order: number;
}
interface StepCourseRow { step_id: string; course_id: string; is_required: boolean }
interface EnrollRow { user_id: string; course_id: string; progress: number | null; completed_at: string | null }

/**
 * Step-by-step funnel chart for a single learning track. Shows how many
 * unique learners completed every required course up to and including each
 * step, so admins can see where students drop off.
 */
export default function TrackFunnelCard() {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const [trackId, setTrackId] = useState<string | undefined>(undefined);

  const { data: tracks = [] } = useQuery({
    queryKey: ["admin-track-funnel-tracks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_tracks")
        .select("id, name, name_en")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as TrackRow[];
    },
    staleTime: 60_000,
  });

  // Default to the first track once loaded.
  const activeTrackId = trackId ?? tracks[0]?.id;

  const { data: steps = [] } = useQuery({
    queryKey: ["admin-track-funnel-steps", activeTrackId],
    enabled: !!activeTrackId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("track_steps")
        .select("id, track_id, name, name_en, level_order")
        .eq("track_id", activeTrackId!)
        .order("level_order");
      if (error) throw error;
      return data as StepRow[];
    },
    staleTime: 60_000,
  });

  const stepIds = steps.map((s) => s.id);
  const { data: stepCourses = [] } = useQuery({
    queryKey: ["admin-track-funnel-step-courses", stepIds.join(",")],
    enabled: stepIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("track_step_courses")
        .select("step_id, course_id, is_required")
        .in("step_id", stepIds);
      if (error) throw error;
      return data as StepCourseRow[];
    },
    staleTime: 60_000,
  });

  // Pull every approved enrollment that touches one of the track's courses.
  const trackCourseIds = Array.from(new Set(stepCourses.filter((sc) => sc.is_required).map((sc) => sc.course_id)));
  const { data: enrollments = [] } = useQuery({
    queryKey: ["admin-track-funnel-enrollments", trackCourseIds.join(",")],
    enabled: trackCourseIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("user_id, course_id, progress, completed_at")
        .eq("status", "approved")
        .in("course_id", trackCourseIds);
      if (error) throw error;
      return data as EnrollRow[];
    },
    staleTime: 60_000,
  });

  // Per-user completed courses set.
  const userDone = new Map<string, Set<string>>();
  enrollments.forEach((e) => {
    if (e.completed_at != null || (Number(e.progress) || 0) >= 100) {
      if (!userDone.has(e.user_id)) userDone.set(e.user_id, new Set());
      userDone.get(e.user_id)!.add(e.course_id);
    }
  });
  // Pool of learners considered for the funnel: any user enrolled in any
  // required course of step 1 (entry).
  const firstStepCourses = new Set(
    stepCourses.filter((sc) => sc.is_required && sc.step_id === steps[0]?.id).map((sc) => sc.course_id),
  );
  const entryLearners = new Set<string>();
  enrollments.forEach((e) => {
    if (firstStepCourses.has(e.course_id)) entryLearners.add(e.user_id);
  });

  // For each step, count learners that completed every required course in
  // every step up to and including this one.
  const cumulativeRequired = new Map<string, Set<string>>();
  let acc = new Set<string>();
  steps.forEach((s) => {
    const next = new Set(acc);
    stepCourses
      .filter((sc) => sc.step_id === s.id && sc.is_required)
      .forEach((sc) => next.add(sc.course_id));
    cumulativeRequired.set(s.id, next);
    acc = next;
  });

  const funnelRows = steps.map((s) => {
    const required = cumulativeRequired.get(s.id) || new Set<string>();
    let passed = 0;
    entryLearners.forEach((uid) => {
      const done = userDone.get(uid) || new Set();
      let all = true;
      for (const cid of required) {
        if (!done.has(cid)) { all = false; break; }
      }
      if (all && required.size > 0) passed += 1;
    });
    return {
      id: s.id,
      name: isEn && s.name_en ? s.name_en : s.name,
      level: s.level_order,
      passed,
    };
  });

  const maxValue = Math.max(entryLearners.size, ...funnelRows.map((r) => r.passed), 1);

  return (
    <Card>
      <CardHeader className="space-y-3 pb-2 px-3 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {isEn ? "Track Step Funnel" : "트랙 단계별 통과 현황"}
          </CardTitle>
          <Select value={activeTrackId} onValueChange={setTrackId}>
            <SelectTrigger className="w-[200px] h-8 text-xs">
              <SelectValue placeholder={isEn ? "Select track" : "트랙 선택"} />
            </SelectTrigger>
            <SelectContent>
              {tracks.map((tr) => (
                <SelectItem key={tr.id} value={tr.id} className="text-xs">
                  {isEn && tr.name_en ? tr.name_en : tr.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
          <Users className="h-3 w-3" aria-hidden="true" />
          {isEn
            ? `Entry learners: ${entryLearners.size}`
            : `입문 단계 진입 학습자: ${entryLearners.size}명`}
        </p>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        {tracks.length === 0 || steps.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {isEn ? "No track steps configured yet." : "구성된 트랙 단계가 없습니다."}
          </p>
        ) : (
          <div className="space-y-2">
            {funnelRows.map((row, idx) => {
              const widthPct = (row.passed / maxValue) * 100;
              const conversion = entryLearners.size > 0
                ? Math.round((row.passed / entryLearners.size) * 100)
                : 0;
              // Light to dark indigo gradient — earlier steps lighter, later steps darker.
              const total = funnelRows.length;
              const ratio = total > 1 ? idx / (total - 1) : 0;
              // Indigo scale: hsl(231, 70%, L%) — L from 78 (light) down to 32 (deep)
              const lightness = 78 - ratio * 46;
              const barColor = `hsl(231, 70%, ${lightness}%)`;
              const textOnBar = lightness < 55 ? "#ffffff" : "#1a1a2e";
              return (
                <div key={row.id} className="flex items-center gap-3">
                  <div className="w-32 shrink-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      <span className="text-muted-foreground mr-1">{idx + 1}.</span>
                      {row.name}
                    </p>
                  </div>
                  <div className="flex-1 h-6 bg-muted/50 rounded-md overflow-hidden relative">
                    <div
                        className="h-full rounded-md transition-all flex items-center px-2"
                        style={{ width: `${widthPct}%`, backgroundColor: barColor }}
                    >
                      {widthPct > 18 && (
                          <span className="text-[10px] font-medium" style={{ color: textOnBar }}>
                          {row.passed}{isEn ? "" : "명"} ({conversion}%)
                        </span>
                      )}
                    </div>
                    {widthPct <= 18 && (
                      <span className="absolute inset-y-0 left-2 flex items-center text-[10px] font-medium text-foreground">
                        {row.passed}{isEn ? "" : "명"} ({conversion}%)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-3">
          {isEn
            ? `${t("common.note", "Note")}: Counts unique learners who completed every required course up to and including each step.`
            : "각 단계까지의 모든 필수 강의를 완료한 고유 학습자 수입니다."}
        </p>
      </CardContent>
    </Card>
  );
}