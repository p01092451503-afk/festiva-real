import { Award, Flame, Star, Target, TrendingUp, Zap, Trophy, Crown, Medal } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, lazy, Suspense } from "react";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useTranslation } from "react-i18next";
import { ChartFallback } from "@/components/PageSkeletons";
import RichStatCard from "@/components/admin/stats/RichStatCard";

// Lazy-load every recharts visualization on this page so vendor-charts
// (~113KB gzip) is fetched after first paint instead of blocking it.
const LevelRadial = lazy(() => import("@/components/charts/AchievementCharts").then((m) => ({ default: m.LevelRadial })));
const BadgeRadial = lazy(() => import("@/components/charts/AchievementCharts").then((m) => ({ default: m.BadgeRadial })));
const PointsTrendArea = lazy(() => import("@/components/charts/AchievementCharts").then((m) => ({ default: m.PointsTrendArea })));
const CategoryProgressBar = lazy(() => import("@/components/charts/AchievementCharts").then((m) => ({ default: m.CategoryProgressBar })));

const badgeIcons: Record<string, React.ElementType> = {
  star: Star, flame: Flame, target: Target, award: Award, zap: Zap,
};

// 노무사 수험 학원 데모 리더보드 - 본원/분원 + 수강생/강사 직책 기반
type LeaderboardEntry = {
  person: string;
  branch: string;
  role: string;
  points: number;
  level: number;
};

type LeaderboardEntryLocalized = LeaderboardEntry & { branch_en?: string; role_en?: string };

const DEMO_LEADERBOARD: LeaderboardEntryLocalized[] = [
  { person: "김민수", branch: "서울 본원", branch_en: "Seoul Main", role: "전임강사", role_en: "Lead Instructor", points: 4820, level: 49 },
  { person: "이정환", branch: "강남 분원", branch_en: "Gangnam Branch", role: "전임강사", role_en: "Lead Instructor", points: 4150, level: 42 },
  { person: "박지영", branch: "서울 본원", branch_en: "Seoul Main", role: "2차 수험생", role_en: "Stage 2 Examinee", points: 3680, level: 37 },
  { person: "최현우", branch: "부산 분원", branch_en: "Busan Branch", role: "2차 수험생", role_en: "Stage 2 Examinee", points: 3220, level: 33 },
  { person: "이지은", branch: "강남 분원", branch_en: "Gangnam Branch", role: "1차 수험생", role_en: "Stage 1 Examinee", points: 2850, level: 29 },
  { person: "정유진", branch: "대구 분원", branch_en: "Daegu Branch", role: "1차 수험생", role_en: "Stage 1 Examinee", points: 2410, level: 25 },
  { person: "박철수", branch: "부산 분원", branch_en: "Busan Branch", role: "1차 수험생", role_en: "Stage 1 Examinee", points: 1980, level: 20 },
  { person: "한소희", branch: "서울 본원", branch_en: "Seoul Main", role: "온라인 수강생", role_en: "Online Learner", points: 1560, level: 16 },
  { person: "강민재", branch: "광주 분원", branch_en: "Gwangju Branch", role: "온라인 수강생", role_en: "Online Learner", points: 1240, level: 13 },
  { person: "윤서아", branch: "대구 분원", branch_en: "Daegu Branch", role: "입문 수강생", role_en: "Beginner", points: 980, level: 10 },
  { person: "최서연", branch: "강남 분원", branch_en: "Gangnam Branch", role: "입문 수강생", role_en: "Beginner", points: 860, level: 9 },
  { person: "임도현", branch: "서울 본원", branch_en: "Seoul Main", role: "1차 수험생", role_en: "Stage 1 Examinee", points: 1820, level: 19 },
];

const StudentAchievements = () => {
  const { user } = useUser();
  const { t, i18n } = useTranslation();
  const isEn = !!i18n.language?.toLowerCase().startsWith("en");

  const { data: gamification } = useQuery({
    queryKey: ["my-gamification", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_gamification").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: myBadges = [] } = useQuery({
    queryKey: ["my-badges", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_badges").select("*, badges(*)").eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: allBadges = [] } = useQuery({
    queryKey: ["all-badges"],
    queryFn: async () => {
      const { data, error } = await supabase.from("badges").select("*");
      if (error) throw error;
      return data;
    },
  });

  const earnedBadgeIds = new Set(myBadges.map((b: any) => b.badge_id));

  const level = gamification?.level || 1;
  const totalPoints = gamification?.total_points || 0;
  const xp = gamification?.experience_points || 0;
  const streak = gamification?.streak_days || 0;
  const nextLevelXp = level * 200;
  const xpProgress = nextLevelXp > 0 ? Math.min(Math.round((xp / nextLevelXp) * 100), 100) : 0;

  // 뱃지 획득률
  const badgeRate = allBadges.length > 0 ? Math.round((myBadges.length / allBadges.length) * 100) : 0;

  // 최근 8주 포인트 추이 (데모용 가상 데이터 + 현재 포인트 반영)
  const weeklyTrend = [
    { week: t("achievements.weekAgo", { n: 8 }), points: Math.max(0, totalPoints - 1450), xp: Math.max(0, xp - 1200) },
    { week: t("achievements.weekAgo", { n: 7 }), points: Math.max(0, totalPoints - 1200), xp: Math.max(0, xp - 1000) },
    { week: t("achievements.weekAgo", { n: 6 }), points: Math.max(0, totalPoints - 980), xp: Math.max(0, xp - 820) },
    { week: t("achievements.weekAgo", { n: 5 }), points: Math.max(0, totalPoints - 720), xp: Math.max(0, xp - 600) },
    { week: t("achievements.weekAgo", { n: 4 }), points: Math.max(0, totalPoints - 520), xp: Math.max(0, xp - 430) },
    { week: t("achievements.weekAgo", { n: 3 }), points: Math.max(0, totalPoints - 340), xp: Math.max(0, xp - 280) },
    { week: t("achievements.weekAgo", { n: 2 }), points: Math.max(0, totalPoints - 160), xp: Math.max(0, xp - 130) },
    { week: t("achievements.thisWeek"), points: totalPoints, xp },
  ];

  // 카테고리별 학습 활동 (DB의 실제 카테고리 기반 데모 진도)
  const activityByCategory = [
    { category: t("achievements.category.product"), value: 92 },
    { category: t("achievements.category.clinical"), value: 85 },
    { category: t("achievements.category.skin"), value: 74 },
    { category: t("achievements.category.marketing"), value: 68 },
    { category: t("achievements.category.cs"), value: 62 },
    { category: t("achievements.category.safety"), value: 55 },
    { category: t("achievements.category.compliance"), value: 48 },
    { category: t("achievements.category.onboarding"), value: 40 },
  ];

  // 레벨 진행 라디얼
  const radialData = [
    { name: "level", value: xpProgress, fill: "hsl(var(--primary))" },
  ];

  // 뱃지 획득률 라디얼
  const badgeRadialData = [
    { name: "badges", value: badgeRate, fill: "hsl(var(--warning))" },
  ];

  // 리더보드 필터: 지점 / 직책
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // 데모 리더보드 + 현재 사용자 합산
  const allEntries = useMemo<(LeaderboardEntryLocalized & { isMe?: boolean })[]>(() => [
    ...DEMO_LEADERBOARD,
    {
      person: t("achievements.youSuffix"),
      branch: "서울 강남점",
      branch_en: "Seoul Gangnam",
      role: "시술자",
      role_en: "Practitioner",
      points: totalPoints,
      level,
      isMe: true,
    },
  ], [totalPoints, level, t]);

  const branchOptions = useMemo(
    () =>
      Array.from(
        new Map(
          allEntries.map((e) => [e.branch, isEn ? e.branch_en || e.branch : e.branch] as const),
        ).entries(),
      ),
    [allEntries, isEn],
  );
  const roleOptions = useMemo(
    () =>
      Array.from(
        new Map(
          allEntries.map((e) => [e.role, isEn ? e.role_en || e.role : e.role] as const),
        ).entries(),
      ),
    [allEntries, isEn],
  );

  const combinedLeaderboard = useMemo(
    () =>
      allEntries
        .filter((e) => branchFilter === "all" || e.branch === branchFilter)
        .filter((e) => roleFilter === "all" || e.role === roleFilter)
        .sort((a, b) => b.points - a.points)
        .slice(0, 10),
    [allEntries, branchFilter, roleFilter]
  );

  return (
    <DashboardLayout role="student">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2"><Award className="h-6 w-6" aria-hidden="true" />{t("achievements.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("achievements.subtitle")}</p>
        </div>

        <section
          className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3"
          aria-label={t("achievements.title")}
        >
          <RichStatCard
            label={t("achievements.currentLevel")}
            value={`Lv.${level}`}
            icon={TrendingUp}
            tone="violet"
            sub={`${xp} / ${nextLevelXp} XP`}
            visual="ring"
            ringValue={xpProgress}
          />
          <RichStatCard
            label={t("achievements.totalPoints")}
            value={totalPoints.toLocaleString()}
            icon={Zap}
            tone="amber"
            sub={t("achievements.cumulativePoints", { defaultValue: "누적 포인트" })}
            visual="sparkline"
            sparklineValues={weeklyTrend.map((w) => w.points)}
          />
          <RichStatCard
            label={t("achievements.consecutiveDays")}
            value={streak}
            icon={Flame}
            tone="rose"
            sub={t("achievements.streakSub", { defaultValue: "연속 학습 일수" })}
            visual="dots"
            dotsActive={Math.min(7, streak)}
            dotsTotal={7}
          />
          <RichStatCard
            label={t("achievements.earnedBadges")}
            value={myBadges.length}
            icon={Award}
            tone="emerald"
            sub={`${myBadges.length} / ${allBadges.length}`}
            visual="bar"
            barValue={badgeRate}
            barCaption={`${badgeRate}%`}
          />
        </section>

        {/* 시각화 차트 섹션 */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* 레벨 진행도 라디얼 */}
          <div className="stat-card !p-4 sm:!p-6">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{t("achievements.levelProgress")}</h3>
            </div>
            <div className="relative h-[180px]">
              <Suspense fallback={<ChartFallback />}>
                <LevelRadial data={radialData} />
              </Suspense>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-3xl font-bold text-foreground">Lv.{level}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t("achievements.toLevel", { percent: xpProgress, next: level + 1 })}</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
              <span>{xp} XP</span>
              <span>{nextLevelXp} XP</span>
            </div>
          </div>

          {/* 뱃지 획득률 라디얼 */}
          <div className="stat-card !p-4 sm:!p-6">
            <div className="flex items-center gap-2 mb-3">
              <Medal className="h-4 w-4 text-warning" />
              <h3 className="text-sm font-semibold text-foreground">{t("achievements.badgeRate")}</h3>
            </div>
            <div className="relative h-[180px]">
              <Suspense fallback={<ChartFallback />}>
                <BadgeRadial data={badgeRadialData} />
              </Suspense>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-3xl font-bold text-foreground">{badgeRate}%</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{myBadges.length} / {allBadges.length} {t("achievements.badgesUnit")}</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-1.5 mt-2 text-[11px] text-muted-foreground">
              <Trophy className="h-3 w-3 text-warning" />
              <span>{t("achievements.badgeReached", { rate: badgeRate })}</span>
            </div>
          </div>

          {/* 연속 학습 + 활동 요약 */}
          <div className="stat-card !p-4 sm:!p-6">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="h-4 w-4 text-destructive" />
              <h3 className="text-sm font-semibold text-foreground">{t("achievements.learningStreak")}</h3>
            </div>
            <div className="flex items-center justify-center h-[180px]">
              <div className="text-center">
                <div className="relative inline-flex">
                  <Flame className="h-20 w-20 text-destructive/20" strokeWidth={1.5} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-2xl font-bold text-foreground">{streak}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{t("achievements.streakDays")}</p>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 mt-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 rounded-full ${i < Math.min(streak, 7) ? "bg-destructive" : "bg-muted"}`}
                  aria-hidden="true"
                />
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-1.5">{t("achievements.last7Days")}</p>
          </div>
        </section>

        {/* 포인트 추이 영역 차트 */}
        <section className="stat-card !p-4 sm:!p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-warning" />
              <h3 className="text-sm font-semibold text-foreground">{t("achievements.pointsTrend8w")}</h3>
            </div>
            <span className="text-[11px] text-muted-foreground">{t("achievements.totalPt", { pt: totalPoints.toLocaleString() })}</span>
          </div>
          <div className="h-[240px]">
            <Suspense fallback={<ChartFallback />}>
              <PointsTrendArea data={weeklyTrend} pointsLabel={t("achievements.totalPoints")} />
            </Suspense>
          </div>
        </section>

        {/* 카테고리별 학습 활동 + XP 진행 */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="stat-card !p-4 sm:!p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-4 w-4 text-info" />
              <h3 className="text-sm font-semibold text-foreground">{t("achievements.courseProgress")}</h3>
            </div>
            <div className="h-[240px]">
              <Suspense fallback={<ChartFallback />}>
                <CategoryProgressBar data={activityByCategory} progressLabel={t("achievements.progressLabel")} />
              </Suspense>
            </div>
          </div>

          <div className="stat-card !p-4 sm:!p-6">
            <div className="flex items-center gap-2 mb-4">
              <Crown className="h-4 w-4 text-warning" />
              <h3 className="text-sm font-semibold text-foreground">{t("achievements.nextLevel")}</h3>
            </div>
            <div className="space-y-5 mt-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-foreground">{t("achievements.xpProgress")}</span>
                  <span className="text-[11px] text-muted-foreground">{xp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP</span>
                </div>
                <Progress value={xpProgress} className="h-3" />
                <p className="text-[11px] text-muted-foreground mt-1.5">{t("achievements.xpRemaining", { next: level + 1, xp: (nextLevelXp - xp).toLocaleString() })}</p>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
                <div className="text-center">
                  <p className="text-xl font-bold text-foreground">{level}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{t("achievements.currentLevelShort")}</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-warning">{xpProgress}%</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{t("achievements.progressRate")}</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-success">{level + 1}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{t("achievements.nextLevelShort")}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">{t("achievements.badgeCollection")}</h2>
            <div className="stat-card !p-4 sm:!p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Medal className="h-4 w-4 text-warning" />
                  <h3 className="text-sm font-semibold text-foreground">{t("achievements.badgeStatus")}</h3>
                </div>
                <span className="text-xs text-muted-foreground">
                  <span className="text-base font-bold text-foreground">{myBadges.length}</span>
                  <span className="mx-1">/</span>
                  <span>{allBadges.length}</span>
                  <span className="ml-1">{isEn ? "" : "개"}</span>
                </span>
              </div>
              <Progress value={badgeRate} className="h-2" />
              <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
                <span>{t("achievements.badgeReached", { rate: badgeRate })}</span>
                <span>{t("achievements.badgeRemaining", { n: Math.max(0, allBadges.length - myBadges.length) })}</span>
              </div>
            </div>
            {allBadges.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("achievements.noBadges")}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {allBadges.map((badge: any) => {
                  const earned = earnedBadgeIds.has(badge.id);
                  const Icon = badgeIcons[badge.icon] || Star;
                  const translatedName = t(`achievements.badgeNames.${badge.name}`, { defaultValue: badge.name });
                  const descKey = badge.requirement_type === "lessons_completed" && badge.requirement_value === 1
                    ? "achievements.badgeDesc.lessons_completed_first"
                    : `achievements.badgeDesc.${badge.requirement_type}`;
                  const translatedDesc = t(descKey, { n: badge.requirement_value, defaultValue: badge.description });
                  return (
                    <div
                      key={badge.id}
                      className={`stat-card text-center !p-4 transition-all ${
                        earned
                          ? "!bg-warning/15 !border-warning/40 shadow-sm"
                          : "opacity-40 grayscale"
                      }`}
                    >
                      <Icon className={`h-8 w-8 mx-auto mb-2 ${earned ? "text-warning" : "text-muted-foreground"}`} />
                      <h3 className="text-sm font-medium text-foreground">{translatedName}</h3>
                      <p className="text-[10px] text-muted-foreground mt-1">{translatedDesc}</p>
                      {earned && <p className="text-[10px] text-success font-semibold mt-1.5">{t("achievements.earned")}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-foreground">{t("achievements.leaderboard")}</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder={t("achievements.branchAll")} />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">{t("achievements.branchAll")}</SelectItem>
                  {branchOptions.map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder={t("achievements.roleAll")} />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">{t("achievements.roleAll")}</SelectItem>
                  {roleOptions.map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {combinedLeaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
            ) : (
              <div className="stat-card !p-0 divide-y divide-border">
                {combinedLeaderboard.map((entry, idx) => {
                  const isMe = !!entry.isMe;
                  const branchLabel = isEn ? entry.branch_en || entry.branch : entry.branch;
                  const roleLabel = isEn ? entry.role_en || entry.role : entry.role;
                  return (
                    <div key={`${entry.person}-${entry.branch}-${idx}`} className={`p-3 flex items-center gap-3 ${isMe ? "bg-accent/40" : ""}`}>
                      <span className={`text-sm font-bold w-6 text-center ${idx < 3 ? "text-warning" : "text-muted-foreground"}`}>
                        {idx + 1}
                      </span>
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${isMe ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`}>
                        {entry.person.slice(0, 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {entry.person}{isMe ? ` (${t("achievements.youSuffix")})` : ""}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {branchLabel} · {roleLabel} · Lv.{entry.level || 1}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-foreground">{entry.points.toLocaleString()}pt</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentAchievements;