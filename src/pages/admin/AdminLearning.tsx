import { GraduationCap, Download, BarChart3, AlertTriangle, Users, Search, X, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import RichStatCard from "@/components/admin/stats/RichStatCard";

// 샘플(데모) 수강생 이름 — 프로필이 없는 수강 데이터에 일관된 이름을 부여
const SAMPLE_NAMES = [
  "김민준", "이서연", "박지훈", "최수아", "정우진", "강예린", "조현우", "윤하늘",
  "임도윤", "한지민", "오세훈", "신유나", "권태영", "황서준", "배소율", "문재하",
  "안다인", "송민서", "류정후", "고은채", "남기훈", "서지안", "홍채원", "전시우",
];
const sampleNameFor = (userId: string) => {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return SAMPLE_NAMES[h % SAMPLE_NAMES.length];
};


const AdminLearning = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [courseFilter, setCourseFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: courses = [] } = useQuery({
    queryKey: ["admin-learning-courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("id, title, status").order("title");
      if (error) throw error;
      return data;
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["admin-learning-enrollments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollments").select("id, user_id, course_id, progress, enrolled_at, completed_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-learning-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, full_name, email, department, department_id");
      if (error) throw error;
      return data;
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["admin-learning-departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, name_en, country_code, entity_type, parent_department_id")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  // Best assessment score per (user, course)
  const { data: assessmentAttempts = [] } = useQuery({
    queryKey: ["admin-learning-attempts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_attempts")
        .select("user_id, assessment_id, score, passed, completed_at")
        .not("completed_at", "is", null);
      if (error) throw error;
      return data;
    },
  });

  const { data: assessmentList = [] } = useQuery({
    queryKey: ["admin-learning-assessments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assessments").select("id, course_id");
      if (error) throw error;
      return data;
    },
  });

  const bestScoreByUserCourse = useMemo(() => {
    const asmtCourseMap = new Map(assessmentList.map((a: any) => [a.id, a.course_id]));
    const map = new Map<string, { score: number; passed: boolean }>();
    assessmentAttempts.forEach((a: any) => {
      const cid = asmtCourseMap.get(a.assessment_id);
      if (!cid || a.score == null) return;
      const key = `${a.user_id}__${cid}`;
      const cur = map.get(key);
      const score = Number(a.score) || 0;
      if (!cur || score > cur.score) map.set(key, { score, passed: !!a.passed });
    });
    return map;
  }, [assessmentAttempts, assessmentList]);

  const profileMap = new Map(profiles.map((p: any) => [p.user_id, p]));
  const courseMap = new Map(courses.map((c: any) => [c.id, c]));
  const deptMap = new Map(departments.map((d: any) => [d.id, d]));

  const isEn = i18n.language?.startsWith("en");
  const deptLabel = (d: any) => (isEn && d?.name_en ? d.name_en : d?.name) || "";

  // Region (country) options derived from departments
  const countryOptions = useMemo(() => {
    const seen = new Map<string, string>();
    departments.forEach((d: any) => {
      if (d.country_code && !seen.has(d.country_code)) {
        // Prefer the country-level department name as the label
        const country = departments.find((x: any) => x.country_code === d.country_code && x.entity_type === "country");
        seen.set(d.country_code, country ? deptLabel(country) : d.country_code);
      }
    });
    return Array.from(seen.entries()).map(([code, label]) => ({ code, label }));
  }, [departments, isEn]);

  // Branch options (filtered by selected country)
  const branchOptions = useMemo(() => {
    return departments
      .filter((d: any) => d.entity_type === "branch")
      .filter((d: any) => countryFilter === "all" || d.country_code === countryFilter)
      .map((d: any) => ({ id: d.id, label: deptLabel(d) }));
  }, [departments, countryFilter, isEn]);

  // Reset branch filter if it no longer belongs to the selected country
  if (branchFilter !== "all" && !branchOptions.some((b) => b.id === branchFilter)) {
    // schedule update without setState in render warning: defer with microtask
    queueMicrotask(() => setBranchFilter("all"));
  }

  const term = searchTerm.trim().toLowerCase();
  const filtered = enrollments.filter((e: any) => {
    if (courseFilter !== "all" && e.course_id !== courseFilter) return false;

    const profile = profileMap.get(e.user_id) as any;
    const branch = profile?.department_id ? (deptMap.get(profile.department_id) as any) : null;

    if (countryFilter !== "all" && branch?.country_code !== countryFilter) return false;
    if (branchFilter !== "all" && profile?.department_id !== branchFilter) return false;

    const progressVal = Number(e.progress) || 0;
    if (statusFilter === "completed" && !e.completed_at) return false;
    if (statusFilter === "in_progress" && (e.completed_at || progressVal <= 0)) return false;
    if (statusFilter === "not_started" && (e.completed_at || progressVal > 0)) return false;

    if (term) {
      const course = courseMap.get(e.course_id) as any;
      const haystack = [profile?.full_name, profile?.email, course?.title]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });

  const resetFilters = () => {
    setSearchTerm("");
    setCountryFilter("all");
    setBranchFilter("all");
    setCourseFilter("all");
    setStatusFilter("all");
  };
  const hasActiveFilters =
    !!term || countryFilter !== "all" || branchFilter !== "all" || courseFilter !== "all" || statusFilter !== "all";

  const completerRows = filtered.filter((e: any) => e.completed_at);
  const visibleProgressRows = filtered.slice(0, 50);
  const visibleCompleterRows = completerRows.slice(0, 50);
  const totalStudents = new Set(filtered.map((e: any) => e.user_id)).size;
  const completedCount = completerRows.length;
  const avgProgress = filtered.length > 0 ? Math.round(filtered.reduce((s: number, e: any) => s + (Number(e.progress) || 0), 0) / filtered.length) : 0;
  const atRisk = filtered.filter((e: any) => (Number(e.progress) || 0) < 20 && !e.completed_at).length;

  const formatDate = (d: string | null) => {
    if (!d) return "-";
    return i18n.language?.startsWith("en")
      ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : new Date(d).toLocaleDateString("ko-KR");
  };

  const getStatusBadge = (e: any) => {
    if (e.completed_at) return <Badge variant="default" className="text-[10px]">{t("common.complete")}</Badge>;
    if ((Number(e.progress) || 0) > 0) return <Badge variant="secondary" className="text-[10px]">{t("dashboard.inProgress")}</Badge>;
    return <Badge variant="outline" className="text-[10px]">{t("admin.notStarted")}</Badge>;
  };

  const exportCSV = () => {
    const header = [t("admin.nameColumn"), t("admin.courseLabel"), t("admin.progressLabel"), t("admin.statusLabel"), t("admin.startDate"), t("admin.completionDate")];
    const rows = filtered.map((e: any) => {
      const p = profileMap.get(e.user_id);
      const c = courseMap.get(e.course_id);
      const status = e.completed_at ? t("common.complete") : (Number(e.progress) || 0) > 0 ? t("dashboard.inProgress") : t("admin.notStarted");
      return [p?.full_name || "-", c?.title || "-", `${Math.round(Number(e.progress) || 0)}%`, status, formatDate(e.enrolled_at), formatDate(e.completed_at)];
    });
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "learning_report.csv";
    a.click();
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 sm:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2">
              <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
              {t("admin.learningManagement")}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t("admin.learningManagementDesc")}</p>
          </div>
          <Button onClick={exportCSV} variant="outline" className="rounded-xl gap-2 text-sm w-full sm:w-auto justify-center sm:justify-start">
            <Download className="h-4 w-4" aria-hidden="true" /> CSV {t("admin.download")}
          </Button>
        </div>

        <div
          className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3"
          role="group"
          aria-label={t("admin.learningManagement")}
        >
          {(() => {
            const completionRate =
              filtered.length > 0 ? Math.round((completedCount / filtered.length) * 100) : 0;
            const atRiskRate =
              filtered.length > 0 ? Math.round((atRisk / filtered.length) * 100) : 0;
            return (
              <>
                <RichStatCard
                  label={t("admin.totalEnrolled")}
                  value={totalStudents}
                  icon={Users}
                  tone="indigo"
                  sub={t("admin.enrolledStudentsLabel")}
                  visual="dots"
                  dotsActive={Math.min(7, totalStudents)}
                  dotsTotal={7}
                />
                <RichStatCard
                  label={t("admin.completionCount")}
                  value={completedCount}
                  icon={GraduationCap}
                  tone="emerald"
                  sub={`${completionRate}% ${t("admin.completionRateLabel")}`}
                  visual="ring"
                  ringValue={completionRate}
                />
                <RichStatCard
                  label={t("admin.avgProgressLabel")}
                  value={`${avgProgress}%`}
                  icon={BarChart3}
                  tone="sky"
                  sub={t("admin.avgProgressSub", { defaultValue: "전체 진도 평균" })}
                  visual="bar"
                  barValue={avgProgress}
                  barCaption={`${avgProgress}%`}
                />
                <RichStatCard
                  label={t("admin.atRisk")}
                  value={atRisk}
                  icon={AlertTriangle}
                  tone="rose"
                  sub={t("admin.needsAttention")}
                  visual="bar"
                  barValue={atRiskRate}
                  barCaption={`${atRiskRate}%`}
                />
              </>
            );
          })()}
        </div>

        {/* Filter bar */}
        <div className="stat-card !p-3 sm:!p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t("admin.learningSearchPlaceholder")}
                className="pl-9 h-9"
                aria-label={t("admin.learningSearchPlaceholder")}
              />
            </div>
            <Select value={countryFilter} onValueChange={(v) => { setCountryFilter(v); setBranchFilter("all"); }}>
              <SelectTrigger className="h-9" aria-label={t("admin.filterByCountry")}><SelectValue placeholder={t("admin.filterByCountry")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.allCountries")}</SelectItem>
                {countryOptions.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="h-9" aria-label={t("admin.filterByBranch")}><SelectValue placeholder={t("admin.filterByBranch")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.allBranchesFilter")}</SelectItem>
                {branchOptions.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9" aria-label={t("admin.filterByStatus")}><SelectValue placeholder={t("admin.filterByStatus")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.allStatuses")}</SelectItem>
                <SelectItem value="not_started">{t("admin.statusNotStarted")}</SelectItem>
                <SelectItem value="in_progress">{t("admin.statusInProgress")}</SelectItem>
                <SelectItem value="completed">{t("admin.statusCompleted")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {t("admin.filterResultCount", { count: filtered.length })}
            </span>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 gap-1 text-xs">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                {t("admin.resetFilters")}
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="progress" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2">
            <TabsTrigger value="progress" className="px-3 py-2 text-xs sm:text-sm">{t("admin.progressStatus")}</TabsTrigger>
            <TabsTrigger value="completers" className="px-3 py-2 text-xs sm:text-sm">{t("admin.completersList")}</TabsTrigger>
          </TabsList>

          <TabsContent value="progress" className="mt-0 space-y-4">
            <div className="stat-card !p-3 sm:!p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h3 className="text-sm sm:text-base font-semibold text-foreground">{t("admin.studentProgressStatus")}</h3>
                <Select value={courseFilter} onValueChange={setCourseFilter}>
                  <SelectTrigger className="w-full sm:w-48 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("admin.allCourses")}</SelectItem>
                    {courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:hidden space-y-3" aria-label={t("admin.studentProgressStatus")}>
                {visibleProgressRows.length === 0 ? (
                  <div className="rounded-xl border border-border bg-background px-4 py-8 text-center text-sm text-muted-foreground">
                    {t("admin.noLearningData")}
                  </div>
                ) : (
                  visibleProgressRows.map((e: any) => {
                    const p = profileMap.get(e.user_id);
                    const c = courseMap.get(e.course_id);
                    const progressValue = Math.round(Number(e.progress) || 0);
                    const best = bestScoreByUserCourse.get(`${e.user_id}__${e.course_id}`);

                    return (
                      <article
                        key={e.id}
                        role={p ? "button" : undefined}
                        tabIndex={p ? 0 : undefined}
                        onClick={p ? () => navigate(`/admin/users/${e.user_id}`) : undefined}
                        onKeyDown={(ev) => {
                          if (!p) return;
                          if (ev.key === "Enter" || ev.key === " ") {
                            ev.preventDefault();
                            navigate(`/admin/users/${e.user_id}`);
                          }
                        }}
                        className={`rounded-xl border border-border bg-background p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${p ? "cursor-pointer hover:bg-accent/30" : ""}`}
                      >

                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-foreground break-words inline-flex items-center gap-1">
                              {p?.full_name || (isEn ? "Unknown member" : "회원 정보 없음")}
                              {p && <ChevronRight className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-1 break-words">{c?.title || "-"}</p>
                          </div>
                          <div className="shrink-0">{getStatusBadge(e)}</div>
                        </div>

                        <div className="mt-4">
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="text-muted-foreground">{t("admin.progressLabel")}</span>
                            <span className="font-medium text-foreground">{progressValue}%</span>
                          </div>
                          <Progress value={progressValue} className="mt-2 h-2" aria-label={`${t("admin.progressLabel")}: ${progressValue}%`} />
                        </div>

                        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <dt className="text-muted-foreground">{t("admin.bestScore", "최고 점수")}</dt>
                            <dd className="mt-1">
                              {best ? (
                                <span className={`font-medium ${best.passed ? "text-primary" : "text-foreground"}`}>
                                  {best.score}점{best.passed ? " ✓" : ""}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">{t("admin.startDate")}</dt>
                            <dd className="mt-1 text-foreground">{formatDate(e.enrolled_at)}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">{t("admin.completionDate")}</dt>
                            <dd className="mt-1 text-foreground">{formatDate(e.completed_at)}</dd>
                          </div>
                        </dl>
                      </article>
                    );
                  })
                )}
              </div>

              <div className="hidden sm:block overflow-x-auto -mx-3 sm:-mx-5">
                <div className="min-w-[720px] px-3 sm:px-5">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("admin.nameColumn")}</TableHead>
                        <TableHead>{t("admin.courseLabel")}</TableHead>
                        <TableHead>{t("admin.progressLabel")}</TableHead>
                        <TableHead className="w-[110px]">{t("admin.bestScore", "최고 점수")}</TableHead>
                        <TableHead>{t("admin.statusLabel")}</TableHead>
                        <TableHead>{t("admin.startDate")}</TableHead>
                        <TableHead>{t("admin.completionDate")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleProgressRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("admin.noLearningData")}</TableCell>
                        </TableRow>
                      ) : (
                        visibleProgressRows.map((e: any) => {
                          const p = profileMap.get(e.user_id);
                          const c = courseMap.get(e.course_id);
                          const best = bestScoreByUserCourse.get(`${e.user_id}__${e.course_id}`);
                          return (
                            <TableRow
                              key={e.id}
                              className={p ? "cursor-pointer hover:bg-accent/30 transition-colors" : ""}
                              onClick={p ? () => navigate(`/admin/users/${e.user_id}`) : undefined}
                            >
                              <TableCell className="font-medium text-sm">
                                <span className="text-foreground hover:text-primary inline-flex items-center gap-1">
                                  {p?.full_name || (isEn ? "Unknown member" : "회원 정보 없음")}
                                  {p && <ChevronRight className="h-3 w-3 opacity-40" />}
                                </span>
                              </TableCell>
                              <TableCell className="max-w-[260px] text-sm whitespace-normal break-words">{c?.title || "-"}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Progress value={Number(e.progress) || 0} className="w-20 h-1.5" />
                                  <span className="text-xs">{Math.round(Number(e.progress) || 0)}%</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {best ? (
                                  <span className={`text-xs font-medium ${best.passed ? "text-primary" : "text-muted-foreground"}`}>
                                    {best.score}점{best.passed ? " ✓" : ""}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>{getStatusBadge(e)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{formatDate(e.enrolled_at)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{formatDate(e.completed_at)}</TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="completers" className="mt-0">
            <div className="stat-card !p-3 sm:!p-5">
              <h3 className="text-sm sm:text-base font-semibold text-foreground mb-4">{t("admin.completersList")}</h3>

              <div className="sm:hidden space-y-3" aria-label={t("admin.completersList")}>
                {visibleCompleterRows.length === 0 ? (
                  <div className="rounded-xl border border-border bg-background px-4 py-8 text-center text-sm text-muted-foreground">
                    {t("admin.noCompleters")}
                  </div>
                ) : (
                  visibleCompleterRows.map((e: any) => {
                    const p = profileMap.get(e.user_id);
                    const c = courseMap.get(e.course_id);

                    return (
                      <article
                        key={e.id}
                        role={p ? "button" : undefined}
                        tabIndex={p ? 0 : undefined}
                        onClick={p ? () => navigate(`/admin/users/${e.user_id}`) : undefined}
                        onKeyDown={(ev) => {
                          if (!p) return;
                          if (ev.key === "Enter" || ev.key === " ") {
                            ev.preventDefault();
                            navigate(`/admin/users/${e.user_id}`);
                          }
                        }}
                        className={`rounded-xl border border-border bg-background p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${p ? "cursor-pointer hover:bg-accent/30" : ""}`}
                      >
                        <h4 className="text-sm font-semibold text-foreground break-words inline-flex items-center gap-1">
                          {p?.full_name || (isEn ? "Unknown member" : "회원 정보 없음")}
                          {p && <ChevronRight className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1 break-words">{c?.title || "-"}</p>
                        <dl className="mt-4 text-xs">
                          <dt className="text-muted-foreground">{t("admin.completionDate")}</dt>
                          <dd className="mt-1 text-foreground">{formatDate(e.completed_at)}</dd>
                        </dl>
                      </article>
                    );
                  })
                )}
              </div>

              <div className="hidden sm:block overflow-x-auto -mx-3 sm:-mx-5">
                <div className="min-w-[560px] px-3 sm:px-5">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("admin.nameColumn")}</TableHead>
                        <TableHead>{t("admin.courseLabel")}</TableHead>
                        <TableHead>{t("admin.completionDate")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleCompleterRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">{t("admin.noCompleters")}</TableCell>
                        </TableRow>
                      ) : (
                        visibleCompleterRows.map((e: any) => {
                          const p = profileMap.get(e.user_id);
                          const c = courseMap.get(e.course_id);
                          return (
                            <TableRow key={e.id}>
                              <TableCell className="font-medium text-sm">{p?.full_name || "-"}</TableCell>
                              <TableCell className="max-w-[280px] text-sm whitespace-normal break-words">{c?.title || "-"}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{formatDate(e.completed_at)}</TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminLearning;
