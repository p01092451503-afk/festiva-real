import { Trophy, Download, Settings, FileImage, Award, ChevronDown, ChevronUp, Layers, Eye, Printer } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import CompletionCriteriaDialog from "@/components/admin/CompletionCriteriaDialog";
import CertificateTemplateDialog from "@/components/admin/CertificateTemplateDialog";
import BulkCompletionSettingsDialog from "@/components/admin/BulkCompletionSettingsDialog";
import { generateCertificateImage, downloadBlob } from "@/lib/certificateGenerator";
import CompletionRosterPrint, { type RosterRow } from "@/components/admin/CompletionRosterPrint";

const AdminCompletion = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [trackFilter, setTrackFilter] = useState<string>("all"); // 'all' | 'standalone' | <trackId>
  const [criteriaDialog, setCriteriaDialog] = useState<{ open: boolean; courseId: string; courseName: string }>({ open: false, courseId: "", courseName: "" });
  const [templateDialog, setTemplateDialog] = useState<{ open: boolean; courseId: string; courseName: string }>({ open: false, courseId: "", courseName: "" });
  const [issuingCert, setIssuingCert] = useState<string | null>(null);
  const [bulkDialog, setBulkDialog] = useState(false);
  const [rosterDialog, setRosterDialog] = useState<{ open: boolean; courseTitle: string; rows: RosterRow[] }>({ open: false, courseTitle: "", rows: [] });
  const [previewState, setPreviewState] = useState<{
    open: boolean;
    loading: boolean;
    imageUrl: string | null;
    studentName: string;
    courseName: string;
    enrollment: any | null;
  }>({ open: false, loading: false, imageUrl: null, studentName: "", courseName: "", enrollment: null });

  const { data: courses = [] } = useQuery({
    queryKey: ["admin-comp-courses", "exclude-archived-v1"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, status, is_mandatory")
        .neq("status", "archived")
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["admin-comp-enrollments", "exclude-archived-v1"],
    queryFn: async () => {
      // archived(숨김) 강의의 enrollments는 즉시 노출되지 않도록 클라이언트에서도 제외
      const { data: archivedCourses } = await supabase
        .from("courses")
        .select("id")
        .eq("status", "archived");
      const archivedIds = new Set((archivedCourses || []).map((c: any) => c.id));
      const { data, error } = await supabase
        .from("enrollments")
        .select("id, user_id, course_id, progress, completed_at");
      if (error) throw error;
      return (data || []).filter((e: any) => !archivedIds.has(e.course_id));
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-comp-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, department_id, team_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["admin-comp-departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, name_en");
      if (error) throw error;
      return data;
    },
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["admin-comp-attendance"],
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance").select("user_id, course_id, status");
      if (error) throw error;
      return data;
    },
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ["admin-comp-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assignment_submissions").select("student_id, score, status, assignment_id");
      if (error) throw error;
      return data;
    },
  });

  const { data: criteriaList = [] } = useQuery({
    queryKey: ["admin-comp-criteria"],
    queryFn: async () => {
      const { data, error } = await supabase.from("completion_criteria").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: certificates = [] } = useQuery({
    queryKey: ["admin-comp-certificates", "exclude-archived-v1"],
    queryFn: async () => {
      const { data: archivedCourses } = await supabase
        .from("courses")
        .select("id")
        .eq("status", "archived");
      const archivedIds = new Set((archivedCourses || []).map((c: any) => c.id));
      const { data, error } = await supabase.from("certificates").select("*");
      if (error) throw error;
      return (data || []).filter((c: any) => !archivedIds.has(c.course_id));
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["admin-comp-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("certificate_templates").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: assessmentAttempts = [] } = useQuery({
    queryKey: ["admin-comp-assessment-attempts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assessment_attempts").select("user_id, assessment_id, score, passed, completed_at");
      if (error) throw error;
      return data;
    },
  });

  // Tracks + step→course mapping for the track badges and filter (parity with AdminCourses)
  const { data: tracks = [] } = useQuery({
    queryKey: ["admin-comp-tracks"],
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
    queryKey: ["admin-comp-track-step-courses"],
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

  const trackById = new Map(tracks.map((tr) => [tr.id, tr]));
  const courseTrackInfo = new Map<
    string,
    { trackId: string; trackName: string; stepName: string; levelOrder: number; sortOrder: number }
  >();
  // 강의가 속한 모든 활성 트랙 ID 집합 (필터링용 — 단일 매핑이 아닌 다중 매핑 지원)
  const courseTrackIds = new Map<string, Set<string>>();
  trackStepCourses.forEach((row) => {
    const step = row.step;
    if (!step) return;
    const tr = trackById.get(step.track_id);
    if (!tr || tr.is_active === false) return;
    const incoming = {
      trackId: tr.id,
      trackName: tr.name,
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

  const profileMap = new Map(profiles.map((p: any) => [p.user_id, p.full_name]));
  const emailMap = new Map(profiles.map((p: any) => [p.user_id, p.email || ""]));
  const profileFullMap = new Map(profiles.map((p: any) => [p.user_id, p]));
  const deptMap = new Map(departments.map((d: any) => [d.id, d]));
  const criteriaMap = new Map(criteriaList.map((c: any) => [c.course_id, c]));
  const templateMap = new Map(templates.map((t: any) => [t.course_id, t]));
  const certSet = new Set(certificates.map((c: any) => `${c.user_id}_${c.course_id}`));

  const bestScoreByUser = new Map<string, number>();
  assessmentAttempts.forEach((a: any) => {
    if (a.score != null && a.completed_at) {
      const cur = bestScoreByUser.get(a.user_id) || 0;
      if (Number(a.score) > cur) bestScoreByUser.set(a.user_id, Number(a.score));
    }
  });

  const enrollmentsByCourse = new Map<string, any[]>();
  enrollments.forEach((e: any) => {
    if (!enrollmentsByCourse.has(e.course_id)) enrollmentsByCourse.set(e.course_id, []);
    enrollmentsByCourse.get(e.course_id)!.push(e);
  });

  const attendanceByUserCourse = new Map<string, { total: number; present: number }>();
  attendance.forEach((a: any) => {
    const key = `${a.user_id}_${a.course_id}`;
    if (!attendanceByUserCourse.has(key)) attendanceByUserCourse.set(key, { total: 0, present: 0 });
    const value = attendanceByUserCourse.get(key)!;
    value.total++;
    if (a.status === "present" || a.status === "late") value.present++;
  });

  const scoreByStudent = new Map<string, { total: number; count: number }>();
  submissions.forEach((s: any) => {
    if (s.score == null) return;
    if (!scoreByStudent.has(s.student_id)) scoreByStudent.set(s.student_id, { total: 0, count: 0 });
    const value = scoreByStudent.get(s.student_id)!;
    value.total += s.score;
    value.count++;
  });

  const getCompletionStatus = (e: any) => {
    const criteria = criteriaMap.get(e.course_id);
    const progress = Number(e.progress) || 0;
    const minProgress = criteria ? Number(criteria.min_progress_pct) : 80;
    const minScore = criteria?.min_assessment_score != null ? Number(criteria.min_assessment_score) : null;
    if (progress < minProgress) return false;
    if (minScore != null) {
      const userScore = bestScoreByUser.get(e.user_id);
      if (userScore == null || userScore < minScore) return false;
    }
    if (e.completed_at) return true;
    return progress >= minProgress;
  };

  const getReqText = (courseId: string) => {
    const criteria = criteriaMap.get(courseId);
    if (!criteria) return t("admin.progress80");
    const parts = [t("admin.progressReq", { pct: criteria.min_progress_pct })];
    if (criteria.min_assessment_score != null) parts.push(t("admin.assessmentReq", { score: criteria.min_assessment_score }));
    return parts.join(" + ");
  };

  const hasCert = (userId: string, courseId: string) => certSet.has(`${userId}_${courseId}`);
  const canManageCertificate = (enrollment: any) => getCompletionStatus(enrollment);

  const buildCertData = (enrollment: any, certNumber: string) => {
    const course = courses.find((c: any) => c.id === enrollment.course_id);
    const template = templateMap.get(enrollment.course_id) as any;
    const profile = profileFullMap.get(enrollment.user_id) as any;
    const branch = profile?.department_id ? (deptMap.get(profile.department_id) as any) : null;
    return {
      studentName: profileMap.get(enrollment.user_id) || "-",
      studentEmail: emailMap.get(enrollment.user_id) || "-",
      courseName: course?.title || "-",
      issuedDate: new Date().toLocaleDateString("ko-KR"),
      certificateNumber: certNumber,
      titleText: template?.title_text || "수료증",
      descText: template?.description_text || "위 사람은 본 교육과정을 성실히 이수하였기에 이 증서를 수여합니다.",
      issuerName: template?.issuer_name || "클래시스 글로벌교육센터장",
      backgroundImageUrl: template?.background_image_url || null,
      branchName: branch?.name || "-",
      teamName: profile?.team_name || "-",
    };
  };

  const handlePreview = async (enrollment: any) => {
    if (!canManageCertificate(enrollment)) {
      toast.error("수료한 학습자만 이수증을 미리보기할 수 있습니다");
      return;
    }

    const course = courses.find((c: any) => c.id === enrollment.course_id);
    setPreviewState({
      open: true,
      loading: true,
      imageUrl: null,
      studentName: profileMap.get(enrollment.user_id) || "-",
      courseName: course?.title || "-",
      enrollment,
    });
    try {
      const sampleNumber = `PREVIEW-${Date.now().toString().slice(-8)}`;
      const blob = await generateCertificateImage(buildCertData(enrollment, sampleNumber));
      const url = URL.createObjectURL(blob);
      setPreviewState((prev) => ({ ...prev, loading: false, imageUrl: url }));
    } catch (err) {
      console.error(err);
      toast.error(t("common.error"));
      setPreviewState((prev) => ({ ...prev, open: false, loading: false }));
    }
  };

  const closePreview = () => {
    if (previewState.imageUrl) URL.revokeObjectURL(previewState.imageUrl);
    setPreviewState({ open: false, loading: false, imageUrl: null, studentName: "", courseName: "", enrollment: null });
  };

  const handleIssueFromPreview = async () => {
    if (!previewState.enrollment) return;
    if (!canManageCertificate(previewState.enrollment)) {
      closePreview();
      toast.error("수료한 학습자만 이수증을 발급할 수 있습니다");
      return;
    }

    const enrollment = previewState.enrollment;
    closePreview();
    await handleIssueCert(enrollment);
  };

  const handleIssueCert = async (enrollment: any) => {
    if (!canManageCertificate(enrollment)) {
      toast.error("수료한 학습자만 이수증을 발급할 수 있습니다");
      return;
    }

    const key = `${enrollment.user_id}_${enrollment.course_id}`;
    setIssuingCert(key);
    try {
      const certNumber = `CERT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const blob = await generateCertificateImage(buildCertData(enrollment, certNumber));
      const { error } = await supabase.from("certificates").insert({
        user_id: enrollment.user_id,
        course_id: enrollment.course_id,
        certificate_number: certNumber,
      });
      if (error) throw error;
      downloadBlob(blob, `certificate_${certNumber}.png`);
      queryClient.invalidateQueries({ queryKey: ["admin-comp-certificates"] });
      toast.success(t("admin.certIssued", "이수증이 발급되었습니다"));
    } catch (err) {
      console.error(err);
      toast.error(t("common.error"));
    }
    setIssuingCert(null);
  };

  const exportCSV = () => {
    const header = [t("admin.courseLabel"), t("admin.nameColumn"), t("admin.attendanceRate"), t("admin.avgScore"), t("admin.completionReq"), t("admin.completionStatus")];
    const rows = enrollments.map((e: any) => {
      const attKey = `${e.user_id}_${e.course_id}`;
      const att = attendanceByUserCourse.get(attKey);
      const attRate = att ? Math.round((att.present / att.total) * 100) : 0;
      const sc = scoreByStudent.get(e.user_id);
      const avgScore = sc ? Math.round(sc.total / sc.count) : 0;
      const isComplete = getCompletionStatus(e);
      const course = courses.find((c: any) => c.id === e.course_id);
      return [course?.title || "-", profileMap.get(e.user_id) || "-", `${attRate}%`, `${avgScore}`, getReqText(e.course_id), isComplete ? t("admin.completedLabel") : t("admin.incompletedLabel")];
    });
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "completion_report.csv";
    a.click();
  };

  const getCourseStats = (courseId: string) => {
    const courseEnrollments = enrollmentsByCourse.get(courseId) || [];
    const total = courseEnrollments.length;
    const completed = courseEnrollments.filter((e: any) => getCompletionStatus(e)).length;
    const certCount = courseEnrollments.filter((e: any) => hasCert(e.user_id, e.course_id)).length;
    return { total, completed, certCount };
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 sm:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2">
              <Trophy className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
              {t("admin.completionManagement")}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t("admin.completionManagementDesc")}</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button onClick={() => setBulkDialog(true)} variant="default" className="rounded-xl gap-2 text-sm flex-1 sm:flex-initial justify-center">
              <Layers className="h-4 w-4" aria-hidden="true" /> {t("admin.bulkSettings")}
            </Button>
            <Button onClick={exportCSV} variant="outline" className="rounded-xl gap-2 text-sm flex-1 sm:flex-initial justify-center">
              <Download className="h-4 w-4" aria-hidden="true" /> {t("admin.completionDownload")}
            </Button>
          </div>
        </div>

        {/* Track filter */}
        <div className="flex items-center gap-2">
          <Select value={trackFilter} onValueChange={setTrackFilter}>
            <SelectTrigger className="w-52 rounded-xl h-10">
              <div className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                <SelectValue placeholder="트랙" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 (단과 + 트랙)</SelectItem>
              <SelectItem value="standalone">단과 강의만</SelectItem>
              {tracks.filter((tr) => tr.is_active).map((tr) => (
                <SelectItem key={tr.id} value={tr.id}>{tr.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Course list with inline settings */}
        <div className="space-y-3">
          {courses.length === 0 ? (
            <div className="stat-card !p-8 text-center text-sm text-muted-foreground">
              {t("admin.noCourses", "등록된 강좌가 없습니다")}
            </div>
          ) : (
            courses
              .filter((course: any) => {
                if (trackFilter === "all") return true;
                const ti = courseTrackInfo.get(course.id);
                if (trackFilter === "standalone") return !ti;
                // 강의가 속한 모든 트랙 중 선택된 트랙이 포함되는지 확인
                return courseTrackIds.get(course.id)?.has(trackFilter) ?? false;
              })
              .map((course: any) => {
              const stats = getCourseStats(course.id);
              const criteria = criteriaMap.get(course.id);
              const isExpanded = expandedCourse === course.id;
              const trackInfo = courseTrackInfo.get(course.id);

              return (
                <div key={course.id} className="stat-card !p-0 overflow-hidden">
                  {/* Course header row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 sm:p-4">
                    <button
                      className="flex items-center gap-2 text-left min-w-0 flex-1"
                      onClick={() => setExpandedCourse(isExpanded ? null : course.id)}
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-sm font-semibold text-foreground truncate">{course.title}</h3>
                          {trackInfo ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] h-5 gap-1 border-primary/30 bg-primary/5 text-primary font-normal whitespace-nowrap"
                              title={`${trackInfo.trackName} · ${trackInfo.stepName}`}
                            >
                              <Layers className="h-2.5 w-2.5" />
                              {trackInfo.trackName} · {trackInfo.stepName}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] h-5 font-normal text-muted-foreground whitespace-nowrap">
                              단과
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span>{t("admin.enrolledCount", { count: stats.total })}</span>
                          <span>{t("admin.completedCount", { count: stats.completed })}</span>
                          <span>{t("admin.issuedCount", { count: stats.certCount })}</span>
                          <span className="hidden sm:inline">{t("admin.reqLabel")} {getReqText(course.id)}</span>
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-2 shrink-0 pl-6 sm:pl-0">
                      <Badge variant={criteria ? "default" : "secondary"} className="text-[10px]">
                        {criteria ? t("admin.configured") : t("admin.notConfigured")}
                      </Badge>
                      {criteria && (
                        <div className="hidden md:flex items-center gap-1 flex-wrap">
                          <Badge variant="outline" className="text-[10px] font-normal gap-1">
                            진도율 ≥ {criteria.min_progress_pct}%
                          </Badge>
                          {criteria.min_assessment_score != null && (
                            <Badge variant="outline" className="text-[10px] font-normal">
                              평가 ≥ {criteria.min_assessment_score}점
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-normal ${criteria.certificate_enabled ? "text-green-600 border-green-300 bg-green-50" : "text-muted-foreground"}`}
                          >
                            자동발급 {criteria.certificate_enabled ? "ON" : "OFF"}
                          </Badge>
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCriteriaDialog({ open: true, courseId: course.id, courseName: course.title });
                        }}
                      >
                        <Settings className="h-3 w-3" /> {t("admin.completionReq")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTemplateDialog({ open: true, courseId: course.id, courseName: course.title });
                        }}
                      >
                        <FileImage className="h-3 w-3" /> {t("admin.certTemplateTitle")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          const list = (enrollmentsByCourse.get(course.id) || [])
                            .filter((en: any) => getCompletionStatus(en))
                            .map((en: any): RosterRow => {
                              const p: any = profileFullMap.get(en.user_id) || {};
                              const dept: any = p.department_id ? deptMap.get(p.department_id) : null;
                              const affiliation = (dept?.name || p.department || p.team_name || "").toString();
                              return {
                                affiliation,
                                employeeId: p.employee_id || "",
                                name: p.full_name || "",
                              };
                            });
                          setRosterDialog({ open: true, courseTitle: course.title, rows: list });
                        }}
                      >
                        <Printer className="h-3 w-3" /> 명단 인쇄
                      </Button>
                    </div>
                  </div>

                  {/* Expanded student list */}
                  {isExpanded && (
                    <div className="border-t border-border">
                      {/* Mobile cards */}
                      <div className="sm:hidden p-3 space-y-2">
                        {(enrollmentsByCourse.get(course.id) || []).length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">{t("admin.noStudentData")}</p>
                        ) : (
                          (enrollmentsByCourse.get(course.id) || []).map((e: any) => {
                            const attKey = `${e.user_id}_${e.course_id}`;
                            const att = attendanceByUserCourse.get(attKey);
                            const attRate = att ? Math.round((att.present / att.total) * 100) : 0;
                            const sc = scoreByStudent.get(e.user_id);
                            const avgScore = sc ? Math.round(sc.total / sc.count) : 0;
                            const isComplete = getCompletionStatus(e);
                            const certKey = `${e.user_id}_${e.course_id}`;
                            const issued = hasCert(e.user_id, e.course_id);

                            return (
                              <div key={e.id} className="rounded-lg border border-border bg-background p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-medium text-foreground">{profileMap.get(e.user_id) || "-"}</span>
                                  <div className="flex items-center gap-1.5">
                                    <Badge variant={isComplete ? "default" : "destructive"} className="text-[10px]">
                                      {isComplete ? t("admin.completedLabel") : t("admin.incompletedLabel")}
                                    </Badge>
                                    {issued && <Badge variant="secondary" className="text-[10px]">{t("admin.certIssuedLabel")}</Badge>}
                                    {!issued && isComplete && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 px-2 text-[10px] gap-1"
                                          onClick={() => handlePreview(e)}
                                        >
                                          <Eye className="h-3 w-3" /> 미리보기
                                        </Button>
                                      <Button
                                        size="sm"
                                        variant={isComplete ? "default" : "outline"}
                                        className="h-6 px-2 text-[10px] gap-1"
                                        onClick={() => handleIssueCert(e)}
                                        disabled={issuingCert === certKey}
                                        title={!isComplete ? "수료 기준 미충족 - 관리자 직접 발급" : undefined}
                                      >
                                        <Award className="h-3 w-3" /> {t("admin.issueCert")}
                                      </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                                   <span>{t("admin.attendanceLabel")} {attRate}%</span>
                                   <span>{t("admin.scoreLabel")} {avgScore}</span>
                                   <span>{t("admin.progressColumn")} {Math.round(Number(e.progress) || 0)}%</span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Desktop table */}
                      <div className="hidden sm:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t("admin.nameColumn")}</TableHead>
                              <TableHead>{t("admin.progressColumn")}</TableHead>
                              <TableHead>{t("admin.attendanceRate")}</TableHead>
                              <TableHead>{t("admin.avgScore")}</TableHead>
                              <TableHead>{t("admin.completionStatus")}</TableHead>
                              <TableHead>{t("admin.certColumn")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(enrollmentsByCourse.get(course.id) || []).length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-sm">{t("admin.noStudentData")}</TableCell>
                              </TableRow>
                            ) : (
                              (enrollmentsByCourse.get(course.id) || []).map((e: any) => {
                                const attKey = `${e.user_id}_${e.course_id}`;
                                const att = attendanceByUserCourse.get(attKey);
                                const attRate = att ? Math.round((att.present / att.total) * 100) : 0;
                                const sc = scoreByStudent.get(e.user_id);
                                const avgScore = sc ? Math.round(sc.total / sc.count) : 0;
                                const isComplete = getCompletionStatus(e);
                                const certKey = `${e.user_id}_${e.course_id}`;
                                const issued = hasCert(e.user_id, e.course_id);

                                return (
                                  <TableRow key={e.id}>
                                    <TableCell className="font-medium text-sm">{profileMap.get(e.user_id) || "-"}</TableCell>
                                    <TableCell className="text-sm">{Math.round(Number(e.progress) || 0)}%</TableCell>
                                    <TableCell className="text-sm">{attRate}%</TableCell>
                                    <TableCell className="text-sm">{avgScore}</TableCell>
                                    <TableCell>
                                      <Badge variant={isComplete ? "default" : "destructive"} className="text-[10px]">
                                        {isComplete ? t("admin.completedLabel") : t("admin.incompletedLabel")}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      {issued ? (
                                        <Badge variant="secondary" className="text-[10px]">{t("admin.certIssuedLabel")}</Badge>
                                      ) : isComplete ? (
                                        <div className="flex items-center gap-1.5">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 px-2 text-xs gap-1"
                                            onClick={() => handlePreview(e)}
                                          >
                                            <Eye className="h-3.5 w-3.5" /> 미리보기
                                          </Button>
                                        <Button
                                          size="sm"
                                          variant={isComplete ? "default" : "outline"}
                                          className="h-7 px-2 text-xs gap-1"
                                          onClick={() => handleIssueCert(e)}
                                          disabled={issuingCert === certKey}
                                          title={!isComplete ? "수료 기준 미충족 - 관리자 직접 발급" : undefined}
                                        >
                                          <Award className="h-3.5 w-3.5" /> {t("admin.issueCert")}
                                        </Button>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">-</span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <CompletionCriteriaDialog
        courseId={criteriaDialog.courseId}
        courseName={criteriaDialog.courseName}
        open={criteriaDialog.open}
        onOpenChange={(open) => setCriteriaDialog((prev) => ({ ...prev, open }))}
      />
      <CertificateTemplateDialog
        courseId={templateDialog.courseId}
        courseName={templateDialog.courseName}
        open={templateDialog.open}
        onOpenChange={(open) => setTemplateDialog((prev) => ({ ...prev, open }))}
      />
      <BulkCompletionSettingsDialog
        open={bulkDialog}
        onOpenChange={setBulkDialog}
        courseIds={courses.map((c: any) => c.id)}
      />

      <CompletionRosterPrint
        open={rosterDialog.open}
        onOpenChange={(open) => setRosterDialog((prev) => ({ ...prev, open }))}
        courseTitle={rosterDialog.courseTitle}
        rows={rosterDialog.rows}
      />

      <Dialog open={previewState.open} onOpenChange={(open) => { if (!open) closePreview(); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              이수증 미리보기
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {previewState.studentName} · {previewState.courseName}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="bg-muted/30 rounded-lg p-4 min-h-[400px] flex items-center justify-center">
            {previewState.loading || !previewState.imageUrl ? (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <div className="h-10 w-10 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
                <p className="text-sm">이수증 생성 중...</p>
              </div>
            ) : (
              <img
                src={previewState.imageUrl}
                alt="이수증 미리보기"
                className="w-full h-auto rounded shadow-lg"
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            ※ 발급번호는 임시값(PREVIEW)이며, 실제 발급 시 정식 발급번호가 부여됩니다.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closePreview}>닫기</Button>
            <Button
              onClick={handleIssueFromPreview}
              disabled={previewState.loading || !previewState.enrollment || hasCert(previewState.enrollment?.user_id, previewState.enrollment?.course_id)}
              className="gap-1"
            >
              <Award className="h-4 w-4" /> 이대로 발급하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminCompletion;
