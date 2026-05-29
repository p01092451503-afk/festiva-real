import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Lock, CheckCircle2, PlayCircle, Layers, BookOpen, ArrowRight, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useCourseI18n } from "@/hooks/useI18nMaps";

interface Track {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  thumbnail_url: string | null;
}

interface Step {
  id: string;
  track_id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  level_order: number;
  unlock_previous_required: boolean;
  badge_color: string | null;
  require_assessment_pass?: boolean;
}

interface StepCourse {
  step_id: string;
  course_id: string;
  sort_order: number;
  is_required: boolean;
  course: { id: string; title: string; thumbnail_url: string | null } | null;
}

interface Enrollment {
  course_id: string;
  progress: number | null;
  completed_at: string | null;
}

interface AssessmentRow { id: string; course_id: string; is_published: boolean }
interface AttemptRow { assessment_id: string; passed: boolean | null; completed_at: string | null }

export default function StudentTracks() {
  const { t, i18n } = useTranslation();
  const { user } = useUser();
  const isEn = i18n.language?.startsWith("en");

  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ["student-tracks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_tracks").select("*").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data as Track[];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: steps = [] } = useQuery({
    queryKey: ["student-track-steps"],
    queryFn: async () => {
      const { data, error } = await supabase.from("track_steps").select("*").order("level_order");
      if (error) throw error;
      return data as Step[];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: stepCourses = [] } = useQuery({
    queryKey: ["student-step-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("track_step_courses")
        .select("step_id, course_id, sort_order, is_required, course:courses(id, title, thumbnail_url)")
        .order("sort_order");
      if (error) throw error;
      return data as unknown as StepCourse[];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { tCourseTitle } = useCourseI18n(stepCourses.map((sc) => sc.course_id));

  const { data: enrollments = [] } = useQuery({
    queryKey: ["student-enrollments-for-tracks", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("course_id, progress, completed_at")
        .eq("user_id", user!.id)
        .eq("status", "approved");
      if (error) throw error;
      return data as Enrollment[];
    },
  });

  const { data: assessments = [] } = useQuery({
    queryKey: ["student-track-assessments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select("id, course_id, is_published")
        .eq("is_published", true);
      if (error) throw error;
      return data as AssessmentRow[];
    },
  });

  const { data: attempts = [] } = useQuery({
    queryKey: ["student-track-attempts", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_attempts")
        .select("assessment_id, passed, completed_at")
        .eq("user_id", user!.id)
        .not("completed_at", "is", null);
      if (error) throw error;
      return data as AttemptRow[];
    },
  });

  // Per-course content_progress aggregate so we can detect "all 차시 완료"
  // even when enrollments.progress isn't synced.
  const { data: contentProgressByCourse = new Map<string, { total: number; done: number }>() } = useQuery({
    queryKey: ["student-track-content-progress", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: contents, error: cErr } = await supabase
        .from("course_contents")
        .select("id, course_id, is_published");
      if (cErr) throw cErr;
      const published = (contents ?? []).filter((c: any) => c.is_published !== false);
      const ids = published.map((c: any) => c.id);
      const totals = new Map<string, number>();
      published.forEach((c: any) => totals.set(c.course_id, (totals.get(c.course_id) ?? 0) + 1));
      const dones = new Map<string, number>();
      if (ids.length > 0) {
        const { data: progs, error: pErr } = await supabase
          .from("content_progress")
          .select("content_id, completed, progress_percentage")
          .eq("user_id", user!.id)
          .in("content_id", ids);
        if (pErr) throw pErr;
        const idToCourse = new Map<string, string>(published.map((c: any) => [c.id, c.course_id]));
        (progs ?? []).forEach((p: any) => {
          const isDone = p.completed === true || (p.progress_percentage ?? 0) >= 100;
          if (!isDone) return;
          const cid = idToCourse.get(p.content_id);
          if (!cid) return;
          dones.set(cid, (dones.get(cid) ?? 0) + 1);
        });
      }
      const map = new Map<string, { total: number; done: number }>();
      totals.forEach((total, cid) => map.set(cid, { total, done: dones.get(cid) ?? 0 }));
      return map;
    },
  });

  const enrollmentMap = new Map(enrollments.map((e) => [e.course_id, e]));
  const isCourseDone = (courseId: string): boolean => {
    const e = enrollmentMap.get(courseId);
    if (e?.completed_at != null) return true;
    if ((e?.progress ?? 0) >= 100) return true;
    const cp = contentProgressByCourse.get(courseId);
    if (cp && cp.total > 0 && cp.done >= cp.total) return true;
    return false;
  };

  // course_id -> published assessment ids
  const courseAssessments = new Map<string, string[]>();
  assessments.forEach((a) => {
    if (!courseAssessments.has(a.course_id)) courseAssessments.set(a.course_id, []);
    courseAssessments.get(a.course_id)!.push(a.id);
  });
  // assessment_id -> hasPassed
  const assessmentPassed = new Map<string, boolean>();
  attempts.forEach((a) => {
    if (a.passed) assessmentPassed.set(a.assessment_id, true);
    else if (!assessmentPassed.has(a.assessment_id)) assessmentPassed.set(a.assessment_id, false);
  });

  const courseAssessmentsAllPassed = (courseId: string): boolean => {
    const ids = courseAssessments.get(courseId) || [];
    if (ids.length === 0) return true; // no quizzes → treated as passed
    return ids.every((id) => assessmentPassed.get(id) === true);
  };

  // Compute step completion: a step is "complete" if all required course enrollments are completed
  // and (when required) all course assessments have been passed.
  const isStepComplete = (stepId: string): boolean => {
    const required = stepCourses.filter((sc) => sc.step_id === stepId && sc.is_required);
    if (required.length === 0) return false;
    const step = steps.find((s) => s.id === stepId);
    const needQuiz = step?.require_assessment_pass === true;
    return required.every((sc) => {
      if (!isCourseDone(sc.course_id)) return false;
      if (needQuiz && !courseAssessmentsAllPassed(sc.course_id)) return false;
      return true;
    });
  };

  const stepProgressPct = (stepId: string): number => {
    const courses = stepCourses.filter((sc) => sc.step_id === stepId);
    if (courses.length === 0) return 0;
    const total = courses.reduce((sum, sc) => sum + (enrollmentMap.get(sc.course_id)?.progress ?? 0), 0);
    return Math.round(total / courses.length);
  };

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            {isEn ? "Learning Tracks" : "학습 트랙"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isEn
              ? "Complete each level in order — Foundation → BASIC → ADVANCED."
              : "Foundation → BASIC → ADVANCED 순서로 단계별로 학습을 완료해보세요."}
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">{t("common.loading")}</div>
        ) : tracks.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            {isEn ? "No tracks available yet." : "아직 등록된 학습 트랙이 없습니다."}
          </CardContent></Card>
        ) : (
          <div className="space-y-8">
            {tracks.map((track) => {
              const trackSteps = steps
                .filter((s) => s.track_id === track.id)
                .sort((a, b) => a.level_order - b.level_order);

              return (
                <section key={track.id} className="space-y-4">
                  <div className="border-b border-border pb-3">
                    <h2 className="text-lg font-semibold">{isEn && track.name_en ? track.name_en : track.name}</h2>
                    {(isEn && track.description_en ? track.description_en : track.description) && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {isEn && track.description_en ? track.description_en : track.description}
                      </p>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    {trackSteps.map((step, idx) => {
                      const prevStep = idx > 0 ? trackSteps[idx - 1] : null;
                      const prevComplete = prevStep ? isStepComplete(prevStep.id) : true;
                      const locked = step.unlock_previous_required && !prevComplete;
                      const courses = stepCourses.filter((sc) => sc.step_id === step.id);
                      const complete = isStepComplete(step.id);
                      const progress = stepProgressPct(step.id);

                      return (
                        <Card
                          key={step.id}
                          className={`relative overflow-hidden transition-all ${locked ? "opacity-60" : "hover:shadow-md"}`}
                        >
                          <div className="h-1.5" style={{ backgroundColor: step.badge_color || "#3B82F6" }} />
                          <CardContent className="p-5 space-y-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
                                  style={{ backgroundColor: step.badge_color || "#3B82F6" }}
                                >
                                  {idx + 1}
                                </div>
                                <div>
                                  <h3 className="font-semibold">{isEn && step.name_en ? step.name_en : step.name}</h3>
                                  <p className="text-xs text-muted-foreground">
                                    {courses.length} {isEn ? "courses" : "강의"}
                                  </p>
                                </div>
                              </div>
                              {complete ? (
                                <Badge className="bg-emerald-500 text-white dark:bg-emerald-500 dark:text-white hover:bg-emerald-600 gap-1 border-0">
                                  <CheckCircle2 className="h-3 w-3" /> {isEn ? "Done" : "완료"}
                                </Badge>
                              ) : locked ? (
                                <Badge variant="outline" className="gap-1">
                                  <Lock className="h-3 w-3" /> {isEn ? "Locked" : "잠김"}
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="gap-1">
                                  <PlayCircle className="h-3 w-3" /> {isEn ? "Open" : "진행 가능"}
                                </Badge>
                              )}
                            </div>

                            {step.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {isEn && (step as any).description_en ? (step as any).description_en : step.description}
                              </p>
                            )}

                            {step.require_assessment_pass && !locked && !complete && (
                              <div className="text-[11px] rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 text-amber-800 dark:text-amber-200 px-2 py-1.5 flex items-center gap-1.5">
                                <Trophy className="h-3 w-3 shrink-0" />
                                {isEn
                                  ? "Pass all course quizzes to complete this step."
                                  : "이 단계의 모든 강의 평가를 합격해야 단계가 완료됩니다."}
                              </div>
                            )}

                            <div>
                              <div className="flex justify-between text-xs mb-1.5">
                                <span className="text-muted-foreground">{isEn ? "Progress" : "진도"}</span>
                                <span className="font-medium">{progress}%</span>
                              </div>
                              <Progress value={progress} className="h-1.5" />
                            </div>

                            {locked ? (
                              <p className="text-xs text-muted-foreground italic flex items-center gap-1">
                                <Lock className="h-3 w-3" />
                                {isEn
                                  ? `Complete "${prevStep?.name_en || prevStep?.name}" first`
                                  : `이전 단계 "${prevStep?.name}" 완료 후 잠금 해제`}
                              </p>
                            ) : (
                              <ul className="space-y-1.5">
                                {courses.slice(0, 3).map((sc) => {
                                  const courseDone = isCourseDone(sc.course_id);
                                  return (
                                    <li key={sc.course_id} className="flex items-center gap-2 text-xs">
                                      {courseDone ? (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                      ) : (
                                        <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                      )}
                                      <Link
                                        to={`/student/courses/${sc.course_id}`}
                                        className="truncate hover:text-primary hover:underline"
                                      >
                                        {tCourseTitle({ id: sc.course_id, title: sc.course?.title }) || "(unavailable)"}
                                      </Link>
                                    </li>
                                  );
                                })}
                                {courses.length > 3 && (
                                  <li className="text-xs text-muted-foreground pl-5">
                                    +{courses.length - 3} {isEn ? "more" : "개 더보기"}
                                  </li>
                                )}
                              </ul>
                            )}

                            {!locked && courses.length > 0 && (
                              (() => {
                                // 이어보기: 미완료 강의를 sort_order 순으로 찾고, 없으면 첫 강의로 폴백
                                const nextCourse =
                                  courses.find((sc) => !isCourseDone(sc.course_id)) ?? courses[0];
                                return (
                                  <Button
                                    asChild
                                    size="sm"
                                    variant={complete ? "outline" : "default"}
                                    className="w-full"
                                  >
                                    <Link to={`/student/courses/${nextCourse.course_id}?view=learn`}>
                                      {complete ? (
                                        <>{isEn ? "Review" : "다시 보기"} <ArrowRight className="h-3.5 w-3.5 ml-1" /></>
                                      ) : (
                                        <>{isEn ? "Continue Learning" : "이어 학습하기"} <ArrowRight className="h-3.5 w-3.5 ml-1" /></>
                                      )}
                                    </Link>
                                  </Button>
                                );
                              })()
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Track completion celebration */}
                  {trackSteps.length > 0 && trackSteps.every((s) => isStepComplete(s.id)) && (
                    <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 dark:from-amber-950/30 dark:to-orange-950/30 dark:border-amber-900">
                      <CardContent className="py-4 flex items-center gap-3">
                        <Trophy className="h-8 w-8 text-amber-600" />
                        <div>
                          <p className="font-semibold text-amber-900 dark:text-amber-100">
                            {isEn ? "Track Completed!" : "트랙 완주를 축하드립니다!"}
                          </p>
                          <p className="text-xs text-amber-800 dark:text-amber-200">
                            {isEn
                              ? "Your certificate has been issued. Check the Achievements page."
                              : "수료증이 발급되었습니다. 성취 페이지에서 확인하세요."}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}