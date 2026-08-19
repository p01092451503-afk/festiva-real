import { useState, Suspense } from "react";
import { lazyWithRetry as lazy } from "@/lib/lazyWithRetry";
import { Activity, HardDrive, Globe, Play, TrendingUp, Calendar, Database, Eye, Users, Server, Award, GraduationCap, Sparkles, Clock, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { ChartFallback } from "@/components/PageSkeletons";
import { format, subDays } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";

// Non-chart cards stay eager (no recharts dependency).
import SiteSummaryCard from "@/components/admin/stats/SiteSummaryCard";
import TodayOperationsCard from "@/components/admin/stats/TodayOperationsCard";
import CourseStatsCard from "@/components/admin/stats/CourseStatsCard";
import LearningActivityCard from "@/components/admin/stats/LearningActivityCard";
import RealtimeUsersCard from "@/components/admin/stats/RealtimeUsersCard";
import TrackStatsCard from "@/components/admin/stats/TrackStatsCard";
import TrackFunnelCard from "@/components/admin/stats/TrackFunnelCard";
import RichStatCard from "@/components/admin/stats/RichStatCard";

// Recharts-heavy components → lazy so vendor-charts (~113KB gzip) loads
// only after the page's text/cards have painted.

const MemberStatsCard = lazy(() => import("@/components/admin/stats/MemberStatsCard"));
const HourlyAccessChart = lazy(() => import("@/components/admin/stats/HourlyAccessChart"));
const SignupTrendChart = lazy(() => import("@/components/admin/stats/SignupTrendChart"));
const TrafficLineChartLazy = lazy(() =>
  import("@/components/charts/TrafficCharts").then((m) => ({ default: m.TrafficLineChart })),
);
const TrafficBarChartLazy = lazy(() =>
  import("@/components/charts/TrafficCharts").then((m) => ({ default: m.TrafficBarChart })),
);

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

/** Compact inline metric for the system-resource strip. */
const CompactMetric = ({
  icon: Icon,
  label,
  value,
  sub,
  tone = "text-foreground",
}: {
  icon: typeof Globe;
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) => (
  <div className="px-3 py-2.5 flex items-center gap-2.5 min-w-0">
    <Icon className={`h-4 w-4 shrink-0 ${tone}`} aria-hidden="true" />
    <div className="min-w-0 flex-1">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none truncate">
        {label}
      </p>
      <div className="flex items-baseline gap-1.5 mt-1">
        <p className="text-sm font-semibold text-foreground tabular-nums leading-none truncate">
          {value}
        </p>
        {sub && (
          <p className="text-[10px] text-muted-foreground tabular-nums leading-none truncate">
            {sub}
          </p>
        )}
      </div>
    </div>
  </div>
);

const AdminTraffic = () => {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const [period, setPeriod] = useState("30");

  const fromDate = subDays(new Date(), parseInt(period)).toISOString();

  const { data: trafficLogs = [] } = useQuery({
    queryKey: ["traffic-logs", period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("traffic_logs")
        .select("*")
        .gte("created_at", fromDate)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });

  const { data: storageData } = useQuery({
    queryKey: ["storage-usage"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_contents")
        .select("id, video_url, video_provider, content_type");
      if (error) throw error;
      return data;
    },
  });

  const { data: videoAssets } = useQuery({
    queryKey: ["video-assets-storage"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_assets")
        .select("id, file_size_mb, video_provider");
      if (error) throw error;
      return data as { id: string; file_size_mb: number | null; video_provider: string | null }[];
    },
  });

  // Live Bunny Stream library stats (storage + count + duration), refreshed periodically
  const { data: bunnyLive } = useQuery({
    queryKey: ["bunny-live-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("bunny-stream-list");
      if (error) throw error;
      const videos = ((data as any)?.videos || []) as {
        storage_size_bytes: number;
        length_seconds: number;
      }[];
      return {
        count: videos.length,
        bytes: videos.reduce((s, v) => s + (Number(v.storage_size_bytes) || 0), 0),
        seconds: videos.reduce((s, v) => s + (Number(v.length_seconds) || 0), 0),
      };
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
  });


  // Learning outcome metrics
  const { data: enrollmentStats } = useQuery({
    queryKey: ["learning-outcome-enrollments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("id, status, progress, completed_at, course_id, enrolled_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: certificateStats } = useQuery({
    queryKey: ["learning-outcome-certificates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certificates")
        .select("id, issued_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: mandatoryCourses } = useQuery({
    queryKey: ["learning-outcome-mandatory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, is_mandatory, deadline")
        .eq("is_mandatory", true);
      if (error) throw error;
      return data;
    },
  });

  const totalPageViews = trafficLogs.filter((l) => l.event_type === "page_view").length;
  const totalContentAccess = trafficLogs.filter((l) => l.event_type === "content_access").length;
  const uniqueUsers = new Set(trafficLogs.map((l) => l.user_id)).size;

  const contentLogs = trafficLogs.filter((l) => l.event_type === "content_access");
  const externalAccess = contentLogs.filter((l) => (l.metadata as any)?.is_external).length;
  const selfHostedAccess = contentLogs.length - externalAccess;

  const cdnBytes = contentLogs
    .filter((l) => !(l.metadata as any)?.is_external)
    .reduce((sum, l) => sum + (Number(l.estimated_bytes) || 0), 0);
  const webBytes = trafficLogs
    .filter((l) => l.event_type === "page_view")
    .reduce((sum, l) => sum + (Number(l.estimated_bytes) || 0), 0);

  const totalContents = storageData?.length || 0;
  const videoContents = storageData?.filter((c) => c.content_type === "video").length || 0;
  const docContents = storageData?.filter((c) => c.content_type === "document").length || 0;

  const cdnStorageMb = (videoAssets || []).reduce(
    (sum, v) => sum + (Number(v.file_size_mb) || 0),
    0,
  );
  const dbCdnStorageBytes = cdnStorageMb * 1024 * 1024;
  const dbCdnStoredCount = (videoAssets || []).filter((v) =>
    ["bunny", "cloudflare", "upload", "custom"].includes(v.video_provider || ""),
  ).length;
  // Prefer live Bunny numbers when available (DB rows may lack file_size_mb)
  const cdnStorageBytes = bunnyLive ? Math.max(bunnyLive.bytes, dbCdnStorageBytes) : dbCdnStorageBytes;
  const cdnStoredCount = bunnyLive ? Math.max(bunnyLive.count, dbCdnStoredCount) : dbCdnStoredCount;


  // === Learning outcome calculations ===
  const allEnrollments = enrollmentStats || [];
  const approvedEnrollments = allEnrollments.filter((e: any) => e.status === "approved");
  const completedEnrollments = allEnrollments.filter((e: any) => e.completed_at !== null);
  const pendingEnrollments = allEnrollments.filter((e: any) => e.status === "pending");

  const completionRate = approvedEnrollments.length > 0
    ? (completedEnrollments.length / approvedEnrollments.length) * 100
    : 0;

  const avgProgress = approvedEnrollments.length > 0
    ? approvedEnrollments.reduce((sum: number, e: any) => sum + (Number(e.progress) || 0), 0) / approvedEnrollments.length
    : 0;

  const totalCertificates = certificateStats?.length || 0;

  // Certificates issued sparkline (last 14 days)
  const certDailyMap = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    certDailyMap.set(format(subDays(new Date(), i), "MM/dd"), 0);
  }
  (certificateStats || []).forEach((c: any) => {
    const day = format(new Date(c.issued_at), "MM/dd");
    if (certDailyMap.has(day)) certDailyMap.set(day, (certDailyMap.get(day) || 0) + 1);
  });
  const certSparkline = Array.from(certDailyMap.values());

  // Mandatory training non-completion: enrollments for mandatory courses that aren't completed
  const mandatoryCourseIds = new Set((mandatoryCourses || []).map((c: any) => c.id));
  const mandatoryEnrollments = approvedEnrollments.filter((e: any) => mandatoryCourseIds.has(e.course_id));
  const mandatoryIncomplete = mandatoryEnrollments.filter((e: any) => e.completed_at === null).length;
  const mandatoryIncompleteRate = mandatoryEnrollments.length > 0
    ? (mandatoryIncomplete / mandatoryEnrollments.length) * 100
    : 0;

  const dailyMap = new Map<string, { views: number; access: number; bytes: number }>();
  for (let i = parseInt(period) - 1; i >= 0; i--) {
    const day = format(subDays(new Date(), i), "MM/dd");
    dailyMap.set(day, { views: 0, access: 0, bytes: 0 });
  }
  trafficLogs.forEach((l) => {
    const day = format(new Date(l.created_at!), "MM/dd");
    const entry = dailyMap.get(day);
    if (entry) {
      if (l.event_type === "page_view") entry.views++;
      if (l.event_type === "content_access") entry.access++;
      entry.bytes += Number(l.estimated_bytes) || 0;
    }
  });
  const dailyChartData = Array.from(dailyMap.entries()).map(([date, data]) => ({
    date,
    ...data,
    bytesGB: parseFloat((data.bytes / (1024 * 1024 * 1024)).toFixed(3)),
  }));

  const trafficStats = [
    { label: t("stats.webTraffic"), value: formatBytes(webBytes), icon: Globe },
    { label: t("stats.cdnTraffic"), value: formatBytes(cdnBytes), icon: Play },
    { label: t("stats.totalTraffic"), value: formatBytes(webBytes + cdnBytes), icon: TrendingUp },
    { label: t("stats.storedLessons"), value: t("stats.itemCount", { count: totalContents }), icon: HardDrive },
    {
      label: t("stats.cdnStorage"),
      value: formatBytes(cdnStorageBytes),
      icon: Database,
      sub: `${cdnStoredCount} files · ${t("stats.cdnStorageNote")}`,
    },
  ];

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              {t("stats.statsTitle")}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {t("stats.statsDesc")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <RealtimeUsersCard />
          <SiteSummaryCard />
          <TodayOperationsCard />
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview" className="text-xs">{t("stats.tabOverview")}</TabsTrigger>
            <TabsTrigger value="learning" className="text-xs">{t("stats.tabLearning")}</TabsTrigger>
            <TabsTrigger value="traffic" className="text-xs">{t("stats.tabTraffic")}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Suspense fallback={<div className="h-[260px]"><ChartFallback /></div>}>
                <SignupTrendChart period={parseInt(period)} />
              </Suspense>
              <Suspense fallback={<div className="h-[260px]"><ChartFallback /></div>}>
                <HourlyAccessChart />
              </Suspense>
            </div>
            <Suspense fallback={<div className="h-[200px]"><ChartFallback /></div>}>
              <MemberStatsCard />
            </Suspense>
            <CourseStatsCard />
            <TrackStatsCard variant="full" limit={5} />
          </TabsContent>


          <TabsContent value="traffic" className="space-y-4">
            <div className="flex w-full sm:w-auto items-center gap-2 self-start">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">{t("stats.last7days")}</SelectItem>
                  <SelectItem value="30">{t("stats.last30days")}</SelectItem>
                  <SelectItem value="90">{t("stats.last90days")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Row 1: Traffic & Storage */}
            {/* Row 1: Learning Outcomes (KPI focus) */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">학습 성과</h2>
                <span className="text-[11px] text-muted-foreground">· LMS 핵심 지표</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
                <RichStatCard
                  label="수료율"
                  value={`${completionRate.toFixed(1)}%`}
                  icon={GraduationCap}
                  tone="emerald"
                  visual="ring"
                  ringValue={completionRate}
                  sub={`${completedEnrollments.length} / ${approvedEnrollments.length}건 수료`}
                />
                <RichStatCard
                  label="평균 진도율"
                  value={`${avgProgress.toFixed(1)}%`}
                  icon={TrendingUp}
                  tone="sky"
                  visual="bar"
                  barValue={avgProgress}
                  barCaption={`승인 등록자 ${approvedEnrollments.length}명 기준`}
                />
                <RichStatCard
                  label="이수증 발급"
                  value={totalCertificates.toLocaleString()}
                  icon={Award}
                  tone="violet"
                  visual="sparkline"
                  sparklineValues={certSparkline.map((v) => v || 0.01)}
                  sub="최근 14일 발급 추이"
                />
                <RichStatCard
                  label="승인 대기 등록"
                  value={pendingEnrollments.length.toLocaleString()}
                  icon={Clock}
                  tone="amber"
                  visual="dots"
                  dotsActive={Math.min(7, pendingEnrollments.length)}
                  dotsTotal={7}
                  sub={pendingEnrollments.length > 0 ? "처리 필요" : "처리 완료"}
                />
                <RichStatCard
                  label="필수교육 미이수"
                  value={`${mandatoryIncomplete}명`}
                  icon={AlertTriangle}
                  tone="rose"
                  visual="bar"
                  barValue={mandatoryIncompleteRate}
                  barCaption={`전체 필수 등록 ${mandatoryEnrollments.length}건 중`}
                />
              </div>
            </div>

            {/* Row 2: Compact Traffic & Storage Strip */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Server className="h-3.5 w-3.5 text-muted-foreground" />
                <h2 className="text-xs font-medium text-muted-foreground">시스템 리소스 · 트래픽</h2>
              </div>
              <div className="rounded-xl border border-border bg-card divide-y sm:divide-y-0 sm:divide-x divide-border grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 overflow-hidden">
                <CompactMetric
                  icon={Globe}
                  label="웹 트래픽"
                  value={formatBytes(webBytes)}
                  tone="text-sky-600 dark:text-sky-400"
                />
                <CompactMetric
                  icon={Play}
                  label="CDN 트래픽"
                  value={formatBytes(cdnBytes)}
                  tone="text-violet-600 dark:text-violet-400"
                />
                <CompactMetric
                  icon={TrendingUp}
                  label="총 전송량"
                  value={formatBytes(webBytes + cdnBytes)}
                  tone="text-indigo-600 dark:text-indigo-400"
                />
                <CompactMetric
                  icon={Database}
                  label="CDN 저장"
                  value={formatBytes(cdnStorageBytes)}
                  sub={bunnyLive
                    ? `${cdnStoredCount}개 · ${Math.round(bunnyLive.seconds / 60)}분 (실시간)`
                    : `${cdnStoredCount}개`}
                  tone="text-amber-600 dark:text-amber-400"
                />

                <CompactMetric
                  icon={HardDrive}
                  label="저장 차시"
                  value={`${totalContents}`}
                  sub={`영상 ${videoContents}`}
                  tone="text-teal-600 dark:text-teal-400"
                />
                <CompactMetric
                  icon={Eye}
                  label="페이지뷰"
                  value={totalPageViews.toLocaleString()}
                  tone="text-foreground"
                />
                <CompactMetric
                  icon={Users}
                  label="활성 사용자"
                  value={uniqueUsers.toLocaleString()}
                  sub={`${totalContentAccess} 재생`}
                  tone="text-rose-600 dark:text-rose-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2 px-3 sm:px-6">
                  <CardTitle className="text-sm font-medium">{t("stats.dailyTraffic")}</CardTitle>
                </CardHeader>
                <CardContent className="px-2 sm:px-6">
                  <div className="h-[200px] sm:h-[250px]">
                    <Suspense fallback={<ChartFallback />}>
                      <TrafficLineChartLazy
                        data={dailyChartData}
                        isMobile={isMobile}
                        pageViewLabel={t("stats.pageViewLabel")}
                        lessonAccessLabel={t("stats.lessonAccess")}
                      />
                    </Suspense>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 px-3 sm:px-6">
                  <CardTitle className="text-sm font-medium">{t("stats.dailyTransfer")}</CardTitle>
                </CardHeader>
                <CardContent className="px-2 sm:px-6">
                  <div className="h-[200px] sm:h-[250px]">
                    <Suspense fallback={<ChartFallback />}>
                      <TrafficBarChartLazy
                        data={dailyChartData}
                        isMobile={isMobile}
                        transferLabel={t("stats.transferLabel")}
                      />
                    </Suspense>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2 px-3 sm:px-6">
                <CardTitle className="text-sm font-medium">{t("stats.storageStatus")}</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: t("stats.videoLessons"), count: videoContents },
                    { label: t("stats.docFlip"), count: docContents },
                    { label: t("stats.other"), count: totalContents - videoContents - docContents },
                  ].map((item) => (
                    <div key={item.label} className="space-y-2">
                      <div className="flex justify-between text-sm gap-3">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-medium shrink-0">{t("stats.itemCount", { count: item.count })}</span>
                      </div>
                      <Progress value={totalContents > 0 ? (item.count / totalContents) * 100 : 0} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

          </TabsContent>

          <TabsContent value="learning" className="space-y-4">
            <LearningActivityCard />
            <CourseStatsCard />
            <TrackStatsCard variant="full" limit={10} />
            <TrackFunnelCard />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminTraffic;
