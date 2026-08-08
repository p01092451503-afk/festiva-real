import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, User, Mail, Building2, BookOpen, GraduationCap, Award,
  ClipboardCheck, Layers, Activity, CheckCircle2, XCircle, Clock,
  Pencil, Phone, Cake, Star, ShoppingBag, MousePointerClick,
} from "lucide-react";
import { formatDistanceToNow, format as fmtDate } from "date-fns";
import { ko, enUS } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { MEMBER_STATUS_ORDER, memberStatusClass, memberStatusLabel, GENDER_LABEL } from "@/lib/statusMeta";

const AdminUserDetail = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const locale = isEn ? enUS : ko;

  const { data: profile } = useQuery({
    queryKey: ["admin-user-detail-profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, employee_id, position, department_id, created_at, avatar_url, phone_number, birth_date, gender, member_status, admin_memo, last_login_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // ---- Inline edit of member info ----
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: "", phone_number: "", birth_date: "", gender: "unknown",
    position: "", member_status: "active", admin_memo: "",
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name || "",
      phone_number: (profile as any).phone_number || "",
      birth_date: (profile as any).birth_date || "",
      gender: (profile as any).gender || "unknown",
      position: profile.position || "",
      member_status: (profile as any).member_status || "active",
      admin_memo: (profile as any).admin_memo || "",
    });
  }, [profile]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name || null,
          phone_number: form.phone_number || null,
          birth_date: form.birth_date || null,
          gender: form.gender,
          position: form.position || null,
          member_status: form.member_status,
          admin_memo: form.admin_memo || null,
        } as any)
        .eq("user_id", userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isEn ? "Saved" : "저장되었습니다");
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail-profile", userId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ---- Unified activity data ----
  const { data: accessLogs = [] } = useQuery({
    queryKey: ["admin-user-detail-access", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("traffic_logs")
        .select("id, path, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: userReviews = [] } = useQuery({
    queryKey: ["admin-user-detail-reviews", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("reviews")
        .select("id, course_id, rating, comment, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: userOrders = [] } = useQuery({
    queryKey: ["admin-user-detail-orders", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, total_amount, coupon_code, discount_amount, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });


  const { data: roles = [] } = useQuery({
    queryKey: ["admin-user-detail-roles", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: department } = useQuery({
    queryKey: ["admin-user-detail-dept", profile?.department_id],
    queryFn: async () => {
      if (!profile?.department_id) return null;
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, name_en, country_code, entity_type")
        .eq("id", profile.department_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.department_id,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["admin-user-detail-enrollments", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("enrollments")
        .select("id, course_id, status, progress, enrolled_at, completed_at")
        .eq("user_id", userId);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const courseIds = useMemo(() => enrollments.map((e: any) => e.course_id), [enrollments]);

  const { data: courses = [] } = useQuery({
    queryKey: ["admin-user-detail-courses", courseIds],
    queryFn: async () => {
      if (courseIds.length === 0) return [];
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, thumbnail_url, status, is_mandatory")
        .in("id", courseIds);
      if (error) throw error;
      return data;
    },
    enabled: courseIds.length > 0,
  });

  const { data: assessmentAttempts = [] } = useQuery({
    queryKey: ["admin-user-detail-attempts", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("assessment_attempts")
        .select("id, assessment_id, score, passed, completed_at, started_at")
        .eq("user_id", userId)
        .order("completed_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const assessmentIds = useMemo(
    () => Array.from(new Set(assessmentAttempts.map((a: any) => a.assessment_id))),
    [assessmentAttempts],
  );

  const { data: assessments = [] } = useQuery({
    queryKey: ["admin-user-detail-assessments", assessmentIds],
    queryFn: async () => {
      if (assessmentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("assessments")
        .select("id, title, course_id, passing_score")
        .in("id", assessmentIds);
      if (error) throw error;
      return data;
    },
    enabled: assessmentIds.length > 0,
  });

  const { data: certificates = [] } = useQuery({
    queryKey: ["admin-user-detail-certs", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("certificates")
        .select("id, course_id, certificate_number, issued_at")
        .eq("user_id", userId)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: trackData } = useQuery({
    queryKey: ["admin-user-detail-tracks", userId],
    queryFn: async () => {
      if (!userId) return { tracks: [], steps: [], stepCourses: [] };
      const [tracksRes, stepsRes, stepCoursesRes] = await Promise.all([
        supabase.from("learning_tracks").select("id, name, name_en, is_active, target_user_ids, target_branch_ids, target_country_codes, target_scope, sort_order").eq("is_active", true),
        supabase.from("track_steps").select("id, track_id, name, name_en, level_order"),
        supabase.from("track_step_courses").select("step_id, course_id, sort_order, is_required"),
      ]);
      return {
        tracks: tracksRes.data || [],
        steps: stepsRes.data || [],
        stepCourses: stepCoursesRes.data || [],
      };
    },
    enabled: !!userId,
  });

  const courseMap = useMemo(() => new Map(courses.map((c: any) => [c.id, c])), [courses]);
  const assessmentMap = useMemo(() => new Map(assessments.map((a: any) => [a.id, a])), [assessments]);
  const certByCourse = useMemo(() => new Map(certificates.map((c: any) => [c.course_id, c])), [certificates]);

  // Best score per course (across all attempts of all assessments in that course)
  const bestScoreByCourse = useMemo(() => {
    const map = new Map<string, { score: number; passed: boolean }>();
    assessmentAttempts.forEach((a: any) => {
      const asmt = assessmentMap.get(a.assessment_id) as any;
      if (!asmt || a.score == null) return;
      const cur = map.get(asmt.course_id);
      const score = Number(a.score) || 0;
      if (!cur || score > cur.score) map.set(asmt.course_id, { score, passed: !!a.passed });
    });
    return map;
  }, [assessmentAttempts, assessmentMap]);

  // Filter tracks the user belongs to (user_ids match or all-scope, or branch match)
  const userTracks = useMemo(() => {
    if (!trackData) return [];
    const branchId = profile?.department_id;
    return trackData.tracks.filter((t: any) => {
      if (t.target_scope === "all") return true;
      if (t.target_user_ids?.includes(userId)) return true;
      if (branchId && t.target_branch_ids?.includes(branchId)) return true;
      return false;
    }).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [trackData, userId, profile]);

  // Build track progress
  const trackProgress = useMemo(() => {
    if (!trackData) return [];
    return userTracks.map((track: any) => {
      const trackSteps = trackData.steps
        .filter((s: any) => s.track_id === track.id)
        .sort((a: any, b: any) => (a.level_order ?? 0) - (b.level_order ?? 0));
      const stepInfo = trackSteps.map((step: any) => {
        const stepCourseIds = trackData.stepCourses
          .filter((sc: any) => sc.step_id === step.id)
          .map((sc: any) => sc.course_id);
        const total = stepCourseIds.length;
        const completed = stepCourseIds.filter((cid: string) => {
          const e = enrollments.find((e: any) => e.course_id === cid);
          return e && e.completed_at;
        }).length;
        return { step, total, completed, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
      });
      const totalCourses = stepInfo.reduce((s, x) => s + x.total, 0);
      const completedCourses = stepInfo.reduce((s, x) => s + x.completed, 0);
      const overallPct = totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0;
      return { track, steps: stepInfo, totalCourses, completedCourses, overallPct };
    });
  }, [trackData, userTracks, enrollments]);

  // Build activity timeline (combine logins, completions, attempts)
  const timeline = useMemo(() => {
    const events: Array<{ type: string; time: string; label: string; detail?: string }> = [];
    enrollments.forEach((e: any) => {
      const c = courseMap.get(e.course_id) as any;
      if (e.enrolled_at) {
        events.push({
          type: "enroll",
          time: e.enrolled_at,
          label: isEn ? "Enrolled" : "수강 시작",
          detail: c?.title,
        });
      }
      if (e.completed_at) {
        events.push({
          type: "complete",
          time: e.completed_at,
          label: isEn ? "Completed" : "수강 완료",
          detail: c?.title,
        });
      }
    });
    assessmentAttempts.forEach((a: any) => {
      if (!a.completed_at) return;
      const asmt = assessmentMap.get(a.assessment_id) as any;
      events.push({
        type: a.passed ? "assess_pass" : "assess_fail",
        time: a.completed_at,
        label: a.passed
          ? (isEn ? `Passed assessment (${a.score}점)` : `평가 합격 (${a.score}점)`)
          : (isEn ? `Took assessment (${a.score}점)` : `평가 응시 (${a.score}점)`),
        detail: asmt?.title,
      });
    });
    certificates.forEach((c: any) => {
      const course = courseMap.get(c.course_id) as any;
      events.push({
        type: "cert",
        time: c.issued_at,
        label: isEn ? "Certificate issued" : "이수증 발급",
        detail: course?.title,
      });
    });
    return events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 30);
  }, [enrollments, assessmentAttempts, certificates, courseMap, assessmentMap, isEn]);

  // Summary metrics
  const totalEnrollments = enrollments.length;
  const completedEnrollments = enrollments.filter((e: any) => e.completed_at).length;
  const inProgress = enrollments.filter((e: any) => !e.completed_at && (Number(e.progress) || 0) > 0).length;
  const avgProgress = totalEnrollments > 0
    ? Math.round(enrollments.reduce((s: number, e: any) => s + (Number(e.progress) || 0), 0) / totalEnrollments)
    : 0;
  const avgScore = (() => {
    const scores = Array.from(bestScoreByCourse.values()).map((x) => x.score);
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  })();
  const totalCertificates = certificates.length;

  const primaryRole = roles[0]?.role || "student";
  const roleLabel: Record<string, string> = {
    super_admin: isEn ? "Super Admin" : "슈퍼관리자",
    admin: isEn ? "Admin" : "관리자",
    teacher: isEn ? "Teacher" : "강사",
    student: isEn ? "Student" : "학습자",
  };

  const deptLabel = department ? (isEn && department.name_en ? department.name_en : department.name) : "-";

  if (!profile) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-muted-foreground">
          {isEn ? "Loading..." : "불러오는 중..."}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-3 sm:p-5 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-9 rounded-xl gap-1.5" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
            {isEn ? "Back" : "뒤로"}
          </Button>
        </div>

        {/* Profile Summary */}
        <div className="stat-card !p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="h-20 w-20 rounded-full bg-accent flex items-center justify-center text-2xl font-semibold text-accent-foreground shrink-0 overflow-hidden">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                (profile.full_name || "?").slice(0, 1)
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-semibold text-foreground">{profile.full_name || "-"}</h1>
                <Badge variant="outline" className="text-[10px]">{roleLabel[primaryRole]}</Badge>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${memberStatusClass((profile as any).member_status)}`}>
                  {memberStatusLabel((profile as any).member_status)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{profile.email || "-"}</span>
                <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{(profile as any).phone_number || "-"}</span>
                <span className="flex items-center gap-1.5"><Cake className="h-3.5 w-3.5" />{(profile as any).birth_date || "-"}</span>
                <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{GENDER_LABEL[(profile as any).gender || "unknown"]}</span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {profile.created_at ? new Date(profile.created_at).toLocaleDateString("ko-KR") : "-"} 가입
                </span>
              </div>
              {(profile as any).admin_memo && (
                <p className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">{(profile as any).admin_memo}</p>
              )}
            </div>
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5 shrink-0" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" />{isEn ? "Edit info" : "회원정보 수정"}
            </Button>
          </div>


          {/* KPI grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5">
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><BookOpen className="h-3 w-3" />{isEn ? "Enrolled" : "수강"}</p>
              <p className="text-xl font-bold text-foreground mt-1">{totalEnrollments}</p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><GraduationCap className="h-3 w-3" />{isEn ? "Completed" : "수료"}</p>
              <p className="text-xl font-bold text-foreground mt-1">{completedEnrollments}</p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Activity className="h-3 w-3" />{isEn ? "Avg Progress" : "평균 진도"}</p>
              <p className="text-xl font-bold text-foreground mt-1">{avgProgress}%</p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><ClipboardCheck className="h-3 w-3" />{isEn ? "Avg Score" : "평균 점수"}</p>
              <p className="text-xl font-bold text-foreground mt-1">{avgScore != null ? `${avgScore}점` : "-"}</p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Award className="h-3 w-3" />{isEn ? "Certificates" : "이수증"}</p>
              <p className="text-xl font-bold text-foreground mt-1">{totalCertificates}</p>
            </div>
          </div>
        </div>

        {/* Course Enrollments */}
        <div className="stat-card !p-5">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            {isEn ? "Courses" : "수강 강의"} ({totalEnrollments})
          </h2>
          {totalEnrollments === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{isEn ? "No enrollments." : "수강 내역이 없습니다."}</p>
          ) : (
            <>
            {/* Desktop Table */}
            <div className="overflow-x-auto hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isEn ? "Course" : "강의"}</TableHead>
                    <TableHead className="w-[160px]">{isEn ? "Progress" : "진도"}</TableHead>
                    <TableHead className="w-[100px]">{isEn ? "Best Score" : "최고 점수"}</TableHead>
                    <TableHead className="w-[100px]">{isEn ? "Status" : "상태"}</TableHead>
                    <TableHead className="w-[120px]">{isEn ? "Certificate" : "이수증"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrollments.map((e: any) => {
                    const c = courseMap.get(e.course_id) as any;
                    const pct = Math.round(Number(e.progress) || 0);
                    const best = bestScoreByCourse.get(e.course_id);
                    const cert = certByCourse.get(e.course_id);
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="text-sm">
                          <Link to={`/admin/courses/${e.course_id}`} className="text-foreground hover:text-primary hover:underline">
                            {c?.title || "-"}
                          </Link>
                          {c?.is_mandatory && (
                            <Badge variant="outline" className="ml-2 text-[10px] h-4">{isEn ? "Required" : "필수"}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={pct} className="w-20 h-1.5" />
                            <span className="text-xs">{pct}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {best ? (
                            <span className={`text-xs font-medium ${best.passed ? "text-primary" : "text-muted-foreground"}`}>
                              {best.score}점
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {e.completed_at ? (
                            <Badge className="text-[10px]"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />{isEn ? "Done" : "완료"}</Badge>
                          ) : pct > 0 ? (
                            <Badge variant="secondary" className="text-[10px]">{isEn ? "In progress" : "진행중"}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">{isEn ? "Not started" : "미시작"}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {cert ? (
                            <span className="text-xs text-primary flex items-center gap-1">
                              <Award className="h-3 w-3" />{cert.certificate_number?.split("-").pop()}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-2">
              {enrollments.map((e: any) => {
                const c = courseMap.get(e.course_id) as any;
                const pct = Math.round(Number(e.progress) || 0);
                const best = bestScoreByCourse.get(e.course_id);
                const cert = certByCourse.get(e.course_id);
                return (
                  <div key={e.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link to={`/admin/courses/${e.course_id}`} className="text-sm font-medium text-foreground hover:text-primary hover:underline truncate flex-1 min-w-0">
                        {c?.title || "-"}
                      </Link>
                      {e.completed_at ? (
                        <Badge className="text-[10px] shrink-0"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />{isEn ? "Done" : "완료"}</Badge>
                      ) : pct > 0 ? (
                        <Badge variant="secondary" className="text-[10px] shrink-0">{isEn ? "In progress" : "진행중"}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] shrink-0">{isEn ? "Not started" : "미시작"}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Progress value={pct} className="flex-1 h-1.5" />
                      <span className="text-xs text-muted-foreground shrink-0">{pct}%</span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                      <span>{isEn ? "Score" : "점수"}: {best ? <span className={best.passed ? "text-primary font-medium" : "font-medium"}>{best.score}점</span> : "-"}</span>
                      {cert && (
                        <span className="flex items-center gap-1 text-primary">
                          <Award className="h-3 w-3" />{cert.certificate_number?.split("-").pop()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            </>
          )}
        </div>

        {/* Assessment History */}
        <div className="stat-card !p-5">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            {isEn ? "Assessment History" : "평가 응시 이력"} ({assessmentAttempts.filter((a: any) => a.completed_at).length})
          </h2>
          {assessmentAttempts.filter((a: any) => a.completed_at).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{isEn ? "No attempts yet." : "응시 이력이 없습니다."}</p>
          ) : (
            <>
            {/* Desktop Table */}
            <div className="overflow-x-auto hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isEn ? "Assessment" : "평가"}</TableHead>
                    <TableHead className="w-[200px]">{isEn ? "Course" : "강의"}</TableHead>
                    <TableHead className="w-[80px]">{isEn ? "Score" : "점수"}</TableHead>
                    <TableHead className="w-[100px]">{isEn ? "Result" : "결과"}</TableHead>
                    <TableHead className="w-[160px]">{isEn ? "Submitted" : "응시일"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assessmentAttempts.filter((a: any) => a.completed_at).map((a: any) => {
                    const asmt = assessmentMap.get(a.assessment_id) as any;
                    const c = courseMap.get(asmt?.course_id) as any;
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="text-sm">{asmt?.title || "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c?.title || "-"}</TableCell>
                        <TableCell className="text-sm font-medium">{a.score}점</TableCell>
                        <TableCell>
                          {a.passed ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground whitespace-nowrap">
                              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                              {isEn ? "Pass" : "합격"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive whitespace-nowrap border border-destructive/20">
                              <XCircle className="h-3 w-3" aria-hidden="true" />
                              {isEn ? "Fail" : "불합격"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {fmtDate(new Date(a.completed_at), "yyyy.MM.dd HH:mm")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-2">
              {assessmentAttempts.filter((a: any) => a.completed_at).map((a: any) => {
                const asmt = assessmentMap.get(a.assessment_id) as any;
                const c = courseMap.get(asmt?.course_id) as any;
                return (
                  <div key={a.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{asmt?.title || "-"}</p>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{c?.title || "-"}</p>
                      </div>
                      {a.passed ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground whitespace-nowrap shrink-0">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          {isEn ? "Pass" : "합격"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive whitespace-nowrap shrink-0 border border-destructive/20">
                          <XCircle className="h-3 w-3" aria-hidden="true" />
                          {isEn ? "Fail" : "불합격"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">{a.score}점</span>
                      <span>{fmtDate(new Date(a.completed_at), "yyyy.MM.dd HH:mm")}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            </>
          )}
        </div>

        {/* Tracks */}
        {trackProgress.length > 0 && (
          <div className="stat-card !p-5">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
              <Layers className="h-4 w-4 text-muted-foreground" />
              {isEn ? "Track Progress" : "트랙 진행 현황"} ({trackProgress.length})
            </h2>
            <div className="space-y-4">
              {trackProgress.map(({ track, steps, totalCourses, completedCourses, overallPct }) => (
                <div key={track.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{isEn && track.name_en ? track.name_en : track.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {completedCourses} / {totalCourses} {isEn ? "courses completed" : "강의 완료"}
                      </p>
                    </div>
                    <span className="text-lg font-bold text-foreground">{overallPct}%</span>
                  </div>
                  <Progress value={overallPct} className="h-2 mb-3" />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {steps.map(({ step, total, completed, pct }) => (
                      <div key={step.id} className="rounded-lg bg-secondary/30 p-2">
                        <p className="text-xs text-foreground font-medium truncate">
                          {isEn && step.name_en ? step.name_en : step.name}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-muted-foreground">{completed}/{total}</span>
                          <span className="text-xs font-semibold text-foreground">{pct}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity Timeline */}
        <div className="stat-card !p-5">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-muted-foreground" />
            {isEn ? "Recent Activity" : "최근 활동"}
          </h2>
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{isEn ? "No activity yet." : "활동 내역이 없습니다."}</p>
          ) : (
            <ol className="space-y-3 relative border-l border-border ml-2">
              {timeline.map((ev, idx) => {
                const Icon = ev.type === "complete" || ev.type === "cert" ? CheckCircle2
                  : ev.type === "assess_pass" ? Award
                  : ev.type === "assess_fail" ? XCircle
                  : ev.type === "enroll" ? BookOpen
                  : Activity;
                const iconColor = ev.type === "assess_fail" ? "text-destructive" : "text-primary";
                return (
                  <li key={idx} className="ml-4">
                    <div className={`absolute -left-[7px] mt-1 h-3 w-3 rounded-full bg-background border-2 ${ev.type === "assess_fail" ? "border-destructive" : "border-primary"}`} />
                    <div className="flex items-start gap-2">
                      <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${iconColor}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          <span className="font-medium">{ev.label}</span>
                          {ev.detail && <span className="text-muted-foreground"> · {ev.detail}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(ev.time), { addSuffix: true, locale })}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Unified activity: access / reviews / orders & coupons */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="stat-card !p-5">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-3">
              <MousePointerClick className="h-4 w-4 text-muted-foreground" />
              {isEn ? "Recent access" : "최근 접속"}
            </h2>
            {accessLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">{isEn ? "No records." : "기록이 없습니다."}</p>
            ) : (
              <ul className="space-y-2">
                {accessLogs.map((l: any) => (
                  <li key={l.id} className="flex items-center justify-between gap-2 border-b-2 border-border/80 pb-2 last:border-0">
                    <span className="text-xs text-foreground truncate">{l.path}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {fmtDate(new Date(l.created_at), "MM.dd HH:mm")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="stat-card !p-5">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-3">
              <Star className="h-4 w-4 text-muted-foreground" />
              {isEn ? "Reviews" : "작성 후기"} ({userReviews.length})
            </h2>
            {userReviews.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">{isEn ? "No reviews." : "작성한 후기가 없습니다."}</p>
            ) : (
              <ul className="space-y-2">
                {userReviews.map((r: any) => (
                  <li key={r.id} className="border-b-2 border-border/80 pb-2 last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-foreground truncate">
                        {(courseMap.get(r.course_id) as any)?.title || "-"}
                      </span>
                      <span className="text-[11px] text-muted-foreground shrink-0">★ {r.rating}</span>
                    </div>
                    {r.comment && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{r.comment}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="stat-card !p-5">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-3">
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              {isEn ? "Orders & coupons" : "구매 · 쿠폰"} ({userOrders.length})
            </h2>
            {userOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">{isEn ? "No orders." : "구매 내역이 없습니다."}</p>
            ) : (
              <ul className="space-y-2">
                {userOrders.map((o: any) => (
                  <li key={o.id} className="border-b-2 border-border/80 pb-2 last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-foreground truncate">{o.order_number}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{o.status}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {Number(o.total_amount || 0).toLocaleString()}원
                      {o.coupon_code ? ` · ${o.coupon_code} (-${Number(o.discount_amount || 0).toLocaleString()}원)` : ""}
                      {" · "}{fmtDate(new Date(o.created_at), "yyyy.MM.dd")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Edit member info */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEn ? "Edit member info" : "회원정보 수정"}</DialogTitle>
            <DialogDescription>{isEn ? "Update contact and status details." : "연락처와 상태 정보를 수정합니다."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{isEn ? "Name" : "이름"}</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{isEn ? "Phone" : "전화번호"}</Label>
                <Input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} placeholder="010-0000-0000" />
              </div>
              <div className="space-y-1.5">
                <Label>{isEn ? "Birth date" : "생년월일"}</Label>
                <Input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{isEn ? "Gender" : "성별"}</Label>
                <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(GENDER_LABEL).map(([v, label]) => (
                      <SelectItem key={v} value={v}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{isEn ? "Status" : "회원 상태"}</Label>
                <Select value={form.member_status} onValueChange={(v) => setForm({ ...form, member_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MEMBER_STATUS_ORDER.map((s) => (
                      <SelectItem key={s} value={s}>{memberStatusLabel(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{isEn ? "Position" : "직책"}</Label>
              <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{isEn ? "Admin memo" : "관리자 메모"}</Label>
              <Textarea rows={3} value={form.admin_memo} onChange={(e) => setForm({ ...form, admin_memo: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{isEn ? "Cancel" : "취소"}</Button>
            <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
              {saveProfile.isPending ? (isEn ? "Saving..." : "저장 중...") : (isEn ? "Save" : "저장")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>

  );
};

export default AdminUserDetail;