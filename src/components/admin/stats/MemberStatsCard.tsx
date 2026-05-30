import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import {
  sharedTooltipContentStyle,
  sharedTooltipItemStyle,
  sharedTooltipLabelStyle,
} from "@/components/charts/tooltipStyles";

// Distinct hues so each segment is visually separated.
// HSL values used directly to avoid undefined design tokens.
const COLORS = [
  "hsl(221 83% 53%)", // blue
  "hsl(160 60% 45%)", // teal/green
  "hsl(35 92% 55%)",  // amber
  "hsl(340 75% 55%)", // pink/red
  "hsl(262 70% 60%)", // violet
  "hsl(190 75% 45%)", // cyan
];

const MemberStatsCard = () => {
  const { t } = useTranslation();

  const { data: roleCounts = [] } = useQuery({
    queryKey: ["stat-role-distribution"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach((r: any) => {
        counts[r.role] = (counts[r.role] || 0) + 1;
      });
      return Object.entries(counts).map(([role, count]) => ({
        role,
        value: count,
      }));
    },
  });

  const { data: deptCounts = [] } = useQuery({
    queryKey: ["stat-dept-distribution"],
    queryFn: async () => {
      const { data: profiles, error: pErr } = await supabase.from("profiles").select("department_id");
      if (pErr) throw pErr;
      const { data: depts, error: dErr } = await supabase.from("departments").select("id, name").eq("is_active", true);
      if (dErr) throw dErr;
      const deptMap = new Map(depts.map((d: any) => [d.id, d.name]));
      const counts: Record<string, number> = {};
      profiles.forEach((p: any) => {
        const name = p.department_id ? deptMap.get(p.department_id) || t("stats.otherLabel") : t("stats.unassigned");
        counts[name] = (counts[name] || 0) + 1;
      });
      return Object.entries(counts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);
    },
  });

  const roleLabels: Record<string, string> = {
    student: t("roles.studentLabel"),
    teacher: t("roles.teacherLabel"),
    admin: t("roles.adminLabel"),
    super_admin: t("roles.superAdminLabel"),
  };

  const roleData = roleCounts.map((r) => ({
    name: roleLabels[r.role] || r.role,
    value: r.value,
  }));

  return (
    <Card>
      <CardHeader className="pb-2 px-3 sm:px-6">
        <CardTitle className="text-sm font-medium">{t("stats.memberDist")}</CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-medium">{t("stats.byRole")}</p>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={roleData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={36} paddingAngle={2}>
                  {roleData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value}${t("common.people")}`, ""]}
                  contentStyle={sharedTooltipContentStyle}
                  labelStyle={sharedTooltipLabelStyle}
                  itemStyle={sharedTooltipItemStyle}
                  cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                  separator=""
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 justify-center">
            {roleData.map((r, i) => (
              <span key={r.name} className="text-[10px] text-muted-foreground flex items-center gap-1">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {r.name} {r.value}{t("common.people")}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MemberStatsCard;
