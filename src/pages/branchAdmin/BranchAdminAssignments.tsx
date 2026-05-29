import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ClipboardCheck, Lock, Plus, Layers, BookOpen, Search, Users,
  CheckCircle2, AlertCircle, Trash2, Filter, ListChecks, Sparkles,
} from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useBranchAdmin } from "@/hooks/useBranchAdmin";
import { cn } from "@/lib/utils";

type Mode = "track" | "course";

interface TrackRow {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  is_active: boolean;
  target_scope: string;
  target_branch_ids: string[] | null;
}

interface CourseRow {
  id: string;
  title: string;
}

interface StaffRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  department_id: string | null;
}

const BranchAdminAssignments = () => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const { toast } = useToast();
  const qc = useQueryClient();
  const { branchIds, branches, hasCapability, isLoading: loadingBA } = useBranchAdmin();
  const canAssign = branchIds.some((b) => hasCapability("track_assign", b));

  const [mode, setMode] = useState<Mode>("track");
  const [selectedTrack, setSelectedTrack] = useState<string>("");
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [staffSearch, setStaffSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [unassignTarget, setUnassignTarget] = useState<{ uid: string; name: string } | null>(null);

  // ---------- Branches/depts ----------
  const { data: depts = [] } = useQuery({
    queryKey: ["ba-assign-depts", branchIds],
    enabled: branchIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("departments")
        .select("id, name, name_en, parent_department_id")
        .or(`id.in.(${branchIds.join(",")}),parent_department_id.in.(${branchIds.join(",")})`);
      return data ?? [];
    },
  });
  const deptIds = useMemo(() => depts.map((d) => d.id), [depts]);

  // ---------- Staff ----------
  const { data: staff = [] } = useQuery({
    queryKey: ["ba-assign-staff", deptIds],
    enabled: deptIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, department_id")
        .in("department_id", deptIds)
        .order("full_name");
      return (data ?? []) as StaffRow[];
    },
  });

  // ---------- Tracks ----------
  const { data: tracks = [] } = useQuery({
    queryKey: ["ba-assign-tracks", branchIds],
    enabled: branchIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("learning_tracks")
        .select("id, name, name_en, description, description_en, is_active, target_scope, target_branch_ids")
        .eq("is_active", true)
        .or(`target_scope.eq.all,target_branch_ids.ov.{${branchIds.join(",")}}`)
        .order("created_at", { ascending: false });
      return (data ?? []) as TrackRow[];
    },
  });

  // ---------- Courses ----------
  const { data: courses = [] } = useQuery({
    queryKey: ["ba-assign-courses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("id, title")
        .order("title");
      return (data ?? []) as CourseRow[];
    },
  });

  // ---------- Track → courses (via track_steps + track_step_courses) ----------
  const { data: trackCourses = [] } = useQuery({
    queryKey: ["ba-track-courses", selectedTrack],
    enabled: !!selectedTrack && mode === "track",
    queryFn: async () => {
      const { data: steps } = await supabase
        .from("track_steps")
        .select("id, name, name_en, level_order")
        .eq("track_id", selectedTrack)
        .order("level_order");
      if (!steps?.length) return [];
      const stepIds = steps.map((s) => s.id);
      const { data: tsc } = await supabase
        .from("track_step_courses")
        .select("step_id, course_id, is_required, sort_order, course:courses(id, title)")
        .in("step_id", stepIds)
        .order("sort_order");
      return (tsc ?? []).map((row: any) => ({
        course_id: row.course_id,
        title: row.course?.title || "",
        is_required: row.is_required,
        step_name: steps.find((s) => s.id === row.step_id)?.name || "",
      }));
    },
  });

  const trackCourseIds = useMemo(() => trackCourses.map((c) => c.course_id), [trackCourses]);

  // ---------- Existing enrollments (for currently chosen item) ----------
  const targetCourseIds = mode === "track" ? trackCourseIds : selectedCourse ? [selectedCourse] : [];

  const { data: enrollments = [] } = useQuery({
    queryKey: ["ba-existing-enrollments", targetCourseIds, deptIds],
    enabled: targetCourseIds.length > 0 && deptIds.length > 0,
    queryFn: async () => {
      const staffIds = staff.map((s) => s.user_id);
      if (!staffIds.length) return [];
      const { data } = await supabase
        .from("enrollments")
        .select("user_id, course_id, status, progress")
        .in("course_id", targetCourseIds)
        .in("user_id", staffIds);
      return data ?? [];
    },
  });

  // user_id -> set of course_ids enrolled
  const enrolledByUser = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const e of enrollments) {
      (map[e.user_id] ??= new Set()).add(e.course_id);
    }
    return map;
  }, [enrollments]);

  // user_id -> coverage (fully / partial / none) for current track/course
  const coverageOf = (uid: string): "full" | "partial" | "none" => {
    const set = enrolledByUser[uid];
    if (!targetCourseIds.length || !set || set.size === 0) return "none";
    const have = targetCourseIds.filter((cid) => set.has(cid)).length;
    if (have === targetCourseIds.length) return "full";
    if (have > 0) return "partial";
    return "none";
  };

  // ---------- Filtered staff list ----------
  const filteredStaff = useMemo(() => {
    return staff.filter((s) => {
      if (branchFilter !== "all") {
        const dept = depts.find((d) => d.id === s.department_id);
        const inBranch = dept && (dept.id === branchFilter || dept.parent_department_id === branchFilter);
        if (!inBranch) return false;
      }
      if (staffSearch.trim()) {
        const q = staffSearch.toLowerCase();
        return (s.full_name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q));
      }
      return true;
    });
  }, [staff, depts, branchFilter, staffSearch]);

  // ---------- Stats ----------
  const stats = useMemo(() => {
    const total = filteredStaff.length;
    let full = 0, partial = 0, none = 0;
    for (const s of filteredStaff) {
      const c = coverageOf(s.user_id);
      if (c === "full") full++;
      else if (c === "partial") partial++;
      else none++;
    }
    return { total, full, partial, none };
  }, [filteredStaff, enrolledByUser, targetCourseIds]);

  // ---------- Mutations ----------
  const assign = useMutation({
    mutationFn: async () => {
      if (mode === "track" && !selectedTrack) throw new Error(t("branchAdminAssign.selectTrack", "트랙을 선택해주세요"));
      if (mode === "course" && !selectedCourse) throw new Error(t("branchAdminAssign.selectCourseErr", "강의를 선택해주세요"));
      if (selectedStaff.length === 0) throw new Error(t("branchAdminAssign.selectStaffErr", "회원을 선택해주세요"));
      if (mode === "track" && trackCourseIds.length === 0) throw new Error(t("branchAdminAssign.emptyTrack", "선택한 트랙에 강의가 없습니다"));

      const courseIds = mode === "track" ? trackCourseIds : [selectedCourse];
      const rows: any[] = [];
      for (const uid of selectedStaff) {
        for (const cid of courseIds) {
          rows.push({ user_id: uid, course_id: cid, status: "approved" });
        }
      }
      const { error } = await supabase
        .from("enrollments")
        .upsert(rows, { onConflict: "user_id,course_id" });
      if (error) throw error;
      return { staff: selectedStaff.length, courses: courseIds.length };
    },
    onSuccess: ({ staff: s, courses: c }) => {
      toast({
        title: mode === "track"
          ? t("branchAdminAssign.trackDone", "{{staff}}명에게 {{courses}}개 강의 배정 완료", { staff: s, courses: c })
          : t("branchAdminAssign.done", "{{count}}명에게 배정 완료", { count: s }),
      });
      setSelectedStaff([]);
      qc.invalidateQueries({ queryKey: ["ba-existing-enrollments"] });
      qc.invalidateQueries({ queryKey: ["enrollments"] });
    },
    onError: (e: Error) =>
      toast({ title: t("common.error", "오류"), description: e.message, variant: "destructive" }),
  });

  const unassign = useMutation({
    mutationFn: async (uid: string) => {
      if (targetCourseIds.length === 0) return;
      // Only remove rows that have not started yet (progress = 0)
      const { error } = await supabase
        .from("enrollments")
        .delete()
        .eq("user_id", uid)
        .in("course_id", targetCourseIds)
        .lte("progress", 0);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("branchAdminAssign.unassigned", "배정 해제 완료") });
      setUnassignTarget(null);
      qc.invalidateQueries({ queryKey: ["ba-existing-enrollments"] });
    },
    onError: (e: Error) =>
      toast({ title: t("common.error", "오류"), description: e.message, variant: "destructive" }),
  });

  // ---------- Helpers ----------
  const trackName = (tr: TrackRow) => (isEn ? tr.name_en || tr.name : tr.name);
  const allFilteredSelected =
    filteredStaff.length > 0 && filteredStaff.every((s) => selectedStaff.includes(s.user_id));

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelectedStaff((prev) => prev.filter((id) => !filteredStaff.some((s) => s.user_id === id)));
    } else {
      const ids = filteredStaff.map((s) => s.user_id);
      setSelectedStaff((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  const selectByCoverage = (cov: "none" | "partial") => {
    const ids = filteredStaff.filter((s) => coverageOf(s.user_id) === cov).map((s) => s.user_id);
    setSelectedStaff(ids);
  };

  if (loadingBA) {
    return (
      <DashboardLayout role="branch_admin">
        <div className="p-6 text-muted-foreground">{t("common.loading", "불러오는 중...")}</div>
      </DashboardLayout>
    );
  }
  if (!canAssign) {
    return (
      <DashboardLayout role="branch_admin">
        <div className="p-6 text-center text-muted-foreground">
          <Lock className="h-12 w-12 mx-auto mb-3 opacity-50" />
          {t("branchAdmin.noAssignPerm", "배정 권한이 없습니다.")}
        </div>
      </DashboardLayout>
    );
  }

  const currentTrack = tracks.find((tr) => tr.id === selectedTrack);

  return (
    <DashboardLayout role="branch_admin">
      <div className="min-w-0 space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div>
          <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-semibold">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            {t("nav.branchAdminAssign", "트랙/강의 배정")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("branchAdminAssign.subtitle2", "학습 트랙 또는 단일 강의를 지점 회원에게 한 번에 배정하고 진척 현황을 확인하세요.")}
          </p>
        </div>

        {/* Mode tabs */}
        <Tabs value={mode} onValueChange={(v) => { setMode(v as Mode); setSelectedStaff([]); }}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="track" className="gap-2">
              <Layers className="h-4 w-4" />
              {t("branchAdminAssign.modeTrack", "트랙 배정")}
            </TabsTrigger>
            <TabsTrigger value="course" className="gap-2">
              <BookOpen className="h-4 w-4" />
              {t("branchAdminAssign.modeCourse", "단일 강의")}
            </TabsTrigger>
          </TabsList>

          {/* TRACK MODE */}
          <TabsContent value="track" className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                {t("branchAdminAssign.selectTrackLabel", "배정할 트랙 선택")}
                <Badge variant="outline" className="text-[10px]">{tracks.length}</Badge>
              </label>
              {tracks.length === 0 ? (
                <div className="border-2 border-dashed border-border/60 rounded-lg p-8 text-center text-muted-foreground text-sm">
                  {t("branchAdminAssign.noTracks", "배정 가능한 트랙이 없습니다. 먼저 트랙을 생성해주세요.")}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {tracks.map((tr) => {
                    const active = tr.id === selectedTrack;
                    return (
                      <button
                        key={tr.id}
                        type="button"
                        onClick={() => setSelectedTrack(tr.id)}
                        className={cn(
                          "text-left rounded-lg border-2 p-4 transition-all",
                          active
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border/60 hover:border-border bg-card"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Layers className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                            <span className="font-semibold text-sm truncate">{trackName(tr)}</span>
                          </div>
                          {active && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                        </div>
                        {tr.description && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                            {isEn ? tr.description_en || tr.description : tr.description}
                          </p>
                        )}
                        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Badge variant="secondary" className="text-[10px]">
                            {tr.target_scope === "all"
                              ? t("branchAdminAssign.scopeAll", "전체 공개")
                              : t("branchAdminAssign.scopeBranch", "지점 전용")}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {currentTrack && (
              <div className="rounded-lg border-2 border-border/60 bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <ListChecks className="h-4 w-4 text-primary" />
                  {t("branchAdminAssign.includedCourses", "트랙 포함 강의")}
                  <Badge variant="outline">{trackCourses.length}</Badge>
                </div>
                {trackCourses.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("branchAdminAssign.trackEmpty", "이 트랙에는 등록된 강의가 없습니다. 트랙 관리에서 강의를 추가해주세요.")}
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {trackCourses.map((c, i) => (
                      <li key={`${c.course_id}-${i}`} className="text-sm flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-6 tabular-nums">{i + 1}.</span>
                        <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{c.title}</span>
                        {c.is_required && (
                          <Badge variant="outline" className="text-[9px] ml-auto">
                            {t("branchAdminAssign.required", "필수")}
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </TabsContent>

          {/* COURSE MODE */}
          <TabsContent value="course" className="space-y-2 mt-4">
            <label className="text-sm font-medium">{t("branchAdminAssign.selectCourse", "강의 선택")}</label>
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder={t("branchAdminAssign.selectCoursePh", "강의를 선택하세요")} />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TabsContent>
        </Tabs>

        {/* Stats summary */}
        {targetCourseIds.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile
              icon={<Users className="h-4 w-4" />}
              label={t("branchAdminAssign.statTotal", "대상 회원")}
              value={stats.total}
              tone="default"
            />
            <StatTile
              icon={<CheckCircle2 className="h-4 w-4" />}
              label={t("branchAdminAssign.statFull", "이미 전체 배정")}
              value={stats.full}
              tone="emerald"
            />
            <StatTile
              icon={<AlertCircle className="h-4 w-4" />}
              label={t("branchAdminAssign.statPartial", "부분 배정")}
              value={stats.partial}
              tone="amber"
              actionLabel={stats.partial > 0 ? t("branchAdminAssign.selectThese", "선택") : undefined}
              onAction={() => selectByCoverage("partial")}
            />
            <StatTile
              icon={<Sparkles className="h-4 w-4" />}
              label={t("branchAdminAssign.statNone", "미배정")}
              value={stats.none}
              tone="rose"
              actionLabel={stats.none > 0 ? t("branchAdminAssign.selectThese", "선택") : undefined}
              onAction={() => selectByCoverage("none")}
            />
          </div>
        )}

        {/* Staff selection */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              {t("branchAdminAssign.selectStaff", "회원 선택")}
              <Badge variant="outline">{selectedStaff.length} / {filteredStaff.length}</Badge>
            </label>
            <div className="flex items-center gap-2">
              {branches.length > 1 && (
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger className="h-9 w-44 text-xs">
                    <Filter className="h-3.5 w-3.5 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("branchAdminAssign.allBranches", "모든 지점")}</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{isEn ? b.name_en || b.name : b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  placeholder={t("branchAdminAssign.searchStaff", "이름 또는 이메일 검색")}
                  className="h-9 pl-7 w-56 text-xs"
                />
              </div>
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs text-primary hover:underline whitespace-nowrap"
              >
                {allFilteredSelected
                  ? t("common.deselectAll", "전체 해제")
                  : t("common.selectAll", "전체 선택")}
              </button>
            </div>
          </div>

          <div className="border-2 border-border/80 rounded-md max-h-[480px] overflow-y-auto">
            {filteredStaff.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                {t("branchAdminAssign.noStaff", "표시할 회원이 없습니다")}
              </div>
            ) : (
              filteredStaff.map((s) => {
                const cov = coverageOf(s.user_id);
                const checked = selectedStaff.includes(s.user_id);
                return (
                  <div
                    key={s.user_id}
                    className="flex items-center gap-3 p-3 border-b-2 border-border/60 last:border-b-0 hover:bg-muted/30"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(chk) =>
                        setSelectedStaff((arr) =>
                          chk ? [...arr, s.user_id] : arr.filter((id) => id !== s.user_id),
                        )
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm">{s.full_name || "-"}</div>
                      <div className="text-xs text-muted-foreground truncate">{s.email}</div>
                    </div>
                    {targetCourseIds.length > 0 && (
                      <CoverageBadge cov={cov} t={t} />
                    )}
                    {targetCourseIds.length > 0 && cov !== "none" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        title={t("branchAdminAssign.unassign", "배정 해제(미시작 항목만)")}
                        onClick={() => setUnassignTarget({ uid: s.user_id, name: s.full_name || s.email || "" })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Submit bar */}
        <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-background/95 backdrop-blur border-t-2 border-border/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {mode === "track" && currentTrack ? (
              <>
                <span className="font-medium text-foreground">{trackName(currentTrack)}</span>
                {" · "}
                {t("branchAdminAssign.summaryTrack", "{{c}}개 강의 × {{s}}명", {
                  c: trackCourses.length,
                  s: selectedStaff.length,
                })}
              </>
            ) : mode === "course" && selectedCourse ? (
              <>
                <span className="font-medium text-foreground">
                  {courses.find((c) => c.id === selectedCourse)?.title}
                </span>
                {" · "}
                {t("branchAdminAssign.summaryCourse", "{{s}}명 배정 예정", { s: selectedStaff.length })}
              </>
            ) : (
              t("branchAdminAssign.pickFirst", "먼저 트랙 또는 강의를 선택하세요")
            )}
          </div>
          <Button
            onClick={() => assign.mutate()}
            disabled={
              selectedStaff.length === 0 ||
              (mode === "track" && (!selectedTrack || trackCourseIds.length === 0)) ||
              (mode === "course" && !selectedCourse) ||
              assign.isPending
            }
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {assign.isPending
              ? t("common.processing", "처리 중...")
              : t("branchAdminAssign.assignNow", "배정하기")}
          </Button>
        </div>
      </div>

      <AlertDialog open={!!unassignTarget} onOpenChange={(o) => !o && setUnassignTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("branchAdminAssign.unassignTitle", "배정 해제")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("branchAdminAssign.unassignDesc", "{{name}}님의 미시작 강의 배정만 해제됩니다. 이미 학습을 시작한 강의는 보존됩니다.", { name: unassignTarget?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "취소")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => unassignTarget && unassign.mutate(unassignTarget.uid)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("branchAdminAssign.unassign", "배정 해제")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

const toneClass: Record<string, string> = {
  default: "border-border/80 bg-card",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100",
  amber: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100",
  rose: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-100",
};

const StatTile = ({
  icon, label, value, tone = "default", actionLabel, onAction,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: keyof typeof toneClass;
  actionLabel?: string;
  onAction?: () => void;
}) => (
  <div className={cn("rounded-lg border-2 p-3", toneClass[tone])}>
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs opacity-80 flex items-center gap-1.5">{icon}{label}</span>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} className="text-[10px] underline opacity-80 hover:opacity-100">
          {actionLabel}
        </button>
      )}
    </div>
    <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
  </div>
);

const CoverageBadge = ({ cov, t }: { cov: "full" | "partial" | "none"; t: any }) => {
  if (cov === "full") {
    return (
      <Badge variant="outline" className="text-[10px] gap-1 border-emerald-300 text-emerald-700 dark:text-emerald-300 dark:border-emerald-800">
        <CheckCircle2 className="h-3 w-3" />
        {t("branchAdminAssign.covFull", "전체 배정")}
      </Badge>
    );
  }
  if (cov === "partial") {
    return (
      <Badge variant="outline" className="text-[10px] gap-1 border-amber-300 text-amber-700 dark:text-amber-300 dark:border-amber-800">
        <AlertCircle className="h-3 w-3" />
        {t("branchAdminAssign.covPartial", "부분 배정")}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
      {t("branchAdminAssign.covNone", "미배정")}
    </Badge>
  );
};

export default BranchAdminAssignments;
