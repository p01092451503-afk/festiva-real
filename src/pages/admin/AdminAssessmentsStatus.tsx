import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ClipboardCheck, Globe2, Building2, Users, ChevronRight, ChevronLeft, Search, Download, CheckCircle2, XCircle, TrendingUp, Award } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import RichStatCard from "@/components/admin/stats/RichStatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ko, enUS } from "date-fns/locale";

// Country code → display label
const COUNTRY_LABELS: Record<string, { ko: string; en: string; flag: string }> = {
  KR: { ko: "한국", en: "Korea", flag: "🇰🇷" },
  US: { ko: "미국", en: "USA", flag: "🇺🇸" },
  JP: { ko: "일본", en: "Japan", flag: "🇯🇵" },
  BR: { ko: "브라질", en: "Brazil", flag: "🇧🇷" },
  TH: { ko: "태국", en: "Thailand", flag: "🇹🇭" },
  CN: { ko: "중국", en: "China", flag: "🇨🇳" },
  VN: { ko: "베트남", en: "Vietnam", flag: "🇻🇳" },
};

const AdminAssessmentsStatus = () => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const navigate = useNavigate();

  const [tab, setTab] = useState<"country" | "branch" | "individual">("country");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [search, setSearch] = useState("");

  // ===== Data fetching =====
  const { data: branches = [] } = useQuery({
    queryKey: ["asmt-status-branches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, name_en, country_code, entity_type, is_active")
        .eq("entity_type", "branch")
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["asmt-status-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, department_id, team_name, position");
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  const { data: assessments = [] } = useQuery({
    queryKey: ["asmt-status-assessments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select("id, title, course_id, passing_score");
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60_000,
  });

  const { data: attempts = [] } = useQuery({
    queryKey: ["asmt-status-attempts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_attempts")
        .select("id, user_id, assessment_id, score, passed, completed_at, started_at")
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  // ===== Lookup maps =====
  const branchMap = useMemo(() => new Map(branches.map((b: any) => [b.id, b])), [branches]);
  const profileMap = useMemo(() => new Map(profiles.map((p: any) => [p.user_id, p])), [profiles]);
  const assessmentMap = useMemo(() => new Map(assessments.map((a: any) => [a.id, a])), [assessments]);

  // user → branch info
  const userBranch = useMemo(() => {
    const m = new Map<string, { branchId: string | null; countryCode: string | null }>();
    profiles.forEach((p: any) => {
      const b = p.department_id ? (branchMap.get(p.department_id) as any) : null;
      m.set(p.user_id, {
        branchId: b?.id ?? null,
        countryCode: b?.country_code ?? null,
      });
    });
    return m;
  }, [profiles, branchMap]);

  // ===== Aggregation: Country level =====
  const countryStats = useMemo(() => {
    const map = new Map<
      string,
      { code: string; total: number; passed: number; scoreSum: number; scoredCount: number; userIds: Set<string> }
    >();
    attempts.forEach((a: any) => {
      const ub = userBranch.get(a.user_id);
      if (!ub?.countryCode) return;
      const cc = ub.countryCode;
      if (!map.has(cc)) map.set(cc, { code: cc, total: 0, passed: 0, scoreSum: 0, scoredCount: 0, userIds: new Set() });
      const row = map.get(cc)!;
      row.total += 1;
      if (a.passed) row.passed += 1;
      if (a.score != null) {
        row.scoreSum += Number(a.score);
        row.scoredCount += 1;
      }
      row.userIds.add(a.user_id);
    });
    return Array.from(map.values())
      .map((r) => ({
        code: r.code,
        attempts: r.total,
        passed: r.passed,
        passRate: r.total > 0 ? Math.round((r.passed / r.total) * 100) : 0,
        avgScore: r.scoredCount > 0 ? Math.round(r.scoreSum / r.scoredCount) : 0,
        learners: r.userIds.size,
      }))
      .sort((a, b) => b.attempts - a.attempts);
  }, [attempts, userBranch]);

  // ===== Aggregation: Branch level (filterable by country) =====
  const branchStats = useMemo(() => {
    const map = new Map<
      string,
      { branchId: string; total: number; passed: number; scoreSum: number; scoredCount: number; userIds: Set<string> }
    >();
    attempts.forEach((a: any) => {
      const ub = userBranch.get(a.user_id);
      if (!ub?.branchId) return;
      if (selectedCountry !== "all" && ub.countryCode !== selectedCountry) return;
      const bid = ub.branchId;
      if (!map.has(bid)) map.set(bid, { branchId: bid, total: 0, passed: 0, scoreSum: 0, scoredCount: 0, userIds: new Set() });
      const row = map.get(bid)!;
      row.total += 1;
      if (a.passed) row.passed += 1;
      if (a.score != null) {
        row.scoreSum += Number(a.score);
        row.scoredCount += 1;
      }
      row.userIds.add(a.user_id);
    });
    // include branches with 0 attempts when filtering
    branches.forEach((b: any) => {
      if (selectedCountry !== "all" && b.country_code !== selectedCountry) return;
      if (!map.has(b.id)) map.set(b.id, { branchId: b.id, total: 0, passed: 0, scoreSum: 0, scoredCount: 0, userIds: new Set() });
    });
    return Array.from(map.values())
      .map((r) => {
        const b = branchMap.get(r.branchId) as any;
        return {
          branchId: r.branchId,
          branchName: isEn && b?.name_en ? b.name_en : b?.name || "-",
          countryCode: b?.country_code || null,
          attempts: r.total,
          passed: r.passed,
          passRate: r.total > 0 ? Math.round((r.passed / r.total) * 100) : 0,
          avgScore: r.scoredCount > 0 ? Math.round(r.scoreSum / r.scoredCount) : 0,
          learners: r.userIds.size,
        };
      })
      .sort((a, b) => b.attempts - a.attempts || b.passRate - a.passRate);
  }, [attempts, userBranch, branches, branchMap, selectedCountry, isEn]);

  // ===== Aggregation: Individual level =====
  const individualStats = useMemo(() => {
    const map = new Map<
      string,
      { userId: string; total: number; passed: number; scoreSum: number; scoredCount: number; bestScore: number; lastAt: string | null }
    >();
    attempts.forEach((a: any) => {
      const ub = userBranch.get(a.user_id);
      if (selectedCountry !== "all" && ub?.countryCode !== selectedCountry) return;
      if (selectedBranch !== "all" && ub?.branchId !== selectedBranch) return;
      if (!map.has(a.user_id)) map.set(a.user_id, { userId: a.user_id, total: 0, passed: 0, scoreSum: 0, scoredCount: 0, bestScore: 0, lastAt: null });
      const row = map.get(a.user_id)!;
      row.total += 1;
      if (a.passed) row.passed += 1;
      if (a.score != null) {
        row.scoreSum += Number(a.score);
        row.scoredCount += 1;
        if (Number(a.score) > row.bestScore) row.bestScore = Number(a.score);
      }
      if (!row.lastAt || (a.completed_at && a.completed_at > row.lastAt)) row.lastAt = a.completed_at;
    });
    const q = search.trim().toLowerCase();
    return Array.from(map.values())
      .map((r) => {
        const p = profileMap.get(r.userId) as any;
        const b = p?.department_id ? (branchMap.get(p.department_id) as any) : null;
        return {
          userId: r.userId,
          name: p?.full_name || "-",
          email: p?.email || "",
          position: p?.position || "",
          branchName: b ? (isEn && b.name_en ? b.name_en : b.name) : "-",
          countryCode: b?.country_code || null,
          attempts: r.total,
          passed: r.passed,
          passRate: r.total > 0 ? Math.round((r.passed / r.total) * 100) : 0,
          avgScore: r.scoredCount > 0 ? Math.round(r.scoreSum / r.scoredCount) : 0,
          bestScore: r.bestScore,
          lastAt: r.lastAt,
        };
      })
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.branchName.toLowerCase().includes(q))
      .sort((a, b) => b.attempts - a.attempts);
  }, [attempts, userBranch, profileMap, branchMap, selectedCountry, selectedBranch, isEn, search]);

  // ===== Global KPIs =====
  const globalKpis = useMemo(() => {
    const total = attempts.length;
    const passed = attempts.filter((a: any) => a.passed).length;
    const scored = attempts.filter((a: any) => a.score != null);
    const avg = scored.length > 0 ? Math.round(scored.reduce((s: number, a: any) => s + Number(a.score || 0), 0) / scored.length) : 0;
    const learners = new Set(attempts.map((a: any) => a.user_id)).size;
    return { total, passed, passRate: total > 0 ? Math.round((passed / total) * 100) : 0, avg, learners };
  }, [attempts]);

  // ===== CSV export =====
  const exportCSV = () => {
    let header: string[] = [];
    let rows: (string | number)[][] = [];
    if (tab === "country") {
      header = [isEn ? "Country" : "지역", isEn ? "Learners" : "학습자", isEn ? "Attempts" : "응시", isEn ? "Pass Rate" : "합격률", isEn ? "Avg Score" : "평균 점수"];
      rows = countryStats.map((c) => [
        COUNTRY_LABELS[c.code] ? (isEn ? COUNTRY_LABELS[c.code].en : COUNTRY_LABELS[c.code].ko) : c.code,
        c.learners, c.attempts, `${c.passRate}%`, c.avgScore,
      ]);
    } else if (tab === "branch") {
      header = [isEn ? "Branch" : "지점", isEn ? "Country" : "지역", isEn ? "Learners" : "학습자", isEn ? "Attempts" : "응시", isEn ? "Pass Rate" : "합격률", isEn ? "Avg Score" : "평균 점수"];
      rows = branchStats.map((b) => [b.branchName, b.countryCode || "-", b.learners, b.attempts, `${b.passRate}%`, b.avgScore]);
    } else {
      header = [isEn ? "Learner" : "학습자", isEn ? "Email" : "이메일", isEn ? "Branch" : "지점", isEn ? "Attempts" : "응시", isEn ? "Pass Rate" : "합격률", isEn ? "Avg Score" : "평균 점수", isEn ? "Best Score" : "최고 점수"];
      rows = individualStats.map((u) => [u.name, u.email, u.branchName, u.attempts, `${u.passRate}%`, u.avgScore, u.bestScore]);
    }
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `assessment-status-${tab}-${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const passRateColor = (rate: number) => {
    if (rate >= 80) return "text-chart-3";
    if (rate >= 60) return "text-chart-2";
    return "text-destructive";
  };

  // HSL color tokens used by the gauge stroke (matches passRateColor tiers)
  const passRateStroke = (rate: number) => {
    if (rate >= 80) return "hsl(var(--chart-3))";
    if (rate >= 60) return "hsl(var(--chart-2))";
    return "hsl(var(--destructive))";
  };

  const passRateBadge = (rate: number, isEn: boolean) => {
    if (rate >= 80) return isEn ? "Excellent" : "우수";
    if (rate >= 60) return isEn ? "Good" : "양호";
    return isEn ? "Needs review" : "주의";
  };

  // Compact circular ring gauge (used inside the country card header).
  const PassRateRing = ({ rate, size = 56 }: { rate: number; size?: number }) => {
    const stroke = passRateStroke(rate);
    // 링이 커질수록 두께도 비례해서 살짝 두껍게 (≥64px → 6px).
    const strokeWidth = size >= 64 ? 6 : 5;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.min(100, Math.max(0, rate));
    const dashOffset = circumference - (clamped / 100) * circumference;
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        className="block"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={strokeWidth}
          opacity={0.45}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
    );
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
              {isEn ? "Assessment Status" : "평가 현황"}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {isEn
                ? "Drill down assessment performance by country, branch, and individual learner."
                : "지역 · 지점 · 개인 단위로 평가 응시 및 합격 현황을 한눈에 확인합니다."}
            </p>
          </div>
          <Button onClick={exportCSV} variant="outline" className="rounded-xl gap-2 text-sm">
            <Download className="h-4 w-4" aria-hidden="true" /> {isEn ? "Export CSV" : "CSV 내보내기"}
          </Button>
        </div>

        {/* Global KPIs — visualized */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <RichStatCard
            label={isEn ? "Unique learners" : "응시 학습자"}
            value={globalKpis.learners.toLocaleString()}
            icon={Users}
            tone="indigo"
            visual="sparkline"
            sparklineValues={[3, 5, 4, 6, 7, 5, 8]}
          />
          <RichStatCard
            label={isEn ? "Total attempts" : "총 응시 건수"}
            value={globalKpis.total.toLocaleString()}
            icon={ClipboardCheck}
            tone="violet"
            visual="bar"
            barValue={100}
            barCaption={isEn ? `${globalKpis.learners} learners participated` : `학습자 ${globalKpis.learners}명 참여`}
          />
          <RichStatCard
            label={isEn ? "Pass rate" : "합격률"}
            value={`${globalKpis.passRate}%`}
            icon={CheckCircle2}
            tone="emerald"
            visual="ring"
            ringValue={globalKpis.passRate}
            sub={isEn ? `${globalKpis.passed} passed` : `합격 ${globalKpis.passed}건`}
          />
          <RichStatCard
            label={isEn ? "Avg score" : "전체 평균 점수"}
            value={`${globalKpis.avg}${isEn ? "" : "점"}`}
            icon={TrendingUp}
            tone="amber"
            visual="ring"
            ringValue={typeof globalKpis.avg === "number" ? globalKpis.avg : 0}
            sub={isEn ? "out of 100" : "100점 만점"}
          />
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="country" className="text-xs gap-1.5"><Globe2 className="h-3.5 w-3.5" />{isEn ? "By Country" : "지역별"}</TabsTrigger>
            <TabsTrigger value="branch" className="text-xs gap-1.5"><Building2 className="h-3.5 w-3.5" />{isEn ? "By Branch" : "지점별"}</TabsTrigger>
            <TabsTrigger value="individual" className="text-xs gap-1.5"><Users className="h-3.5 w-3.5" />{isEn ? "By Learner" : "개인별"}</TabsTrigger>
          </TabsList>

          {/* ============ Country Tab ============ */}
          <TabsContent value="country" className="space-y-3">
            {countryStats.length === 0 ? (
              <div className="stat-card !p-8 text-center text-sm text-muted-foreground">
                {isEn ? "No assessment data yet." : "평가 응시 데이터가 없습니다."}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {countryStats.map((c) => {
                  const label = COUNTRY_LABELS[c.code];
                  const stroke = passRateStroke(c.passRate);
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => { setSelectedCountry(c.code); setTab("branch"); }}
                      className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-[0_10px_24px_-14px_rgba(0,0,0,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/10"
                    >
                      {/* Left accent stripe (color-coded) */}
                      <span
                        aria-hidden
                        className="absolute inset-y-0 left-0 w-1"
                        style={{ backgroundColor: stroke }}
                      />

                      {/* ── Top row: flag + name + ring + chevron ── */}
                      <div className="flex items-center gap-4">
                        <span
                          className="flex h-13 w-13 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/30 text-2xl"
                          style={{ height: "3.25rem", width: "3.25rem" }}
                          aria-hidden="true"
                        >
                          {label?.flag || "🌐"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-base font-semibold leading-tight text-foreground">
                            {label ? (isEn ? label.en : label.ko) : c.code}
                          </h3>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="font-mono text-[11px] font-medium tracking-wider text-muted-foreground/80">
                              {c.code}
                            </span>
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{ color: stroke, backgroundColor: `${stroke}14` }}
                            >
                              <span className="h-1 w-1 rounded-full" style={{ backgroundColor: stroke }} />
                              {passRateBadge(c.passRate, isEn)}
                            </span>
                          </div>
                        </div>
                        {/* Ring with perfectly centered % overlay */}
                        <div
                          className="relative shrink-0"
                          style={{ width: 68, height: 68 }}
                        >
                          <PassRateRing rate={c.passRate} size={68} />
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <span
                              className={`flex items-baseline tabular-nums leading-none ${passRateColor(c.passRate)}`}
                              style={{ transform: "translateY(0.5px)" }}
                            >
                              <span className="text-[15px] font-bold">{c.passRate}</span>
                              <span className="ml-[1px] text-[9px] font-semibold opacity-70">%</span>
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-foreground" />
                      </div>

                      {/* ── Bottom row: inline metrics ── */}
                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/50 pt-3.5 text-[13px]">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-muted-foreground/70">{isEn ? "Learners" : "학습자"}</span>
                          <span className="font-semibold tabular-nums text-foreground">{c.learners}</span>
                        </div>
                        <span className="h-3.5 w-px bg-border/60" />
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-muted-foreground/70">{isEn ? "Attempts" : "응시"}</span>
                          <span className="font-semibold tabular-nums text-foreground">{c.attempts}</span>
                        </div>
                        <span className="h-3.5 w-px bg-border/60" />
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-muted-foreground/70">{isEn ? "Avg" : "평균"}</span>
                          <span className="font-semibold tabular-nums text-foreground">
                            {c.avgScore}
                            <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">{isEn ? "pt" : "점"}</span>
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ============ Branch Tab ============ */}
          <TabsContent value="branch" className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
              {selectedCountry !== "all" && (
                <Button variant="ghost" size="sm" className="h-8 px-2 gap-1 text-xs" onClick={() => setSelectedCountry("all")}>
                  <ChevronLeft className="h-3.5 w-3.5" /> {isEn ? "All countries" : "전체 지역"}
                </Button>
              )}
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger className="w-full sm:w-48 h-9 rounded-xl">
                  <div className="flex items-center gap-1.5">
                    <Globe2 className="h-3.5 w-3.5" />
                    <SelectValue placeholder={isEn ? "Country" : "지역"} />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isEn ? "All countries" : "전체 지역"}</SelectItem>
                  {Array.from(new Set(branches.map((b: any) => b.country_code).filter(Boolean))).map((cc: any) => {
                    const lbl = COUNTRY_LABELS[cc];
                    return <SelectItem key={cc} value={cc}>{lbl ? `${lbl.flag} ${isEn ? lbl.en : lbl.ko}` : cc}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>

            {branchStats.length === 0 ? (
              <div className="stat-card !p-8 text-center text-sm text-muted-foreground">
                {isEn ? "No branches in this filter." : "조건에 맞는 지점이 없습니다."}
              </div>
            ) : (
              <div className="stat-card !p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isEn ? "Branch" : "지점"}</TableHead>
                        <TableHead className="hidden sm:table-cell">{isEn ? "Country" : "지역"}</TableHead>
                        <TableHead className="text-center">{isEn ? "Learners" : "학습자"}</TableHead>
                        <TableHead className="text-center">{isEn ? "Attempts" : "응시"}</TableHead>
                        <TableHead className="text-center">{isEn ? "Avg" : "평균"}</TableHead>
                        <TableHead className="text-center min-w-[140px]">{isEn ? "Pass rate" : "합격률"}</TableHead>
                        <TableHead className="text-right w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {branchStats.map((b) => {
                        const lbl = b.countryCode ? COUNTRY_LABELS[b.countryCode] : null;
                        return (
                          <TableRow
                            key={b.branchId}
                            className="cursor-pointer hover:bg-accent/30"
                            onClick={() => { setSelectedBranch(b.branchId); setTab("individual"); }}
                          >
                            <TableCell className="font-medium text-sm">{b.branchName}</TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {lbl ? (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                  <span aria-hidden="true">{lbl.flag}</span>{isEn ? lbl.en : lbl.ko}
                                </span>
                              ) : <span className="text-xs text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell className="text-center text-sm">{b.learners}</TableCell>
                            <TableCell className="text-center text-sm">{b.attempts}</TableCell>
                            <TableCell className="text-center text-sm">{b.avgScore}{isEn ? "" : "점"}</TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Progress value={b.passRate} className="h-1.5 w-16" />
                                <span className={`text-xs font-semibold ${passRateColor(b.passRate)} w-10 text-right`}>{b.passRate}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right"><ChevronRight className="h-4 w-4 text-muted-foreground/50 inline" /></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ============ Individual Tab ============ */}
          <TabsContent value="individual" className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <Select value={selectedCountry} onValueChange={(v) => { setSelectedCountry(v); setSelectedBranch("all"); }}>
                <SelectTrigger className="w-full sm:w-44 h-9 rounded-xl">
                  <div className="flex items-center gap-1.5">
                    <Globe2 className="h-3.5 w-3.5" />
                    <SelectValue placeholder={isEn ? "Country" : "지역"} />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isEn ? "All countries" : "전체 지역"}</SelectItem>
                  {Array.from(new Set(branches.map((b: any) => b.country_code).filter(Boolean))).map((cc: any) => {
                    const lbl = COUNTRY_LABELS[cc];
                    return <SelectItem key={cc} value={cc}>{lbl ? `${lbl.flag} ${isEn ? lbl.en : lbl.ko}` : cc}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-full sm:w-56 h-9 rounded-xl">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    <SelectValue placeholder={isEn ? "Branch" : "지점"} />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isEn ? "All branches" : "전체 지점"}</SelectItem>
                  {branches
                    .filter((b: any) => selectedCountry === "all" || b.country_code === selectedCountry)
                    .map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{isEn && b.name_en ? b.name_en : b.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={isEn ? "Search by name, email, branch…" : "이름, 이메일, 지점 검색…"}
                  className="pl-8 h-9 rounded-xl"
                />
              </div>
            </div>

            {individualStats.length === 0 ? (
              <div className="stat-card !p-8 text-center text-sm text-muted-foreground">
                {isEn ? "No learners match this filter." : "조건에 맞는 학습자가 없습니다."}
              </div>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="sm:hidden space-y-2">
                  {individualStats.map((u) => (
                    <article
                      key={u.userId}
                      onClick={() => navigate(`/admin/users/${u.userId}`)}
                      onKeyDown={(e) => { if (e.key === "Enter") navigate(`/admin/users/${u.userId}`); }}
                      tabIndex={0}
                      role="button"
                      className="rounded-xl border border-border bg-background p-3 cursor-pointer hover:bg-accent/30 focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-semibold text-foreground truncate inline-flex items-center gap-1">
                            {u.name} <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
                          </h4>
                          <p className="text-[11px] text-muted-foreground truncate">{u.branchName}{u.position ? ` · ${u.position}` : ""}</p>
                        </div>
                        <Badge variant="outline" className={`text-[10px] ${passRateColor(u.passRate)}`}>{u.passRate}%</Badge>
                      </div>
                      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                        <div><dt className="text-muted-foreground">{isEn ? "Attempts" : "응시"}</dt><dd className="font-medium">{u.attempts}</dd></div>
                        <div><dt className="text-muted-foreground">{isEn ? "Avg" : "평균"}</dt><dd className="font-medium">{u.avgScore}</dd></div>
                        <div><dt className="text-muted-foreground">{isEn ? "Best" : "최고"}</dt><dd className="font-medium inline-flex items-center gap-0.5"><Award className="h-3 w-3 text-chart-3" />{u.bestScore}</dd></div>
                      </dl>
                    </article>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block stat-card !p-0 overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{isEn ? "Learner" : "학습자"}</TableHead>
                          <TableHead className="hidden md:table-cell">{isEn ? "Branch" : "지점"}</TableHead>
                          <TableHead className="text-center">{isEn ? "Attempts" : "응시"}</TableHead>
                          <TableHead className="text-center">{isEn ? "Passed" : "합격"}</TableHead>
                          <TableHead className="text-center">{isEn ? "Avg" : "평균"}</TableHead>
                          <TableHead className="text-center">{isEn ? "Best" : "최고"}</TableHead>
                          <TableHead className="text-center min-w-[140px]">{isEn ? "Pass rate" : "합격률"}</TableHead>
                          <TableHead className="hidden lg:table-cell text-xs text-muted-foreground">{isEn ? "Last attempt" : "최근 응시"}</TableHead>
                          <TableHead className="text-right w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {individualStats.map((u) => (
                          <TableRow
                            key={u.userId}
                            className="cursor-pointer hover:bg-accent/30"
                            onClick={() => navigate(`/admin/users/${u.userId}`)}
                          >
                            <TableCell>
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-medium text-foreground truncate">{u.name}</span>
                                {u.email && <span className="text-[10px] text-muted-foreground truncate">{u.email}</span>}
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{u.branchName}</TableCell>
                            <TableCell className="text-center text-sm">{u.attempts}</TableCell>
                            <TableCell className="text-center">
                              <span className="inline-flex items-center gap-1 text-sm">
                                <CheckCircle2 className="h-3.5 w-3.5 text-chart-3" />{u.passed}
                              </span>
                            </TableCell>
                            <TableCell className="text-center text-sm">{u.avgScore}</TableCell>
                            <TableCell className="text-center">
                              <span className="inline-flex items-center gap-0.5 text-sm font-semibold text-foreground">
                                <Award className="h-3 w-3 text-chart-3" />{u.bestScore}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Progress value={u.passRate} className="h-1.5 w-16" />
                                <span className={`text-xs font-semibold ${passRateColor(u.passRate)} w-10 text-right`}>{u.passRate}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-[11px] text-muted-foreground">
                              {u.lastAt ? format(new Date(u.lastAt), "yyyy-MM-dd", { locale: isEn ? enUS : ko }) : "-"}
                            </TableCell>
                            <TableCell className="text-right"><ChevronRight className="h-4 w-4 text-muted-foreground/50 inline" /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminAssessmentsStatus;
