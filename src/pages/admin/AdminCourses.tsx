import { Plus, Search, MoreHorizontal, Eye, Edit, Users, BookOpen, Clock, LayoutGrid, List, AlertTriangle, CalendarClock, ArrowUpDown, ShoppingBag, Building2, Layers, CheckCircle2, FileEdit, ClipboardCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useTableSort, sortRows } from "@/hooks/useTableSort";
import SortHeader from "@/components/table/SortHeader";
import TablePagination, { usePagination } from "@/components/table/TablePagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import CourseCard from "@/components/CourseCard";
import RichStatCard from "@/components/admin/stats/RichStatCard";
import AssessmentManager from "@/components/AssessmentManager";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useInlineEnName } from "@/hooks/useI18nMaps";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { EyeOff, Eye as EyeIcon } from "lucide-react";

const statusLabel: Record<string, string> = {
  draft: "초안",
  published: "공개",
  archived: "숨김",
};

const statusColor: Record<string, string> = {
  draft: "bg-amber-500 text-white dark:bg-amber-500 dark:text-white",
  published: "bg-emerald-500 text-white dark:bg-emerald-500 dark:text-white",
  archived: "bg-secondary text-muted-foreground",
};

const difficultyLabel: Record<string, string> = {
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
};

const AdminCourses = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [trackFilter, setTrackFilter] = useState<string>("all"); // 'all' | 'standalone' | <trackId>
  const [standaloneOnly, setStandaloneOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title" | "students">("newest");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [assessmentCourse, setAssessmentCourse] = useState<{ id: string; title: string } | null>(null);
  const { t } = useTranslation();

  const { data: courses = [] } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", "classys-v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, name_en, slug, is_active, display_order")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
  const localizeCatName = useInlineEnName();
  const localizedCategories = categories.map((c: any) => ({ ...c, name: localizeCatName(c) }));

  const { data: enrollmentCounts = {} } = useQuery({
    queryKey: ["admin-enrollment-counts", courses.map((c: any) => c.id)],
    queryFn: async () => {
      const ids = courses.map((c: any) => c.id);
      if (ids.length === 0) return {};
      const { data, error } = await supabase.from("enrollments").select("course_id").in("course_id", ids);
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach((e: any) => { counts[e.course_id] = (counts[e.course_id] || 0) + 1; });
      return counts;
    },
    enabled: courses.length > 0,
  });

  const { data: contentCounts = {} } = useQuery({
    queryKey: ["admin-content-counts", courses.map((c: any) => c.id)],
    queryFn: async () => {
      const ids = courses.map((c: any) => c.id);
      if (ids.length === 0) return {};
      const { data, error } = await supabase.from("course_contents").select("course_id").in("course_id", ids);
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach((e: any) => { counts[e.course_id] = (counts[e.course_id] || 0) + 1; });
      return counts;
    },
    enabled: courses.length > 0,
  });

  const { data: instructorProfiles = [] } = useQuery({
    queryKey: ["instructor-profiles", courses.map((c: any) => c.instructor_id).filter(Boolean)],
    queryFn: async () => {
      const ids = [...new Set(courses.map((c: any) => c.instructor_id).filter(Boolean))];
      if (ids.length === 0) return [];
      const { data, error } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      if (error) throw error;
      return data;
    },
    enabled: courses.length > 0,
  });

  // Tracks + step→course mapping for the track badges and filter
  const { data: tracks = [] } = useQuery({
    queryKey: ["admin-courses-tracks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_tracks")
        .select("id, name, name_en, is_active, sort_order")
        .order("sort_order");
      if (error) throw error;
      return data as Array<{ id: string; name: string; name_en: string | null; is_active: boolean; sort_order: number }>;
    },
  });

  const { data: trackStepCourses = [] } = useQuery({
    queryKey: ["admin-courses-track-step-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("track_step_courses")
        .select("course_id, step:track_steps(id, name, level_order, track_id)")
        .order("sort_order");
      if (error) throw error;
      return data as unknown as Array<{
        course_id: string;
        step: { id: string; name: string; level_order: number; track_id: string } | null;
      }>;
    },
  });

  // Build course_id -> { trackId, trackName, stepName, levelOrder } using the
  // active track with the lowest sort_order so the badge stays consistent with
  // the student-side badge logic (TracksPanel.useCourseTrackMap).
  const trackById = new Map(tracks.map((t) => [t.id, t]));
  const courseTrackInfo = new Map<
    string,
    { trackId: string; trackName: string; trackNameEn: string | null; stepName: string; levelOrder: number; sortOrder: number }
  >();
  // 강의가 속한 모든 활성 트랙 ID 집합 (필터링용)
  const courseTrackIds = new Map<string, Set<string>>();
  trackStepCourses.forEach((row) => {
    const step = row.step;
    if (!step) return;
    const tr = trackById.get(step.track_id);
    if (!tr || tr.is_active === false) return;
    const incoming = {
      trackId: tr.id,
      trackName: tr.name,
      trackNameEn: tr.name_en,
      stepName: step.name,
      levelOrder: step.level_order,
      sortOrder: tr.sort_order ?? 0,
    };
    const existing = courseTrackInfo.get(row.course_id);
    if (!existing || incoming.sortOrder < existing.sortOrder) {
      courseTrackInfo.set(row.course_id, incoming);
    }
    if (!courseTrackIds.has(row.course_id)) courseTrackIds.set(row.course_id, new Set());
    courseTrackIds.get(row.course_id)!.add(tr.id);
  });

  const categoryMap = new Map(localizedCategories.map((c: any) => [c.id, c]));
  const instructorMap = new Map(instructorProfiles.map((p: any) => [p.user_id, p.full_name]));

  const filtered = courses
    .filter((c: any) => {
      const matchSearch = c.title.toLowerCase().includes(search.toLowerCase());
      // "all" 필터에서는 숨김(archived) 강의를 자동으로 제외
      const matchStatus =
        statusFilter === "all"
          ? c.status !== "archived"
          : c.status === statusFilter;
      const matchCategory = categoryFilter === "all" || c.category_id === categoryFilter;
      const trackInfo = courseTrackInfo.get(c.id);
      const matchStandalone = !standaloneOnly || !trackInfo;
      const matchTrack =
        trackFilter === "all"
          ? true
          : trackFilter === "standalone"
            ? !trackInfo
            : (courseTrackIds.get(c.id)?.has(trackFilter) ?? false);
      return matchSearch && matchStatus && matchCategory && matchTrack && matchStandalone;
    })
    .sort((a: any, b: any) => {
      switch (sortBy) {
        case "oldest": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "title": return a.title.localeCompare(b.title);
        case "students": return ((enrollmentCounts as any)[b.id] || 0) - ((enrollmentCounts as any)[a.id] || 0);
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  // 머리글 클릭 정렬(선택 상자 정렬보다 우선) + 페이지 나눔
  const { sort, toggleSort } = useTableSort({ defaultKey: null, defaultDir: "asc" });
  const sortedCourses = useMemo(
    () =>
      sortRows(filtered, sort, {
        title: (c: any) => c.title || "",
        category: (c: any) => categoryMap.get(c.category_id)?.name || "",
        instructor: (c: any) => instructorMap.get(c.instructor_id) || "",
        status: (c: any) => c.status || "",
        price: (c: any) => c.sale_price ?? c.price ?? 0,
        students: (c: any) => (enrollmentCounts as any)[c.id] || 0,
        contents: (c: any) => (contentCounts as any)[c.id] || 0,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, sort, categoryMap, instructorMap, enrollmentCounts, contentCounts],
  );
  const { page, setPage, pageSize, setPageSize, total, totalPages, pageRows } = usePagination(sortedCourses, 20);


  const stats = {
    total: courses.length,
    published: courses.filter((c: any) => c.status === "published").length,
    draft: courses.filter((c: any) => c.status === "draft").length,
    totalStudents: Object.values(enrollmentCounts as Record<string, number>).reduce((a, b) => a + b, 0),
  };

  const goToCourse = (courseId: string) => navigate(`/admin/courses/${courseId}`);

  const toggleVisibility = async (course: any) => {
    const isHidden = course.status === "archived";
    const newStatus = isHidden ? "published" : "archived";
    const { error } = await supabase
      .from("courses")
      .update({ status: newStatus })
      .eq("id", course.id);
    if (error) {
      toast.error("상태 변경에 실패했습니다");
      return;
    }
    toast.success(isHidden ? "강의를 다시 공개했습니다" : "강의를 숨김 처리했습니다");
    // 강의 상태 변경 시 영향받는 모든 화면의 캐시를 무효화
    queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
    queryClient.invalidateQueries({ queryKey: ["admin-comp-courses"] });
    queryClient.invalidateQueries({ queryKey: ["admin-comp-enrollments"] });
    queryClient.invalidateQueries({ queryKey: ["admin-comp-certificates"] });
    queryClient.invalidateQueries({ queryKey: ["admin-comp-criteria"] });
    queryClient.invalidateQueries({ queryKey: ["admin-learning-courses"] });
    queryClient.invalidateQueries({ queryKey: ["all-courses-for-tracks"] });
    queryClient.invalidateQueries({ queryKey: ["storefront-courses"] });
    queryClient.invalidateQueries({ queryKey: ["courses"] });
  };

  const updateCategory = async (courseId: string, newCategoryId: string | null) => {
    const { error } = await supabase
      .from("courses")
      .update({ category_id: newCategoryId })
      .eq("id", courseId);
    if (error) {
      toast.error("카테고리 변경에 실패했습니다");
      return;
    }
    toast.success("카테고리를 변경했습니다");
    queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2"><BookOpen className="h-6 w-6" aria-hidden="true" />{t("admin.courseManagement")}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t("admin.courseManagementDesc")}</p>
          </div>
          <Link to="/admin/courses/new">
            <Button className="rounded-xl gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" /> {t("admin.newCourse")}
            </Button>
          </Link>
        </div>

        {/* Summary Stats — visualized */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <RichStatCard
            label={t("admin.totalCoursesLabel")}
            value={stats.total}
            icon={BookOpen}
            tone="indigo"
            visual="bar"
            barValue={100}
            barCaption={`${stats.published} 공개 / ${stats.draft} 초안`}
          />
          <RichStatCard
            label={t("admin.publishedCourses")}
            value={stats.published}
            icon={CheckCircle2}
            tone="emerald"
            visual="ring"
            ringValue={stats.total > 0 ? Math.round((stats.published / stats.total) * 100) : 0}
            sub={stats.total > 0 ? `${Math.round((stats.published / stats.total) * 100)}%` : "0%"}
          />
          <RichStatCard
            label={t("teacher.draft")}
            value={stats.draft}
            icon={FileEdit}
            tone="amber"
            visual="ring"
            ringValue={stats.total > 0 ? Math.round((stats.draft / stats.total) * 100) : 0}
            sub={stats.total > 0 ? `${Math.round((stats.draft / stats.total) * 100)}%` : "0%"}
          />
          <RichStatCard
            label={t("admin.totalStudents")}
            value={stats.totalStudents}
            icon={Users}
            tone="sky"
            visual="sparkline"
            sparklineValues={[3, 6, 4, 7, 5, 8, 9]}
          />
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("course.searchCourse")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 rounded-xl border-border"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-28 rounded-xl h-10">
              <SelectValue placeholder={t("common.filter")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all") || "전체"}</SelectItem>
              <SelectItem value="published">{t("teacher.published")}</SelectItem>
              <SelectItem value="draft">{t("teacher.draft")}</SelectItem>
              <SelectItem value="archived">숨김</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-36 rounded-xl h-10">
              <SelectValue placeholder={t("course.category") || "카테고리"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all") || "전체"}</SelectItem>
              {localizedCategories.map((cat: any) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={trackFilter} onValueChange={setTrackFilter}>
            <SelectTrigger className="w-52 rounded-xl h-10 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <Layers className="h-3.5 w-3.5 shrink-0" />
                <SelectValue placeholder="트랙" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 (단과+트랙)</SelectItem>
              <SelectItem value="standalone">단과 강의만</SelectItem>
              {tracks.filter((tr) => tr.is_active).map((tr) => (
                <SelectItem key={tr.id} value={tr.id}>{tr.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 px-3 h-10 rounded-xl border border-border">
            <Switch
              id="standalone-only"
              checked={standaloneOnly}
              onCheckedChange={setStandaloneOnly}
            />
            <Label htmlFor="standalone-only" className="text-xs cursor-pointer whitespace-nowrap">
              단과만
            </Label>
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-32 rounded-xl h-10">
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="h-3.5 w-3.5" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{t("common.newest") || "최신순"}</SelectItem>
              <SelectItem value="oldest">{t("common.oldest") || "오래된순"}</SelectItem>
              <SelectItem value="title">{t("common.nameOrder") || "이름순"}</SelectItem>
              <SelectItem value="students">{t("common.popularOrder") || "수강생순"}</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={`p-2.5 transition-colors ${viewMode === "list" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"}`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2.5 transition-colors ${viewMode === "grid" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {filtered.length === 0 ? (
          <div className="stat-card text-center py-16">
            <div className="space-y-3">
              <BookOpen className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">{t("admin.noCoursesFound")}</p>
              <Link to="/admin/courses/new">
                <Button size="sm" className="rounded-xl gap-2 mt-2">
                  <Plus className="h-3.5 w-3.5" /> {t("admin.newCourse")}
                </Button>
              </Link>
            </div>
          </div>
        ) : viewMode === "list" ? (
          <div className="stat-card !p-0 overflow-x-auto">
            <table className="w-full min-w-[640px] sm:min-w-0">
              <thead>
              <tr className="border-b border-border bg-secondary/30">
                  <SortHeader sortKey="title" label={t("course.course") || "강의"} sort={sort} onToggle={toggleSort} />
                  <SortHeader sortKey="category" label={t("course.category") || "카테고리"} sort={sort} onToggle={toggleSort} className="hidden md:table-cell" />
                  <SortHeader sortKey="instructor" label={t("course.instructor") || "강사"} sort={sort} onToggle={toggleSort} className="hidden lg:table-cell" />
                  <SortHeader sortKey="status" label={t("teacher.status") || "상태"} sort={sort} onToggle={toggleSort} align="center" className="hidden sm:table-cell" />
                  <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">공개 범위</th>
                  <SortHeader sortKey="price" label="가격" sort={sort} onToggle={toggleSort} align="center" className="hidden lg:table-cell" />
                  <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">{t("common.required") || "필수"}</th>
                  <SortHeader sortKey="students" label={t("admin.totalStudents") || "수강생"} sort={sort} onToggle={toggleSort} align="center" className="hidden sm:table-cell" />
                  <SortHeader sortKey="contents" label={t("course.content") || "차시"} sort={sort} onToggle={toggleSort} align="center" className="hidden sm:table-cell" />
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3 sticky right-0 bg-secondary/30 sm:static">{t("common.manage") || "관리"}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((course: any) => {
                  const cat = categoryMap.get(course.category_id);
                  const students = (enrollmentCounts as any)[course.id] || 0;
                  const contents = (contentCounts as any)[course.id] || 0;
                  const instructor = instructorMap.get(course.instructor_id);
                  const daysLeft = course.deadline ? Math.ceil((new Date(course.deadline).getTime() - Date.now()) / 86400000) : null;

                  return (
                    <tr
                      key={course.id}
                      className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors cursor-pointer"
                      onClick={() => goToCourse(course.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-16 rounded-lg overflow-hidden shrink-0 bg-secondary">
                            {course.thumbnail_url ? (
                              <img src={course.thumbnail_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center">
                                <BookOpen className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-medium text-foreground truncate max-w-[140px] sm:max-w-[200px] lg:max-w-[260px]">
                                {course.title}
                              </p>
                              {(() => {
                                const ti = courseTrackInfo.get(course.id);
                                if (!ti) return null;
                                return (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] h-5 gap-1 border-primary/30 bg-primary/5 text-primary font-normal whitespace-nowrap max-w-[160px] sm:max-w-none truncate"
                                    title={`${ti.trackName} · ${ti.stepName}`}
                                  >
                                    <Layers className="h-2.5 w-2.5" />
                                    <span className="truncate">{ti.trackName} · {ti.stepName}</span>
                                  </Badge>
                                );
                              })()}
                            </div>
                            {course.description && (
                              <p className="text-[11px] text-muted-foreground truncate max-w-[140px] sm:max-w-[200px] lg:max-w-[280px] mt-0.5">
                                {course.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell" onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={course.category_id || "__none__"}
                          onValueChange={(v) => updateCategory(course.id, v === "__none__" ? null : v)}
                        >
                          <SelectTrigger className="h-8 rounded-lg text-xs w-[140px]">
                            <SelectValue placeholder="미지정" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__" className="text-xs text-muted-foreground">미지정</SelectItem>
                            {localizedCategories.map((c: any) => (
                              <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">{instructor || "-"}</span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-center">
                        <span className={`inline-flex text-[10px] font-semibold px-2.5 py-1 rounded-lg ${statusColor[course.status || "draft"]}`}>
                          {statusLabel[course.status || "draft"] || course.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-center">
                        {course.is_b2c ? (
                          <span className="inline-flex items-center gap-1 text-xs text-primary">
                            <ShoppingBag className="h-3 w-3" /> 외부 공개
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3" /> 사내
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-center">
                        {course.is_b2c ? (
                          <span className="text-xs font-medium text-foreground">
                            {course.price === 0 ? "무료" : `${(course.price || 0).toLocaleString()}원`}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-center">
                        {course.is_mandatory ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <Badge variant="destructive" className="text-[10px] h-5 gap-0.5 whitespace-nowrap">
                              <AlertTriangle className="h-2.5 w-2.5" /> {t("common.required")}
                            </Badge>
                            {daysLeft !== null && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <CalendarClock className="h-2.5 w-2.5" />
                                {daysLeft > 0 ? `D-${daysLeft}` : daysLeft === 0 ? "D-Day" : t("student.overdue")}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-center">
                        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" /> {students}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-center">
                        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                          <BookOpen className="h-3 w-3" /> {contents}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right sticky right-0 bg-background sm:static sm:bg-transparent">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); goToCourse(course.id); }}>
                              <Eye className="h-3.5 w-3.5 mr-2" /> {t("common.preview") || "미리보기"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); goToCourse(course.id); }}>
                              <Edit className="h-3.5 w-3.5 mr-2" /> {t("common.edit") || "수정"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setAssessmentCourse({ id: course.id, title: course.title }); }}>
                              <ClipboardCheck className="h-3.5 w-3.5 mr-2" /> 평가 설정
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toggleVisibility(course); }}>
                              {course.status === "archived" ? (
                                <><EyeIcon className="h-3.5 w-3.5 mr-2" /> 다시 공개</>
                              ) : (
                                <><EyeOff className="h-3.5 w-3.5 mr-2" /> 숨기기</>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <TablePagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </div>
        ) : (
          <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pageRows.map((course: any) => {
              const cat = categoryMap.get(course.category_id);
              const enrollment = (enrollmentCounts as any)[course.id] || 0;
              const ti = courseTrackInfo.get(course.id);
              return (
                <CourseCard
                  key={course.id}
                  course={course}
                  categorySlug={cat?.slug}
                  categoryName={cat?.name}
                  studentCount={enrollment}
                  instructorName={instructorMap.get(course.instructor_id)}
                  variant="admin"
                  href={`/admin/courses/${course.id}`}
                  trackBadge={ti ? { trackName: ti.trackName, stepName: ti.stepName } : null}
                />
              );
            })}
          </div>
          <TablePagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </div>
        )}
      </div>
      <Dialog open={!!assessmentCourse} onOpenChange={(o) => !o && setAssessmentCourse(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>평가 설정 — {assessmentCourse?.title}</DialogTitle>
          </DialogHeader>
          {assessmentCourse && <AssessmentManager courseId={assessmentCourse.id} />}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminCourses;
