import { Search, BookOpen, Info, Clock, Star, ChevronRight, Layers, GraduationCap, Compass } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import TracksPanel, { useTrackCourseIds, useAssignedTracksCount, useCourseTrackMap } from "@/components/student/TracksPanel";
import { CourseCatalogContent } from "@/pages/student/CourseCatalog";
import { useCourseI18n } from "@/hooks/useI18nMaps";
import { useInlineEnName } from "@/hooks/useI18nMaps";

const StudentCourses = () => {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab =
    tabParam === "catalog" || tabParam === "completed" || tabParam === "tracks"
      ? tabParam
      : "in-progress";
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const trackCourseIds = useTrackCourseIds();
  const assignedTracksCount = useAssignedTracksCount();
  const courseTrackMap = useCourseTrackMap();

  const handleTabChange = (v: string) => {
    setActiveTab(v);
    const params = new URLSearchParams(searchParams);
    if (v === "in-progress") params.delete("tab");
    else params.set("tab", v);
    setSearchParams(params, { replace: true });
  };

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["my-enrollments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollments").select("*, courses(*)").eq("user_id", user!.id).eq("status", "approved").order("enrolled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000,
    refetchOnMount: true,
  });

  // Localize embedded course titles/descriptions for English UI
  const enrolledCourseIds = enrollments.map((e: any) => e.courses?.id).filter(Boolean);
  const { tCourseTitle, tCourseDescription } = useCourseI18n(enrolledCourseIds);
  const localizedEnrollments = enrollments.map((e: any) =>
    e.courses
      ? { ...e, courses: { ...e.courses, title: tCourseTitle(e.courses) || e.courses.title, description: tCourseDescription(e.courses) || e.courses.description } }
      : e,
  );

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name, name_en, slug");
      if (error) throw error;
      return data;
    },
  });
  const localizeCatName = useInlineEnName();
  const localizedCategories = categories.map((c: any) => ({ ...c, name: localizeCatName(c) }));

  const syncProgressMutation = useMutation({
    mutationFn: async () => {
      for (const enrollment of enrollments) {
        const courseId = (enrollment as any).course_id;
        const { data: contents } = await supabase.from("course_contents").select("id").eq("course_id", courseId).eq("is_published", true);
        if (!contents || contents.length === 0) continue;
        const { data: progress } = await supabase.from("content_progress").select("content_id, completed").eq("user_id", user!.id).in("content_id", contents.map(c => c.id));
        const completedCount = (progress || []).filter(p => p.completed).length;
        const percentage = Math.round((completedCount / contents.length) * 100);
        await supabase.from("enrollments").update({ progress: percentage, completed_at: percentage >= 100 ? new Date().toISOString() : null }).eq("id", enrollment.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-enrollments"] });
      toast({ title: t("course.syncComplete"), description: t("course.syncCompleteDesc") });
    },
    onError: (e: any) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const categoryMap = new Map(localizedCategories.map((c: any) => [c.id, c]));
  const filtered = localizedEnrollments.filter((e: any) => e.courses?.title?.toLowerCase().includes(search.toLowerCase()));
  const inProgress = filtered.filter((e: any) => !e.completed_at);
  const completed = filtered.filter((e: any) => !!e.completed_at);

  const renderEmpty = (isCompleted = false) => (
    <div className="flex flex-col items-center justify-center py-12 space-y-3">
      <div className="h-14 w-14 rounded-full bg-accent flex items-center justify-center" aria-hidden="true">
        <BookOpen className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">
        {isCompleted ? t("course.noCompletedCourses") : t("course.noInProgressCourses")}
      </p>
    </div>
  );

  const renderListItem = (enrollment: any, isCompleted = false, index = 0) => {
    const course = enrollment.courses;
    if (!course) return null;
    const cat = categoryMap.get(course.category_id);
    const progress = isCompleted ? 100 : Number(enrollment.progress) || 0;
    const isTrackCourse = trackCourseIds.has(course.id);

    return (
      <Link
        key={enrollment.id}
        to={`/student/courses/${course.id}?view=learn`}
        className={`group flex items-center gap-4 p-4 hover:shadow-md transition-all border-b-2 border-border/80 last:border-b-0`}
      >
        {/* Thumbnail - small */}
        {course.thumbnail_url ? (
          <img src={course.thumbnail_url} alt={course.title} className="h-14 w-14 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="h-14 w-14 rounded-lg bg-accent flex items-center justify-center shrink-0" aria-hidden="true">
            <BookOpen className="h-6 w-6 text-muted-foreground" />
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground truncate">{course.title}</h3>
            {course.is_mandatory && <Badge variant="destructive" className="text-[10px] h-5">{t("common.required")}</Badge>}
            {isTrackCourse && (
              <Badge variant="outline" className="text-[10px] h-5 gap-1 border-primary/40 text-primary">
                <Layers className="h-3 w-3" />
                {t("nav.learningTracks", "학습 트랙")}
              </Badge>
            )}
            {!isTrackCourse && (
              <Badge variant="outline" className="text-[10px] h-5 gap-1 border-muted-foreground/40 text-muted-foreground">
                <GraduationCap className="h-3 w-3" />
                {t("course.standaloneBadge", "단과")}
              </Badge>
            )}
            {cat && <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">{cat.name}</span>}
          </div>
          {!isCompleted && (
            <div className="flex items-center gap-3">
              <Progress value={progress} className="flex-1 h-1.5" aria-label={`${t("dashboard.progressRate")}: ${Math.round(progress)}%`} />
              <span className="text-xs font-medium text-muted-foreground">{Math.round(progress)}%</span>
            </div>
          )}
          {isCompleted && (
            <div className="flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" aria-hidden="true" />
              <span className="text-xs font-medium text-green-600 dark:text-green-400">{t("course.completionLabel")}</span>
            </div>
          )}
        </div>

        {/* Duration */}
        {course.estimated_duration_hours != null && course.estimated_duration_hours > 0 && (
          <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0" aria-label={`${t("course.duration", { hours: course.estimated_duration_hours })}`}>
            <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {course.estimated_duration_hours}h
          </span>
        )}

        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" aria-hidden="true" />
      </Link>
    );
  };

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2"><BookOpen className="h-6 w-6" aria-hidden="true" />{t("course.myCourseRoom")}</h1>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-3xl h-auto">
            <TabsTrigger value="in-progress" className="whitespace-normal text-center leading-tight py-2 h-auto min-w-0">
              {t("course.inProgressStandalone", "수강중")} ({inProgress.length})
            </TabsTrigger>
            <TabsTrigger value="tracks" className="gap-1.5 whitespace-normal text-center leading-tight py-2 h-auto min-w-0">
              <Layers className="h-4 w-4 shrink-0" />
              <span className="truncate">{t("nav.learningTracks", "학습 트랙")} ({assignedTracksCount})</span>
            </TabsTrigger>
            <TabsTrigger value="completed" className="whitespace-normal text-center leading-tight py-2 h-auto min-w-0">
              {t("course.completedTrackAndStandalone", "수강종료 트랙/단과")} ({completed.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tracks" className="mt-0">
            <TracksPanel />
          </TabsContent>

          <TabsContent value="in-progress" className="mt-0 space-y-4">
            <div className="bg-secondary/30 rounded-xl p-4 space-y-1.5">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
                <div className="space-y-1 text-sm text-muted-foreground" role="note">
                  <p>{t("course.courseInfoGuide")}</p>
                  <p>{t("course.courseInfoGuide2")}</p>
                  <p>{t("course.courseInfoGuide3")}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" className="gap-1.5 rounded-lg text-xs" onClick={() => syncProgressMutation.mutate()} disabled={syncProgressMutation.isPending}>
                  <RefreshCw className={`h-3.5 w-3.5 ${syncProgressMutation.isPending ? "animate-spin" : ""}`} aria-hidden="true" />
                  {syncProgressMutation.isPending ? t("course.syncing") : t("course.syncProgress")}
                </Button>
              </div>
            </div>

            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="course-search" className="sr-only">{t("course.searchCourse")}</label>
              <Input id="course-search" placeholder={t("course.searchCourse")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 rounded-xl border-border" />
            </div>

            {isLoading ? (
              <div className="flex justify-center py-16"><span className="h-6 w-6 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" role="status" aria-label={t("common.loading", "로딩 중")} /></div>
            ) : inProgress.length === 0 ? renderEmpty() : (
              <div className="rounded-2xl overflow-hidden border border-border">
                {inProgress.map((e: any, i: number) => renderListItem(e, false, i))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-0 space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="course-search-completed" className="sr-only">{t("course.searchCourse")}</label>
              <Input id="course-search-completed" placeholder={t("course.searchCourse")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 rounded-xl border-border" />
            </div>

            {isLoading ? (
              <div className="flex justify-center py-16"><span className="h-6 w-6 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" role="status" aria-label={t("common.loading", "로딩 중")} /></div>
            ) : completed.length === 0 ? renderEmpty(true) : (() => {
              // Group completed enrollments by parent track; standalone goes to its own bucket
              const trackGroups = new Map<string, { trackName: string; trackNameEn: string | null; sortOrder: number; items: any[] }>();
              const standaloneItems: any[] = [];
              completed.forEach((e: any) => {
                const courseId = e.course_id || e.courses?.id;
                const trackInfo = courseId ? courseTrackMap.get(courseId) : undefined;
                if (trackInfo) {
                  if (!trackGroups.has(trackInfo.trackId)) {
                    trackGroups.set(trackInfo.trackId, {
                      trackName: trackInfo.trackName,
                      trackNameEn: trackInfo.trackNameEn,
                      sortOrder: trackInfo.sortOrder,
                      items: [],
                    });
                  }
                  trackGroups.get(trackInfo.trackId)!.items.push(e);
                } else {
                  standaloneItems.push(e);
                }
              });
              const sortedTracks = Array.from(trackGroups.entries()).sort(
                (a, b) => a[1].sortOrder - b[1].sortOrder,
              );
              const isEn = (t("course.standaloneBadge") === "Standalone");
              return (
                <div className="space-y-8">
                  {/* Tracks section */}
                  <section className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Layers className="h-5 w-5 text-primary" aria-hidden="true" />
                      <h2 className="text-base font-semibold text-foreground">
                        {t("course.completedTracksSection", "수강종료 학습 트랙")}
                      </h2>
                      <span className="text-xs text-muted-foreground">({sortedTracks.length})</span>
                    </div>
                    {sortedTracks.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                        {t("course.noCompletedTracks", "수강종료한 학습 트랙이 없습니다")}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {sortedTracks.map(([trackId, group]) => (
                          <div key={trackId} className="rounded-2xl border border-border overflow-hidden">
                            <div className="flex items-center justify-between gap-2 px-4 py-3 bg-secondary/40 border-b border-border">
                              <div className="flex items-center gap-2 min-w-0">
                                <Layers className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                                <h3 className="text-sm font-semibold text-foreground truncate">
                                  {isEn && group.trackNameEn ? group.trackNameEn : group.trackName}
                                </h3>
                              </div>
                              <span className="text-[11px] text-muted-foreground shrink-0">
                                {t("course.trackCompletedCourses", { count: group.items.length, defaultValue: `${group.items.length}개 강의 수료` })}
                              </span>
                            </div>
                            <div>
                              {group.items.map((e: any, i: number) => renderListItem(e, true, i))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Standalone section */}
                  <section className="space-y-3">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      <h2 className="text-base font-semibold text-foreground">
                        {t("course.completedStandaloneSection", "수강종료 단과")}
                      </h2>
                      <span className="text-xs text-muted-foreground">({standaloneItems.length})</span>
                    </div>
                    {standaloneItems.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                        {t("course.noCompletedStandalone", "수강종료한 단과 강의가 없습니다")}
                      </div>
                    ) : (
                      <div className="rounded-2xl overflow-hidden border border-border">
                        {standaloneItems.map((e: any, i: number) => renderListItem(e, true, i))}
                      </div>
                    )}
                  </section>
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default StudentCourses;
