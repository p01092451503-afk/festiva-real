import { useMemo, lazy, Suspense } from "react";
import {
  Users, BookOpen, Activity, LayoutDashboard, Building2, GraduationCap,
  AlertTriangle, ClipboardCheck, Bell, Megaphone, Clock, ChevronRight,
  UserPlus, CheckCircle2, FileText, ArrowRight, ShoppingBag, CreditCard,
  Layers,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { AdminDashboardSkeleton, ChartFallback } from "@/components/PageSkeletons";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { formatDistanceToNow, subDays, format as fmtDate } from "date-fns";
import { ko, enUS } from "date-fns/locale";
import TrackStatsCard from "@/components/admin/stats/TrackStatsCard";
import BranchTopWidget from "@/components/admin/stats/BranchTopWidget";
import AssessmentOverviewWidget from "@/components/admin/stats/AssessmentOverviewWidget";

// Lazy-load the recharts-powered chart so the vendor-charts (~113KB gzip)
// chunk does not block the dashboard's first paint.
const B2cRevenueChart = lazy(() => import("@/components/charts/B2cRevenueChart"));
const DashCharts = {
  Sparkline: lazy(() => import("@/components/charts/DashboardCharts").then(m => ({ default: m.Sparkline }))),
  TrendArea: lazy(() => import("@/components/charts/DashboardCharts").then(m => ({ default: m.TrendAreaChart }))),
  Bar: lazy(() => import("@/components/charts/DashboardCharts").then(m => ({ default: m.SimpleBarChart }))),
  Donut: lazy(() => import("@/components/charts/DashboardCharts").then(m => ({ default: m.DonutChart }))),
  Buckets: lazy(() => import("@/components/charts/DashboardCharts").then(m => ({ default: m.ProgressBucketChart }))),
};

const AdminDashboard = () => {
  const { profile } = useUser();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isEn = i18n.language?.startsWith("en");
  const locale = isEn ? enUS : ko;
  const { data: siteSettings } = useSiteSettings();
  const b2cEnabled = siteSettings?.b2c_enabled !== false;

  // ── Data Queries ──
  const { data: realtimeSessions = [] } = useQuery({
    queryKey: ["dash-realtime-sessions"],
    queryFn: async () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data, error } = await supabase.from("user_sessions").select("user_id").gte("login_at", fiveMinAgo);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  const { data: todayStats } = useQuery({
    queryKey: ["dash-today-stats"],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayISO = todayStart.toISOString();

      const [signupsRes, completionsRes] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", todayISO),
        supabase.from("enrollments").select("*", { count: "exact", head: true }).gte("completed_at", todayISO),
      ]);
      return {
        todaySignups: signupsRes.count || 0,
        todayCompletions: completionsRes.count || 0,
      };
    },
    staleTime: 60000,
  });

  const { data: pendingEnrollments = 0 } = useQuery({
    queryKey: ["dash-pending-enrollments"],
    queryFn: async () => {
      const { count, error } = await supabase.from("enrollments").select("*", { count: "exact", head: true }).eq("status", "pending");
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: ungradedSubmissions = 0 } = useQuery({
    queryKey: ["dash-ungraded-submissions"],
    queryFn: async () => {
      const { count, error } = await supabase.from("assignment_submissions").select("*", { count: "exact", head: true }).eq("status", "submitted");
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: activeTracksCount = 0 } = useQuery({
    queryKey: ["dash-active-tracks"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("learning_tracks")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);
      if (error) throw error;
      return count || 0;
    },
    staleTime: 60_000,
  });

  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ["dash-courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("id, title, status, is_mandatory, deadline").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: recentAnnouncements = [] } = useQuery({
    queryKey: ["dash-recent-announcements", isEn ? "en" : "ko"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, created_at, is_published, announcement_i18n(language_code, title)")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      const lang = isEn ? "en" : "ko";
      return (data || []).map((a: any) => {
        const i18n = (a.announcement_i18n || []).find((r: any) => r.language_code === lang);
        return { ...a, title: i18n?.title || a.title };
      });
    },
  });

  // B2C Revenue Data
  const { data: b2cStats } = useQuery({
    queryKey: ["dash-b2c-stats"],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayISO = todayStart.toISOString();

      const { data: todayOrders, error } = await supabase
        .from("orders")
        .select("final_amount")
        .eq("status", "paid")
        .gte("paid_at", todayISO);
      if (error) throw error;

      const todayCount = todayOrders?.length || 0;
      const todayRevenue = todayOrders?.reduce((s: number, o: any) => s + (o.final_amount || 0), 0) || 0;

      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const { data: recentOrders } = await supabase
        .from("orders")
        .select("paid_at, final_amount")
        .eq("status", "paid")
        .gte("paid_at", thirtyDaysAgo);

      const dailyMap: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) {
        const d = fmtDate(subDays(new Date(), i), "MM/dd");
        dailyMap[d] = 0;
      }
      (recentOrders || []).forEach((o: any) => {
        if (o.paid_at) {
          const d = fmtDate(new Date(o.paid_at), "MM/dd");
          if (dailyMap[d] !== undefined) dailyMap[d] += o.final_amount || 0;
        }
      });
      const chartData = Object.entries(dailyMap).map(([date, amount]) => ({ date, amount }));

      return { todayCount, todayRevenue, chartData };
    },
    staleTime: 60000,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["dash-enrollments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollments").select("course_id, user_id, progress, completed_at, enrolled_at").order("enrolled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // 7일 추세 (가입/수료/접속)
  const { data: weeklyTrends } = useQuery({
    queryKey: ["dash-weekly-trends"],
    queryFn: async () => {
      const sevenAgo = subDays(new Date(), 6);
      sevenAgo.setHours(0, 0, 0, 0);
      const sevenISO = sevenAgo.toISOString();
      const [signupsRes, completionsRes, sessionsRes] = await Promise.all([
        supabase.from("profiles").select("created_at").gte("created_at", sevenISO),
        supabase.from("enrollments").select("completed_at").not("completed_at", "is", null).gte("completed_at", sevenISO),
        supabase.from("user_sessions").select("login_at, user_id").gte("login_at", sevenISO),
      ]);
      const signupMap: Record<string, number> = {};
      const completeMap: Record<string, number> = {};
      const sessionMap: Record<string, Set<string>> = {};
      for (let i = 6; i >= 0; i--) {
        const k = fmtDate(subDays(new Date(), i), "MM/dd");
        signupMap[k] = 0; completeMap[k] = 0; sessionMap[k] = new Set();
      }
      (signupsRes.data || []).forEach((r: any) => {
        const k = fmtDate(new Date(r.created_at), "MM/dd");
        if (signupMap[k] !== undefined) signupMap[k]++;
      });
      (completionsRes.data || []).forEach((r: any) => {
        const k = fmtDate(new Date(r.completed_at), "MM/dd");
        if (completeMap[k] !== undefined) completeMap[k]++;
      });
      (sessionsRes.data || []).forEach((r: any) => {
        const k = fmtDate(new Date(r.login_at), "MM/dd");
        if (sessionMap[k]) sessionMap[k].add(r.user_id);
      });
      const signupTrend = Object.entries(signupMap).map(([date, value]) => ({ date, value }));
      const completeTrend = Object.entries(completeMap).map(([date, value]) => ({ date, value }));
      const sessionTrend = Object.entries(sessionMap).map(([date, set]) => ({ date, value: set.size }));
      return { signupTrend, completeTrend, sessionTrend };
    },
    staleTime: 60_000,
  });

  const { data: recentActivity = [] } = useQuery({
    queryKey: ["dash-recent-activity"],
    queryFn: async () => {
      const [recentEnrollRes, recentCompleteRes, recentSignupRes] = await Promise.all([
        supabase.from("enrollments").select("user_id, course_id, enrolled_at").order("enrolled_at", { ascending: false }).limit(5),
        supabase.from("enrollments").select("user_id, course_id, completed_at").not("completed_at", "is", null).order("completed_at", { ascending: false }).limit(5),
        supabase.from("profiles").select("user_id, full_name, created_at").order("created_at", { ascending: false }).limit(5),
      ]);

      const activities: { type: string; userId: string; name?: string; courseId?: string; time: string }[] = [];

      recentSignupRes.data?.forEach((p: any) => {
        activities.push({ type: "signup", userId: p.user_id, name: p.full_name, time: p.created_at });
      });
      recentCompleteRes.data?.forEach((e: any) => {
        activities.push({ type: "complete", userId: e.user_id, courseId: e.course_id, time: e.completed_at });
      });
      recentEnrollRes.data?.forEach((e: any) => {
        activities.push({ type: "enroll", userId: e.user_id, courseId: e.course_id, time: e.enrolled_at });
      });

      return activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 10);
    },
  });

  const { data: profileMap = {} } = useQuery({
    queryKey: ["dash-profile-map"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, full_name");
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach((p: any) => { map[p.user_id] = p.full_name || ""; });
      return map;
    },
  });

  // ── Derived ──
  const onlineUsers = new Set(realtimeSessions.map((s: any) => s.user_id)).size;
  const mandatoryCourses = courses.filter((c: any) => c.is_mandatory && c.status === "published");
  const urgentMandatory = mandatoryCourses.filter((c: any) => {
    if (!c.deadline) return false;
    const daysLeft = Math.ceil((new Date(c.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysLeft <= 3;
  });

  const topCourses = useMemo(() => {
    const grouped: Record<string, { count: number; progress: number }> = {};
    enrollments.forEach((e: any) => {
      if (!grouped[e.course_id]) grouped[e.course_id] = { count: 0, progress: 0 };
      grouped[e.course_id].count++;
      grouped[e.course_id].progress += Number(e.progress) || 0;
    });
    return courses
      .filter((c: any) => c.status === "published" && grouped[c.id])
      .map((c: any) => ({
        title: c.title,
        enrolled: grouped[c.id].count,
        avgProgress: Math.round(grouped[c.id].progress / grouped[c.id].count),
      }))
      .sort((a, b) => b.enrolled - a.enrolled)
      .slice(0, 3);
  }, [courses, enrollments]);

  const courseMap = useMemo(() => {
    const m: Record<string, string> = {};
    courses.forEach((c: any) => { m[c.id] = c.title; });
    return m;
  }, [courses]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "signup": return <UserPlus className="h-4 w-4 text-chart-2" />;
      case "complete": return <CheckCircle2 className="h-4 w-4 text-chart-3" />;
      case "enroll": return <BookOpen className="h-4 w-4 text-primary" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActivityText = (item: any) => {
    const name = item.name || profileMap[item.userId] || t("common.user");
    const course = item.courseId ? courseMap[item.courseId] : "";
    switch (item.type) {
      case "signup": return isEn ? `${name} joined the platform` : `${name}님이 가입했습니다`;
      case "complete": return isEn ? `${name} completed "${course}"` : `${name}님이 "${course}" 수료`;
      case "enroll": return isEn ? `${name} enrolled in "${course}"` : `${name}님이 "${course}" 수강 신청`;
      default: return "";
    }
  };

  if (coursesLoading) {
    return (
      <DashboardLayout role="admin">
        <AdminDashboardSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 sm:h-6 sm:w-6" />
            {t("admin.adminDashboard")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("admin.platformOverview")}</p>
        </div>

        {/* ① Live Status Banner */}
        <div className="stat-card !p-0 overflow-hidden">
          <div className="grid grid-cols-3 divide-x divide-border">
            <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4 min-w-0">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-chart-3 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-chart-3" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-foreground truncate">{isEn ? "Online Now" : "현재 접속"}</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground">{onlineUsers}<span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1">{t("common.people")}</span></p>
              </div>
              <div className="w-20 shrink-0 hidden sm:block">
                <Suspense fallback={null}>
                  {weeklyTrends && <DashCharts.Sparkline data={weeklyTrends.sessionTrend.map(d => ({ v: d.value }))} color="hsl(var(--chart-3))" />}
                </Suspense>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4 min-w-0">
              <UserPlus className="h-4 w-4 sm:h-5 sm:w-5 text-chart-2 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-foreground truncate">{isEn ? "Today Signups" : "오늘 가입"}</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground">{todayStats?.todaySignups || 0}<span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1">{t("common.people")}</span></p>
              </div>
              <div className="w-20 shrink-0 hidden sm:block">
                <Suspense fallback={null}>
                  {weeklyTrends && <DashCharts.Sparkline data={weeklyTrends.signupTrend.map(d => ({ v: d.value }))} color="hsl(var(--chart-2))" />}
                </Suspense>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4 min-w-0">
              <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-chart-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-foreground truncate">{isEn ? "Today Completions" : "오늘 수료"}</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground">{todayStats?.todayCompletions || 0}<span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1">{t("common.people")}</span></p>
              </div>
              <div className="w-20 shrink-0 hidden sm:block">
                <Suspense fallback={null}>
                  {weeklyTrends && <DashCharts.Sparkline data={weeklyTrends.completeTrend.map(d => ({ v: d.value }))} color="hsl(var(--chart-4))" />}
                </Suspense>
              </div>
            </div>
          </div>
        </div>

        {/* ② Action Required Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
          {/* Pending Enrollments */}
          <button
            onClick={() => navigate("/admin/enrollments")}
            className="stat-card !p-4 text-left hover:border-primary/30 transition-colors group cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <ClipboardCheck className="h-5 w-5 text-primary" />
              </div>
              {pendingEnrollments > 0 && (
                <Badge variant="destructive" className="text-xs animate-pulse">
                  {pendingEnrollments}
                </Badge>
              )}
            </div>
            <p className="text-sm font-medium text-foreground mt-3">
              {isEn ? "Pending Enrollments" : "승인 대기 수강신청"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingEnrollments > 0
                ? (isEn ? `${pendingEnrollments} requests waiting` : `${pendingEnrollments}건 처리 필요`)
                : (isEn ? "All caught up!" : "처리할 항목 없음")
              }
            </p>
            <div className="flex items-center text-xs text-primary mt-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              {isEn ? "Go to review" : "바로가기"} <ChevronRight className="h-3 w-3 ml-0.5" />
            </div>
          </button>

          {/* Urgent Mandatory Training */}
          <button
            onClick={() => navigate("/admin/learning")}
            className="stat-card !p-4 text-left hover:border-destructive/30 transition-colors group cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className={`rounded-lg p-2.5 ${urgentMandatory.length > 0 ? "bg-destructive/10" : "bg-muted"}`}>
                <AlertTriangle className={`h-5 w-5 ${urgentMandatory.length > 0 ? "text-destructive" : "text-muted-foreground"}`} />
              </div>
              {urgentMandatory.length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {urgentMandatory.length}
                </Badge>
              )}
            </div>
            <p className="text-sm font-medium text-foreground mt-3">
              {isEn ? "Urgent Mandatory" : "긴급 필수교육"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {urgentMandatory.length > 0
                ? (isEn ? `${urgentMandatory.length} courses within D-3` : `D-3 이내 ${urgentMandatory.length}개 강의`)
                : (isEn ? "No urgent items" : "긴급 항목 없음")
              }
            </p>
            <div className="flex items-center text-xs text-primary mt-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              {isEn ? "View details" : "바로가기"} <ChevronRight className="h-3 w-3 ml-0.5" />
            </div>
          </button>

          {/* Ungraded Assignments */}
          <button
            onClick={() => navigate("/admin/courses")}
            className="stat-card !p-4 text-left hover:border-chart-2/30 transition-colors group cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className={`rounded-lg p-2.5 ${ungradedSubmissions > 0 ? "bg-chart-2/10" : "bg-muted"}`}>
                <FileText className={`h-5 w-5 ${ungradedSubmissions > 0 ? "text-chart-2" : "text-muted-foreground"}`} />
              </div>
              {ungradedSubmissions > 0 && (
                <Badge className="text-xs bg-chart-2 text-white">
                  {ungradedSubmissions}
                </Badge>
              )}
            </div>
            <p className="text-sm font-medium text-foreground mt-3">
              {isEn ? "Ungraded Submissions" : "미채점 과제"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {ungradedSubmissions > 0
                ? (isEn ? `${ungradedSubmissions} submissions pending` : `${ungradedSubmissions}건 채점 대기`)
                : (isEn ? "All graded!" : "채점 완료")
              }
            </p>
            <div className="flex items-center text-xs text-primary mt-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              {isEn ? "Go to grade" : "바로가기"} <ChevronRight className="h-3 w-3 ml-0.5" />
            </div>
          </button>

          {/* Recent Announcements */}
          <button
            onClick={() => navigate("/admin/announcements")}
            className="stat-card !p-4 text-left hover:border-chart-4/30 transition-colors group cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="rounded-lg bg-chart-4/10 p-2.5">
                <Megaphone className="h-5 w-5 text-chart-4" />
              </div>
            </div>
            <p className="text-sm font-medium text-foreground mt-3">
              {isEn ? "Announcements" : "공지사항"}
            </p>
            {recentAnnouncements.length > 0 ? (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {recentAnnouncements[0]?.title}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                {isEn ? "No announcements" : "공지 없음"}
              </p>
            )}
            <div className="flex items-center text-xs text-primary mt-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              {isEn ? "View all" : "바로가기"} <ChevronRight className="h-3 w-3 ml-0.5" />
            </div>
          </button>

          {/* Active Learning Tracks */}
          <button
            onClick={() => navigate("/admin/tracks")}
            className="stat-card !p-4 text-left hover:border-primary/30 transition-colors group cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <Layers className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              {activeTracksCount > 0 && (
                <Badge variant="secondary" className="text-xs">{activeTracksCount}</Badge>
              )}
            </div>
            <p className="text-sm font-medium text-foreground mt-3">
              {isEn ? "Active Tracks" : "활성 학습 트랙"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {activeTracksCount > 0
                ? (isEn ? `${activeTracksCount} tracks running` : `${activeTracksCount}개 트랙 운영 중`)
                : (isEn ? "No active tracks" : "활성 트랙 없음")}
            </p>
            <div className="flex items-center text-xs text-primary mt-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              {isEn ? "Manage tracks" : "트랙 관리"} <ChevronRight className="h-3 w-3 ml-0.5" />
            </div>
          </button>
        </div>

        {/* ② Trends & Distributions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="stat-card !p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-chart-2" />
                {isEn ? "Signups (7d)" : "최근 7일 가입"}
              </h3>
              <span className="text-xs text-muted-foreground">
                {weeklyTrends?.signupTrend.reduce((s, d) => s + d.value, 0) || 0}{t("common.people")}
              </span>
            </div>
            <Suspense fallback={<ChartFallback />}>
              {weeklyTrends && <DashCharts.TrendArea data={weeklyTrends.signupTrend} color="hsl(var(--chart-2))" unit={t("common.people")} height={180} />}
            </Suspense>
          </div>

          <div className="stat-card !p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-chart-4" />
                {isEn ? "Completions (7d)" : "최근 7일 수료"}
              </h3>
              <span className="text-xs text-muted-foreground">
                {weeklyTrends?.completeTrend.reduce((s, d) => s + d.value, 0) || 0}{t("common.people")}
              </span>
            </div>
            <Suspense fallback={<ChartFallback />}>
              {weeklyTrends && <DashCharts.TrendArea data={weeklyTrends.completeTrend} color="hsl(var(--chart-4))" unit={t("common.people")} height={180} />}
            </Suspense>
          </div>

          <div className="stat-card !p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-chart-3" />
                {isEn ? "Daily Visitors (7d)" : "최근 7일 접속자"}
              </h3>
              <span className="text-xs text-muted-foreground">
                {weeklyTrends?.sessionTrend.reduce((s, d) => Math.max(s, d.value), 0) || 0} {isEn ? "peak" : "최대"}
              </span>
            </div>
            <Suspense fallback={<ChartFallback />}>
              {weeklyTrends && <DashCharts.TrendArea data={weeklyTrends.sessionTrend} color="hsl(var(--chart-3))" unit={t("common.people")} height={180} />}
            </Suspense>
          </div>
        </div>

        {/* ③ Course / Progress Distributions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="stat-card !p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                {isEn ? "Course Status" : "강의 상태 구성"}
              </h3>
              <span className="text-xs text-muted-foreground">{courses.length}{t("common.count")}</span>
            </div>
            <Suspense fallback={<ChartFallback />}>
              <DashCharts.Donut
                height={200}
                centerValue={String(courses.length)}
                centerLabel={isEn ? "Total" : "전체 강의"}
                data={[
                  { name: isEn ? "Published" : "공개", value: courses.filter((c: any) => c.status === "published").length, color: "hsl(158 64% 42%)" },
                  { name: isEn ? "Draft" : "초안", value: courses.filter((c: any) => c.status === "draft").length, color: "hsl(38 92% 55%)" },
                  { name: isEn ? "Mandatory" : "필수", value: courses.filter((c: any) => c.is_mandatory).length, color: "hsl(217 91% 55%)" },
                ].filter(d => d.value > 0)}
              />
            </Suspense>
          </div>

          <div className="stat-card !p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                {isEn ? "Learner Progress Distribution" : "수강생 진도율 분포"}
              </h3>
              <span className="text-xs text-muted-foreground">{enrollments.length}{isEn ? " enrollments" : "건"}</span>
            </div>
            <Suspense fallback={<ChartFallback />}>
              <DashCharts.Buckets enrollments={enrollments} height={200} />
            </Suspense>
          </div>
        </div>

        {/* B2C Revenue Section - 사이트 설정에서 B2C 기능이 활성화된 경우에만 노출 */}
        {b2cEnabled && (
        <div className="stat-card !p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              {isEn ? "B2C Sales" : "B2C 매출 현황"}
            </h3>
            <Link to="/admin/orders">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground">
                {t("common.viewAll")} <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-border">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">{isEn ? "Today Orders" : "오늘 결제"}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{b2cStats?.todayCount || 0}<span className="text-sm font-normal text-muted-foreground ml-1">{isEn ? "orders" : "건"}</span></p>
            </div>
            <div className="p-4 rounded-xl border border-border">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingBag className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">{isEn ? "Today Revenue" : "오늘 매출"}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{((b2cStats?.todayRevenue || 0) / 1).toLocaleString()}<span className="text-sm font-normal text-muted-foreground ml-1">원</span></p>
            </div>
          </div>
          {b2cStats?.chartData && b2cStats.chartData.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">{isEn ? "Last 30 Days Revenue" : "최근 30일 일별 매출"}</p>
              <div className="h-48">
                <Suspense fallback={<ChartFallback />}>
                  <B2cRevenueChart data={b2cStats.chartData} />
                </Suspense>
              </div>
            </div>
          )}
        </div>
        )}

        {/* ③ Bottom Row: Activity Feed + Quick Summary */}
        <TrackStatsCard variant="full" limit={5} />

        <AssessmentOverviewWidget />

        <BranchTopWidget />

        <div className="grid lg:grid-cols-5 gap-4">
          {/* Recent Activity Feed */}
          <div className="stat-card !p-5 lg:col-span-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {isEn ? "Recent Activity" : "최근 활동"}
              </h3>
            </div>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t("common.noData")}</p>
            ) : (
              <div className="space-y-1">
                {recentActivity.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
                    <div className="mt-0.5 shrink-0">
                      {getActivityIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-snug">
                        {getActivityText(item)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(item.time), { addSuffix: true, locale })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Summary */}
          <div className="lg:col-span-2 space-y-4">
            {/* Weekly Summary */}
            <div className="stat-card !p-5">
              <h3 className="text-base font-semibold text-foreground mb-3">
                {isEn ? "Quick Summary" : "빠른 요약"}
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {isEn ? "Total Enrollments" : "전체 수강"}
                  </span>
                  <span className="text-sm font-bold text-foreground">{enrollments.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" />
                    {isEn ? "Completions" : "수료 완료"}
                  </span>
                  <span className="text-sm font-bold text-foreground">{enrollments.filter((e: any) => e.completed_at).length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    {isEn ? "Active Courses" : "활성 강의"}
                  </span>
                  <span className="text-sm font-bold text-foreground">{courses.filter((c: any) => c.status === "published").length}</span>
                </div>
              </div>
            </div>

            {/* Top Courses */}
            <div className="stat-card !p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-foreground">
                  {isEn ? "Popular Courses" : "인기 강의 TOP 3"}
                </h3>
                <Link to="/admin/courses">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground">
                    {t("common.viewAll")} <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
              {topCourses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t("common.noData")}</p>
              ) : (
                <div className="space-y-3">
                  {topCourses.map((course, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-foreground font-medium truncate flex-1">
                          <span className="text-xs text-muted-foreground mr-1.5">{idx + 1}.</span>
                          {course.title}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">{course.enrolled}{t("common.people")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${course.avgProgress}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">{course.avgProgress}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
