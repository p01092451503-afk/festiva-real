import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Building2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

const BranchTopWidget = () => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");

  const { data: branches = [] } = useQuery({
    queryKey: ["branch-top-widget-branches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, name_en, entity_type")
        .eq("is_active", true)
        .eq("entity_type", "branch");
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["branch-top-widget-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, department_id");
      if (error) throw error;
      return data;
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["branch-top-widget-enrollments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollments").select("user_id, progress, completed_at");
      if (error) throw error;
      return data;
    },
  });

  const stats = branches.map((b: any) => {
    const userIds = new Set(profiles.filter((p: any) => p.department_id === b.id).map((p: any) => p.user_id));
    const branchEnrollments = enrollments.filter((e: any) => userIds.has(e.user_id));
    const total = branchEnrollments.length;
    const completed = branchEnrollments.filter((e: any) => e.completed_at).length;
    const avg = total > 0 ? Math.round(branchEnrollments.reduce((s: number, e: any) => s + (Number(e.progress) || 0), 0) / total) : 0;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { id: b.id, name: isEn && b.name_en ? b.name_en : b.name, avg, rate, headcount: userIds.size };
  })
    .filter((s: any) => s.headcount > 0)
    .sort((a: any, b: any) => b.avg - a.avg)
    .slice(0, 5);

  return (
    <div className="stat-card !p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          {isEn ? "Branch Learning TOP 5" : "지점별 학습 TOP 5"}
        </h3>
        <Link to="/admin/traffic">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground">
            {t("common.viewAll")} <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </div>
      {stats.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">{t("common.noData")}</p>
      ) : (
        <div className="space-y-3">
          {stats.map((s: any, idx: number) => (
            <div key={s.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-foreground font-medium truncate flex-1">
                  <span className="text-xs text-muted-foreground mr-1.5">{idx + 1}.</span>
                  {s.name}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {s.headcount}{isEn ? "" : "명"} · {isEn ? "Done" : "수료"} {s.rate}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={s.avg} className="flex-1 h-1.5" />
                <span className="text-xs text-muted-foreground w-10 text-right">{s.avg}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BranchTopWidget;