import { useMemo, useState, Suspense } from "react";
import { lazyWithRetry as lazy } from "@/lib/lazyWithRetry";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Globe2, Download, ChevronRight, Layers, Users, Trophy, ArrowLeft, GraduationCap, BarChart3, PieChart as PieIcon, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartFallback } from "@/components/PageSkeletons";

// Recharts-heavy charts → lazy load
const CountryCompletionBar = lazy(() =>
  import("@/components/charts/GlobalDashboardCharts").then((m) => ({ default: m.CountryCompletionBar }))
);
const LearnerDistributionDonut = lazy(() =>
  import("@/components/charts/GlobalDashboardCharts").then((m) => ({ default: m.LearnerDistributionDonut }))
);
const CountryQuizCompare = lazy(() =>
  import("@/components/charts/GlobalDashboardCharts").then((m) => ({ default: m.CountryQuizCompare }))
);
const TrackCompletionBar = lazy(() =>
  import("@/components/charts/GlobalDashboardCharts").then((m) => ({ default: m.TrackCompletionBar }))
);

interface Track { id: string; name: string; name_en: string | null; }
interface Step { id: string; track_id: string; name: string; name_en: string | null; level_order: number; }
interface StepCourse { step_id: string; course_id: string; is_required: boolean; }
interface Department {
  id: string; name: string; name_en: string | null; country_code: string | null;
  entity_type: string | null; parent_department_id: string | null; is_active: boolean | null;
}
interface Profile { user_id: string; department_id: string | null; full_name: string | null; email: string | null; }
interface Enrollment { user_id: string; course_id: string; progress: number | null; completed_at: string | null; }
interface Assessment { id: string; course_id: string; passing_score: number; }
interface Attempt { user_id: string; assessment_id: string; score: number | null; passed: boolean | null; completed_at: string | null; }

// Country code → flag emoji
const flag = (cc: string | null) => {
  if (!cc || cc.length !== 2) return "🌐";
  return String.fromCodePoint(...cc.toUpperCase().split("").map((c) => 127397 + c.charCodeAt(0)));
};

// Color scale based on completion rate (0-100)
const heatColor = (pct: number): string => {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 60) return "bg-emerald-400";
  if (pct >= 40) return "bg-amber-400";
  if (pct >= 20) return "bg-orange-400";
  if (pct > 0) return "bg-rose-400";
  return "bg-muted";
};

export default function AdminGlobalDashboard() {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const [selectedTrackId, setSelectedTrackId] = useState<string>("all");
  const [drillCountry, setDrillCountry] = useState<string | null>(null);

  const { data: tracks = [] } = useQuery({
    queryKey: ["gd-tracks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("learning_tracks").select("id,name,name_en").eq("is_active", true).order("sort_order");
      if (error) throw error; return data as Track[];
    },
  });

  const { data: steps = [] } = useQuery({
    queryKey: ["gd-steps"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("track_steps").select("id,track_id,name,name_en,level_order").order("level_order");
      if (error) throw error; return data as Step[];
    },
  });

  const { data: stepCourses = [] } = useQuery({
    queryKey: ["gd-step-courses"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("track_step_courses").select("step_id,course_id,is_required");
      if (error) throw error; return data as StepCourse[];
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["gd-departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("id,name,name_en,country_code,entity_type,parent_department_id,is_active").eq("is_active", true);
      if (error) throw error; return data as Department[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["gd-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id,department_id,full_name,email");
      if (error) throw error; return data as Profile[];
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["gd-enrollments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollments").select("user_id,course_id,progress,completed_at");
      if (error) throw error; return data as Enrollment[];
    },
  });

  const { data: assessments = [] } = useQuery({
    queryKey: ["gd-assessments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select("id,course_id,passing_score")
        .eq("is_published", true);
      if (error) throw error; return data as Assessment[];
    },
  });

  const { data: attempts = [] } = useQuery({
    queryKey: ["gd-attempts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_attempts")
        .select("user_id,assessment_id,score,passed,completed_at")
        .not("completed_at", "is", null);
      if (error) throw error; return data as Attempt[];
    },
  });

  // Filter: active tracks (or single selected)
  const activeTracks = useMemo(
    () => (selectedTrackId === "all" ? tracks : tracks.filter((tr) => tr.id === selectedTrackId)),
    [tracks, selectedTrackId]
  );

  // Required course IDs per track (used for completion calc)
  const trackRequiredCourseIds = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const tr of activeTracks) {
      const trackStepIds = new Set(steps.filter((s) => s.track_id === tr.id).map((s) => s.id));
      const courseIds = new Set(
        stepCourses
          .filter((sc) => trackStepIds.has(sc.step_id) && sc.is_required)
          .map((sc) => sc.course_id)
      );
      map.set(tr.id, courseIds);
    }
    return map;
  }, [activeTracks, steps, stepCourses]);

  // Track-scoped assessment ids — only quizzes attached to required courses of the selected tracks
  const trackAssessmentIds = useMemo(() => {
    const all = new Set<string>();
    for (const set of trackRequiredCourseIds.values()) {
      for (const cid of set) {
        for (const a of assessments) {
          if (a.course_id === cid) all.add(a.id);
        }
      }
    }
    return all;
  }, [trackRequiredCourseIds, assessments]);

  // Per-user best score across the in-scope assessments
  const userBestScoreMap = useMemo(() => {
    const map = new Map<string, Map<string, number>>(); // user -> assessment -> best score
    for (const at of attempts) {
      if (!trackAssessmentIds.has(at.assessment_id)) continue;
      if (at.score == null) continue;
      if (!map.has(at.user_id)) map.set(at.user_id, new Map());
      const inner = map.get(at.user_id)!;
      const prev = inner.get(at.assessment_id) ?? -1;
      if (at.score > prev) inner.set(at.assessment_id, at.score);
    }
    return map;
  }, [attempts, trackAssessmentIds]);

  // Helpers: average best score & pass rate for a list of users
  const computeQuizMetrics = (userIds: string[]) => {
    let scoreSum = 0, scoreCnt = 0, passSum = 0, passCnt = 0;
    const passingMap = new Map<string, number>();
    assessments.forEach((a) => passingMap.set(a.id, a.passing_score));
    for (const uid of userIds) {
      const inner = userBestScoreMap.get(uid);
      if (!inner) continue;
      for (const [aid, score] of inner) {
        scoreSum += score; scoreCnt += 1;
        const pass = (passingMap.get(aid) ?? 60);
        passCnt += 1;
        if (score >= pass) passSum += 1;
      }
    }
    return {
      avgScore: scoreCnt > 0 ? Math.round(scoreSum / scoreCnt) : 0,
      passRate: passCnt > 0 ? Math.round((passSum / passCnt) * 100) : 0,
      attemptedCount: scoreCnt,
    };
  };

  // Build entity tree: country → entities (or branches with country_code)
  // Country = department where entity_type === 'country' OR top-level with country_code
  const countries = useMemo(() => {
    const list = departments.filter(
      (d) => d.entity_type === "country" || (d.country_code && !d.parent_department_id)
    );
    // Dedupe by country_code if available
    const seen = new Map<string, Department>();
    for (const d of list) {
      const key = d.country_code || d.id;
      if (!seen.has(key)) seen.set(key, d);
    }
    return Array.from(seen.values());
  }, [departments]);

  // Get all department IDs that belong to a country (country dept + all descendants)
  const getCountryDeptIds = (country: Department): Set<string> => {
    const ids = new Set<string>([country.id]);
    const queue = [country.id];
    while (queue.length > 0) {
      const parent = queue.shift()!;
      for (const d of departments) {
        if (d.parent_department_id === parent && !ids.has(d.id)) {
          ids.add(d.id); queue.push(d.id);
        }
      }
    }
    return ids;
  };

  // Per-user track completion: user is "completed" if all required courses have progress >= 100
  const isUserTrackComplete = (userId: string, trackId: string) => {
    const required = trackRequiredCourseIds.get(trackId);
    if (!required || required.size === 0) return false;
    for (const cid of required) {
      const e = enrollments.find((en) => en.user_id === userId && en.course_id === cid);
      if (!e || (e.progress ?? 0) < 100) return false;
    }
    return true;
  };

  // Aggregate stats per country
  const countryStats = useMemo(() => {
    return countries.map((country) => {
      const deptIds = getCountryDeptIds(country);
      const countryUsers = profiles.filter((p) => p.department_id && deptIds.has(p.department_id));
      const userCount = countryUsers.length;

      let totalCompletions = 0;
      let totalPossible = 0;
      for (const tr of activeTracks) {
        for (const u of countryUsers) {
          totalPossible += 1;
          if (isUserTrackComplete(u.user_id, tr.id)) totalCompletions += 1;
        }
      }
      const completionRate = totalPossible > 0 ? Math.round((totalCompletions / totalPossible) * 100) : 0;
      const quiz = computeQuizMetrics(countryUsers.map((u) => u.user_id));
      return { country, deptIds, userCount, totalCompletions, totalPossible, completionRate, ...quiz };
    }).sort((a, b) => b.userCount - a.userCount);
  }, [countries, profiles, activeTracks, enrollments, trackRequiredCourseIds, userBestScoreMap, assessments]);

  // Drill-down: entities under selected country
  const drilledEntities = useMemo(() => {
    if (!drillCountry) return [];
    const country = countries.find((c) => c.id === drillCountry);
    if (!country) return [];
    const directChildren = departments.filter((d) => d.parent_department_id === country.id);
    // If no children, treat country itself as single entity
    const entities = directChildren.length > 0 ? directChildren : [country];

    return entities.map((ent) => {
      const entUsers = profiles.filter((p) => p.department_id === ent.id);
      let totalCompletions = 0; let totalPossible = 0;
      for (const tr of activeTracks) {
        for (const u of entUsers) {
          totalPossible += 1;
          if (isUserTrackComplete(u.user_id, tr.id)) totalCompletions += 1;
        }
      }
      // Also build per-user breakdown
      const userBreakdown = entUsers.map((u) => {
        const trackStatus = activeTracks.map((tr) => ({
          track: tr,
          complete: isUserTrackComplete(u.user_id, tr.id),
        }));
        return { user: u, trackStatus };
      });
      const rate = totalPossible > 0 ? Math.round((totalCompletions / totalPossible) * 100) : 0;
      const quiz = computeQuizMetrics(entUsers.map((u) => u.user_id));
      return { entity: ent, userCount: entUsers.length, completionRate: rate, totalCompletions, totalPossible, userBreakdown, ...quiz };
    }).sort((a, b) => b.userCount - a.userCount);
  }, [drillCountry, departments, countries, profiles, activeTracks, enrollments, trackRequiredCourseIds, userBestScoreMap, assessments]);

  // CSV Export
  const exportCSV = () => {
    const rows: string[][] = [];
    rows.push([
      t("globalDashboard.country", "Country"),
      t("globalDashboard.entity", "Entity"),
      t("globalDashboard.learners", "Learners"),
      t("globalDashboard.completed", "Completed"),
      t("globalDashboard.possible", "Possible"),
      t("globalDashboard.completionRate", "Completion Rate %"),
      t("globalDashboard.avgQuizScore", "Avg Quiz Score %"),
      t("globalDashboard.quizPassRate", "Quiz Pass Rate %"),
    ]);
    for (const cs of countryStats) {
      const country = cs.country;
      const entities = departments.filter((d) => d.parent_department_id === country.id);
      const list = entities.length > 0 ? entities : [country];
      for (const ent of list) {
        const entUsers = profiles.filter((p) => p.department_id === ent.id);
        let comp = 0, poss = 0;
        for (const tr of activeTracks) {
          for (const u of entUsers) {
            poss += 1;
            if (isUserTrackComplete(u.user_id, tr.id)) comp += 1;
          }
        }
        const q = computeQuizMetrics(entUsers.map((u) => u.user_id));
        rows.push([
          (isEn ? country.name_en : country.name) || country.name,
          (isEn ? ent.name_en : ent.name) || ent.name,
          String(entUsers.length),
          String(comp),
          String(poss),
          poss > 0 ? String(Math.round((comp / poss) * 100)) : "0",
          String(q.avgScore),
          String(q.passRate),
        ]);
      }
    }
    // Excel-friendly: BOM + CRLF
    const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `global-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Totals
  const totalLearners = countryStats.reduce((s, c) => s + c.userCount, 0);
  const totalCompletions = countryStats.reduce((s, c) => s + c.totalCompletions, 0);
  const totalPossible = countryStats.reduce((s, c) => s + c.totalPossible, 0);
  const overallRate = totalPossible > 0 ? Math.round((totalCompletions / totalPossible) * 100) : 0;
  const overallQuiz = computeQuizMetrics(profiles.map((p) => p.user_id));

  // Chart data — country rows
  const countryChartData = useMemo(
    () =>
      countryStats
        .filter((cs) => cs.userCount > 0)
        .map((cs) => ({
          name: ((isEn ? cs.country.name_en : cs.country.name) || cs.country.name).slice(0, 18),
          cc: cs.country.country_code || "",
          learners: cs.userCount,
          completionRate: cs.completionRate,
          avgScore: cs.avgScore,
          passRate: cs.passRate,
        })),
    [countryStats, isEn]
  );

  // Chart data — track rows (uses entire learner pool)
  const trackChartData = useMemo(() => {
    return activeTracks.map((tr) => {
      let completed = 0;
      let possible = 0;
      for (const p of profiles) {
        if (!p.department_id) continue;
        possible += 1;
        if (isUserTrackComplete(p.user_id, tr.id)) completed += 1;
      }
      return {
        name: ((isEn ? tr.name_en : tr.name) || tr.name).slice(0, 24),
        rate: possible > 0 ? Math.round((completed / possible) * 100) : 0,
        completed,
        possible,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTracks, profiles, enrollments, trackRequiredCourseIds, isEn]);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Globe2 className="h-6 w-6 text-primary" aria-hidden="true" />
              <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
                {t("globalDashboard.title", "Global Learning Dashboard")}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {t("globalDashboard.subtitle", "Track completion rates by country and distributor")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedTrackId} onValueChange={setSelectedTrackId}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("globalDashboard.allTracks", "All Tracks")}</SelectItem>
                {tracks.map((tr) => (
                  <SelectItem key={tr.id} value={tr.id}>{(isEn ? tr.name_en : tr.name) || tr.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportCSV} className="gap-2">
              <Download className="h-4 w-4" /> {t("globalDashboard.exportCsv", "Export CSV")}
            </Button>
          </div>
        </div>

        {/* Compact summary bar — 4 key metrics */}
        <Card>
          <CardContent className="p-0">
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground leading-tight">{t("globalDashboard.totalLearners", "Total Learners")}</p>
                  <p className="text-xl font-bold text-foreground leading-tight">{totalLearners.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                    {countries.length} {t("globalDashboard.countries", "Countries")} · {activeTracks.length} {t("globalDashboard.activeTracks", "Tracks")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Trophy className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground leading-tight">{t("globalDashboard.overallCompletion", "Overall Completion")}</p>
                  <p className="text-xl font-bold text-foreground leading-tight">{overallRate}%</p>
                  <div className="h-1 w-full bg-muted rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${overallRate}%` }} />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <GraduationCap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground leading-tight">{t("globalDashboard.avgQuizScore", "Avg Quiz Score")}</p>
                  <p className="text-xl font-bold text-foreground leading-tight">{overallQuiz.avgScore}%</p>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                    {overallQuiz.attemptedCount.toLocaleString()} {t("globalDashboard.attempts", "attempts")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Layers className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground leading-tight">{t("globalDashboard.quizPassRate", "Quiz Pass Rate")}</p>
                  <p className="text-xl font-bold text-foreground leading-tight">{overallQuiz.passRate}%</p>
                  <div className="h-1 w-full bg-muted rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-amber-500 transition-all" style={{ width: `${overallQuiz.passRate}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Compact visualizations — 4 stats in a tight grid (placed above heatmap) */}
        {countryChartData.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <Card>
              <CardHeader className="py-2.5 px-4 border-b border-border/60">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
                  <BarChart3 className="h-3.5 w-3.5 text-primary" />
                  {t("globalDashboard.countryCompletion", "Country Completion")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <div className="h-[200px]">
                  <Suspense fallback={<ChartFallback />}>
                    <CountryCompletionBar data={countryChartData} />
                  </Suspense>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-2.5 px-4 border-b border-border/60">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
                  <PieIcon className="h-3.5 w-3.5 text-primary" />
                  {t("globalDashboard.learnerDistribution", "Learner Distribution")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <div className="h-[200px] w-full overflow-hidden">
                  <Suspense fallback={<ChartFallback />}>
                    <LearnerDistributionDonut data={countryChartData} />
                  </Suspense>
                </div>
              </CardContent>
            </Card>

            {countryChartData.some((c) => c.avgScore > 0 || c.passRate > 0) && (
              <Card>
                <CardHeader className="py-2.5 px-4 border-b border-border/60">
                  <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
                    <Award className="h-3.5 w-3.5 text-primary" />
                    {t("globalDashboard.quizPerformance", "Quiz Performance")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  <div className="h-[200px]">
                    <Suspense fallback={<ChartFallback />}>
                      <CountryQuizCompare
                        data={countryChartData}
                        scoreLabel={t("globalDashboard.avgScore", "Avg Score")}
                        passLabel={t("globalDashboard.passRate", "Pass Rate")}
                      />
                    </Suspense>
                  </div>
                </CardContent>
              </Card>
            )}

            {trackChartData.length > 0 && (
              <Card>
                <CardHeader className="py-2.5 px-4 border-b border-border/60">
                  <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    {t("globalDashboard.trackCompletion", "Track Completion")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  <div className="h-[200px]">
                    <Suspense fallback={<ChartFallback />}>
                      <TrackCompletionBar data={trackChartData} />
                    </Suspense>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Country Heatmap */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("globalDashboard.countryHeatmap", "Country Completion Heatmap")}</CardTitle>
          </CardHeader>
          <CardContent>
            {countryStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t("globalDashboard.noCountries", "No countries configured. Add country-level branches in Branch Management.")}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {countryStats.map((cs) => {
                    const name = (isEn ? cs.country.name_en : cs.country.name) || cs.country.name;
                    return (
                      <button
                        key={cs.country.id}
                        onClick={() => setDrillCountry(cs.country.id)}
                        className={`relative rounded-xl border border-border p-4 text-left transition-all hover:scale-[1.02] hover:shadow-md hover:border-primary/40 ${drillCountry === cs.country.id ? "border-primary ring-2 ring-primary/20" : ""}`}
                        aria-label={`${name} — ${cs.completionRate}% completion`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-2xl" aria-hidden="true">{flag(cs.country.country_code)}</span>
                          <Badge variant="outline" className="text-[10px] uppercase">{cs.country.country_code || "—"}</Badge>
                        </div>
                        <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{cs.userCount} {t("globalDashboard.learnersShort", "learners")}</p>
                        <div className="mt-3 flex items-center gap-2">
                          <div className={`h-2 flex-1 rounded-full overflow-hidden bg-muted`}>
                            <div className={`h-full ${heatColor(cs.completionRate)} transition-all`} style={{ width: `${cs.completionRate}%` }} />
                          </div>
                          <span className="text-xs font-bold text-foreground w-9 text-right">{cs.completionRate}%</span>
                        </div>
                        {cs.attemptedCount > 0 && (
                          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <GraduationCap className="h-3 w-3" />
                              {t("globalDashboard.quizShort", "Quiz")} {cs.avgScore}%
                            </span>
                            <span>{t("globalDashboard.passShort", "Pass")} {cs.passRate}%</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-6 pt-4 border-t border-border text-xs text-muted-foreground flex-wrap">
                  <span className="font-medium">{t("globalDashboard.legend", "Legend")}:</span>
                  {[{ l: "0%", c: "bg-muted" }, { l: "1-19%", c: "bg-rose-400" }, { l: "20-39%", c: "bg-orange-400" }, { l: "40-59%", c: "bg-amber-400" }, { l: "60-79%", c: "bg-emerald-400" }, { l: "80-100%", c: "bg-emerald-500" }].map((it) => (
                    <span key={it.l} className="flex items-center gap-1.5"><span className={`inline-block w-3 h-3 rounded ${it.c}`} />{it.l}</span>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Drill-down panel */}
        {drillCountry && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setDrillCountry(null)} className="gap-1">
                    <ArrowLeft className="h-4 w-4" /> {t("common.back", "Back")}
                  </Button>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-2xl">{flag(countries.find((c) => c.id === drillCountry)?.country_code || null)}</span>
                  <CardTitle className="text-base">
                    {(() => {
                      const c = countries.find((x) => x.id === drillCountry);
                      return (isEn ? c?.name_en : c?.name) || c?.name;
                    })()}
                  </CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {drilledEntities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t("common.noData", "No data")}</p>
              ) : (
                <div className="space-y-6">
                  {/* Entity-level summary */}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">{t("globalDashboard.entities", "Entities")}</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("globalDashboard.entity", "Entity")}</TableHead>
                          <TableHead className="text-right">{t("globalDashboard.learners", "Learners")}</TableHead>
                          <TableHead className="text-right">{t("globalDashboard.completed", "Completed")}</TableHead>
                          <TableHead className="text-right">{t("globalDashboard.avgQuizScore", "Avg Quiz")}</TableHead>
                          <TableHead className="text-right">{t("globalDashboard.quizPassRate", "Pass Rate")}</TableHead>
                          <TableHead className="w-[200px]">{t("globalDashboard.completionRate", "Completion Rate")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {drilledEntities.map((row) => (
                          <TableRow key={row.entity.id}>
                            <TableCell className="font-medium">{(isEn ? row.entity.name_en : row.entity.name) || row.entity.name}</TableCell>
                            <TableCell className="text-right">{row.userCount}</TableCell>
                            <TableCell className="text-right">{row.totalCompletions}/{row.totalPossible}</TableCell>
                            <TableCell className="text-right">
                              {row.attemptedCount > 0 ? `${row.avgScore}%` : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-right">
                              {row.attemptedCount > 0 ? `${row.passRate}%` : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={row.completionRate} className="h-2" />
                                <span className="text-xs font-semibold w-10 text-right">{row.completionRate}%</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Per-learner breakdown */}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">{t("globalDashboard.learnerBreakdown", "Learner Breakdown")}</h3>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("globalDashboard.learner", "Learner")}</TableHead>
                            <TableHead>{t("globalDashboard.entity", "Entity")}</TableHead>
                            {activeTracks.map((tr) => (
                              <TableHead key={tr.id} className="text-center text-xs">{(isEn ? tr.name_en : tr.name) || tr.name}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {drilledEntities.flatMap((row) =>
                            row.userBreakdown.map(({ user, trackStatus }) => (
                              <TableRow key={user.user_id}>
                                <TableCell className="font-medium text-sm">
                                  {user.full_name || user.email || user.user_id.slice(0, 8)}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {(isEn ? row.entity.name_en : row.entity.name) || row.entity.name}
                                </TableCell>
                                {trackStatus.map(({ track, complete }) => (
                                  <TableCell key={track.id} className="text-center">
                                    {complete ? (
                                      <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                                        <Trophy className="h-3 w-3 mr-1" />{t("globalDashboard.done", "Done")}
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-muted-foreground">—</Badge>
                                    )}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))
                          )}
                          {drilledEntities.every((r) => r.userBreakdown.length === 0) && (
                            <TableRow>
                              <TableCell colSpan={2 + activeTracks.length} className="text-center text-sm text-muted-foreground py-6">
                                {t("common.noData", "No data")}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}