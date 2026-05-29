import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, PieChart as PieIcon, Building2 } from "lucide-react";

interface Props {
  trend: { date: string; enrolled: number; completed: number }[];
  distribution: { label: string; count: number }[];
  deptStats: { id: string; name: string; staff: number; avgProgress: number; completed: number; total: number }[];
}

/**
 * Visual analytics for the branch admin stats page.
 * Lazy-loaded to keep the recharts vendor chunk off the main page bundle.
 */
const BranchStatsCharts = ({ trend, distribution, deptStats }: Props) => {
  const { t } = useTranslation();

  const tooltipStyle = {
    contentStyle: {
      background: "hsl(var(--background))",
      border: "1px solid hsl(var(--border))",
      borderRadius: 8,
      fontSize: 12,
    },
    labelStyle: { color: "hsl(var(--muted-foreground))", fontSize: 11 },
  };

  // Indigo gradient for distribution bars (light → deep) so 0% is light
  // and 100% is the strongest emphasis.
  const distColor = (idx: number) => {
    const total = distribution.length;
    const ratio = total > 1 ? idx / (total - 1) : 0;
    const lightness = 78 - ratio * 46;
    return `hsl(231, 70%, ${lightness}%)`;
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* Trend (spans 2) */}
      <Card className="xl:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            {t("branchAdminStats.charts.trend", "일별 신규 수강 / 완료 추이")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-enrolled" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(231, 70%, 55%)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(231, 70%, 55%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad-completed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(160, 60%, 42%)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(160, 60%, 42%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={28} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="enrolled"
                  name={t("branchAdminStats.charts.enrolled", "신규 수강")}
                  stroke="hsl(231, 70%, 55%)"
                  fill="url(#grad-enrolled)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  name={t("branchAdminStats.charts.completed", "완료")}
                  stroke="hsl(160, 60%, 42%)"
                  fill="url(#grad-completed)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Progress distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <PieIcon className="h-4 w-4 text-muted-foreground" />
            {t("branchAdminStats.charts.distribution", "진도 분포")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribution} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={28} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" name={t("common.people", "명")} radius={[4, 4, 0, 0]}>
                  {distribution.map((_, i) => (
                    <Cell key={i} fill={distColor(i)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Department comparison */}
      <Card className="xl:col-span-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            {t("branchAdminStats.charts.deptCompare", "팀별 평균 진도 비교")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {deptStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t("common.noData", "데이터가 없습니다.")}
            </p>
          ) : (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={deptStats.map((d) => ({
                    name: d.name,
                    avg: d.avgProgress,
                    staff: d.staff,
                  }))}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} />
                  <Tooltip {...tooltipStyle} formatter={(v: any, name: string) => [`${v}${name === "avg" ? "%" : ""}`, name === "avg" ? t("branchAdminStats.charts.avgProgress", "평균 진도") : t("common.people", "인원")]} />
                  <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                    {deptStats.map((_, i) => {
                      const total = deptStats.length;
                      const ratio = total > 1 ? i / (total - 1) : 0;
                      const lightness = 38 + ratio * 32; // top performers darker
                      return <Cell key={i} fill={`hsl(231, 70%, ${lightness}%)`} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BranchStatsCharts;