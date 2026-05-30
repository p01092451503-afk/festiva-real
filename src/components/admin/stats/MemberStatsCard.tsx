import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

const COLORS = [
  "hsl(221 83% 53%)",
  "hsl(160 60% 45%)",
  "hsl(35 92% 55%)",
  "hsl(340 75% 55%)",
  "hsl(262 70% 60%)",
  "hsl(190 75% 45%)",
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

  const roleLabels: Record<string, string> = {
    student: t("roles.studentLabel"),
    teacher: t("roles.teacherLabel"),
    admin: t("roles.adminLabel"),
    super_admin: t("roles.superAdminLabel"),
  };

  const roleData = roleCounts
    .map((r) => ({ name: roleLabels[r.role] || r.role, value: r.value }))
    .sort((a, b) => b.value - a.value);

  const total = roleData.reduce((s, r) => s + r.value, 0) || 1;

  return (
    <Card>
      <CardHeader className="pb-2 px-3 sm:px-6">
        <CardTitle className="text-sm font-medium">{t("stats.memberDist")}</CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 pb-4">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-xs text-muted-foreground font-medium">{t("stats.byRole")}</p>
          <p className="text-xs text-muted-foreground">
            {t("common.total")} <span className="font-semibold text-foreground">{total}{t("common.people")}</span>
          </p>
        </div>

        {/* Stacked horizontal bar */}
        <div className="w-full h-3 rounded-full overflow-hidden flex bg-muted">
          {roleData.map((r, i) => (
            <div
              key={r.name}
              style={{
                width: `${(r.value / total) * 100}%`,
                backgroundColor: COLORS[i % COLORS.length],
              }}
              title={`${r.name} ${r.value}${t("common.people")}`}
            />
          ))}
        </div>

        {/* Legend rows */}
        <ul className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
          {roleData.map((r, i) => {
            const pct = ((r.value / total) * 100).toFixed(0);
            return (
              <li key={r.name} className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground truncate">{r.name}</div>
                  <div className="text-sm font-semibold">
                    {r.value}
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      ({pct}%)
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
};

export default MemberStatsCard;
