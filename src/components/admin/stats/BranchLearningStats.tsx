import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";
import ChartLoadingState from "@/components/charts/ChartLoadingState";

const BranchLearningStats = () => {
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  const { data: branches = [], isLoading: loadingBranches } = useQuery({
    queryKey: ["stat-branches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, name_en")
        .eq("is_active", true)
        .eq("entity_type", "branch")
        .order("display_order")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ["stat-branch-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, department_id");
      if (error) throw error;
      return data;
    },
  });

  const { data: enrollments = [], isLoading: loadingEnrollments } = useQuery({
    queryKey: ["stat-branch-enrollments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollments").select("user_id, progress, completed_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: contentProgress = [], isLoading: loadingContent } = useQuery({
    queryKey: ["stat-branch-content-progress"],
    queryFn: async () => {
      const { data, error } = await supabase.from("content_progress").select("user_id, completed").eq("completed", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: attempts = [], isLoading: loadingAttempts } = useQuery({
    queryKey: ["stat-branch-quiz-attempts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_attempts")
        .select("user_id, score, passed, completed_at")
        .not("completed_at", "is", null);
      if (error) throw error;
      return data;
    },
  });

  const isLoading = loadingBranches || loadingProfiles || loadingEnrollments || loadingContent || loadingAttempts;

  const userBranchMap = new Map<string, string>();
  profiles.forEach((p: any) => {
    if (p.department_id) userBranchMap.set(p.user_id, p.department_id);
  });

  const userContentMap = new Map<string, number>();
  contentProgress.forEach((cp: any) => {
    userContentMap.set(cp.user_id, (userContentMap.get(cp.user_id) || 0) + 1);
  });

  // user_id -> { sumScore, count, passCount }
  const userQuizMap = new Map<string, { sum: number; cnt: number; pass: number }>();
  attempts.forEach((a: any) => {
    if (a.score == null) return;
    const cur = userQuizMap.get(a.user_id) || { sum: 0, cnt: 0, pass: 0 };
    cur.sum += Number(a.score) || 0;
    cur.cnt += 1;
    if (a.passed) cur.pass += 1;
    userQuizMap.set(a.user_id, cur);
  });

  const completionRateLabel = t("stats.completionRateChart");
  const avgProgressLabel = t("stats.avgProgressChart");

  const branchStats = branches.map((b: any) => {
    const branchUserIds = profiles.filter((p: any) => p.department_id === b.id).map((p: any) => p.user_id);
    const userSet = new Set(branchUserIds);
    const branchEnrollments = enrollments.filter((e: any) => userSet.has(e.user_id));
    const totalEnroll = branchEnrollments.length;
    const completed = branchEnrollments.filter((e: any) => e.completed_at).length;
    const avgProgress = totalEnroll > 0
      ? Math.round(branchEnrollments.reduce((s: number, e: any) => s + (Number(e.progress) || 0), 0) / totalEnroll)
      : 0;
    const completionRate = totalEnroll > 0 ? Math.round((completed / totalEnroll) * 100) : 0;
    const totalContentCompletions = branchUserIds.reduce((s: number, uid: string) => s + (userContentMap.get(uid) || 0), 0);

    let qSum = 0, qCnt = 0, qPass = 0;
    branchUserIds.forEach((uid: string) => {
      const q = userQuizMap.get(uid);
      if (q) { qSum += q.sum; qCnt += q.cnt; qPass += q.pass; }
    });
    const avgQuiz = qCnt > 0 ? Math.round(qSum / qCnt) : 0;
    const quizPassRate = qCnt > 0 ? Math.round((qPass / qCnt) * 100) : 0;

    return {
      name: b.name,
      members: userSet.size,
      enrollments: totalEnroll,
      completed,
      avgProgress,
      completionRate,
      contentCompletions: totalContentCompletions,
      avgQuiz,
      quizPassRate,
      quizAttempts: qCnt,
    };
  }).filter((b) => b.members > 0);

  const chartData = branchStats.map((b) => ({
    name: b.name.length > 6 ? b.name.slice(0, 6) + "…" : b.name,
    [completionRateLabel]: b.completionRate,
    [avgProgressLabel]: b.avgProgress,
  }));

  // Refined chart palette — softer, distinguishable, brand-aligned (HSL semantic-friendly)
  const COLOR_COMPLETION = "hsl(217 91% 60%)"; // indigo-blue
  const COLOR_PROGRESS = "hsl(173 70% 42%)";   // teal

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-border/70 bg-card/95 backdrop-blur shadow-lg px-3 py-2 min-w-[150px]">
        <p className="text-xs font-semibold text-foreground border-b border-border/50 pb-1.5 mb-1.5">{label}</p>
        <div className="space-y-1">
          {payload.map((p: any) => (
            <div key={p.dataKey} className="flex items-center justify-between gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ backgroundColor: p.color }}
                />
                {p.name}
              </span>
              <span className="font-semibold text-foreground tabular-nums">{p.value}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2 px-3 sm:px-6">
        <CardTitle className="text-sm font-medium">{t("stats.branchLearning")}</CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 space-y-5">
        {isLoading ? (
          <ChartLoadingState />
        ) : branchStats.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{t("common.noData")}</p>
        ) : (
          <>
            <div className="h-[220px] sm:h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={isMobile ? { top: 8, right: 4, left: 0, bottom: 0 } : { top: 12, right: 8, left: 0, bottom: 0 }}
                  barCategoryGap="35%"
                  barGap={4}
                >
                  <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickMargin={8}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    width={32}
                    hide={isMobile}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.4)", radius: 4 }}
                    content={<CustomTooltip />}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={7}
                    wrapperStyle={{ fontSize: 10, paddingTop: 6 }}
                  />
                  <Bar
                    dataKey={completionRateLabel}
                    fill={COLOR_COMPLETION}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={14}
                  />
                  <Bar
                    dataKey={avgProgressLabel}
                    fill={COLOR_PROGRESS}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={14}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="sm:hidden space-y-3">
              {branchStats.map((b) => (
                <div key={b.name} className="rounded-xl border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{b.name}</span>
                    <span className="text-xs text-muted-foreground">{b.members}{t("common.people")}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">{t("stats.enrollCount")}</p>
                      <p className="text-sm font-bold text-foreground">{b.enrollments}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("stats.completionCount2")}</p>
                      <p className="text-sm font-bold text-foreground">{b.completed}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("stats.lessonCompletions")}</p>
                      <p className="text-sm font-bold text-foreground">{b.contentCompletions}</p>
                    </div>
                  </div>
                  {b.quizAttempts > 0 && (
                    <div className="grid grid-cols-2 gap-2 text-center pt-2 border-t border-border">
                      <div>
                        <p className="text-xs text-muted-foreground">{t("stats.avgQuizScore", "Avg Quiz")}</p>
                        <p className="text-sm font-bold text-foreground">{b.avgQuiz}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t("stats.quizPassRate", "Pass Rate")}</p>
                        <p className="text-sm font-bold text-foreground">{b.quizPassRate}%</p>
                      </div>
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{t("stats.avgProgressRate")}</span>
                      <span className="font-medium">{b.avgProgress}%</span>
                    </div>
                    <Progress value={b.avgProgress} className="h-1.5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{t("stats.completionRateValue")}</span>
                      <span className="font-medium">{b.completionRate}%</span>
                    </div>
                    <Progress value={b.completionRate} className="h-1.5" />
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("branches.branchName")}</TableHead>
                    <TableHead className="text-right">{t("branches.staffCount")}</TableHead>
                    <TableHead className="text-right">{t("stats.enrollCount")}</TableHead>
                    <TableHead className="text-right">{t("stats.completionCount2")}</TableHead>
                    <TableHead className="text-right">{t("stats.lessonCompletions")}</TableHead>
                    <TableHead className="text-right">{t("stats.avgProgressRate")}</TableHead>
                    <TableHead className="text-right">{t("stats.avgQuizScore", "Avg Quiz")}</TableHead>
                    <TableHead className="text-right">{t("stats.quizPassRate", "Pass Rate")}</TableHead>
                    <TableHead className="text-right w-[140px]">{t("stats.completionRateValue")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branchStats.map((b) => (
                    <TableRow key={b.name}>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell className="text-right">{b.members}{t("common.people")}</TableCell>
                      <TableCell className="text-right">{b.enrollments}</TableCell>
                      <TableCell className="text-right">{b.completed}</TableCell>
                      <TableCell className="text-right">{b.contentCompletions}</TableCell>
                      <TableCell className="text-right">{b.avgProgress}%</TableCell>
                      <TableCell className="text-right">
                        {b.quizAttempts > 0 ? `${b.avgQuiz}%` : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {b.quizAttempts > 0 ? `${b.quizPassRate}%` : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Progress value={b.completionRate} className="h-1.5 w-16" />
                          <span className="text-xs text-muted-foreground w-10 text-right">{b.completionRate}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default BranchLearningStats;
