import { ToggleRight, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { useFeatureModules, useUpdateFeatureModule } from "@/hooks/useFeatureModules";
import { toast } from "sonner";

/**
 * 산학프로젝트 기능 그룹의 노출 ON/OFF 전용 페이지.
 * 시스템 설정 > 기능 모듈 진입점으로 사용됩니다.
 */
export default function AdminModuleSettings() {
  const { modules, isLoading } = useFeatureModules();
  const update = useUpdateFeatureModule();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="flex items-start gap-3">
          <ToggleRight className="h-6 w-6 text-foreground mt-0.5" />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">기능 모듈</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              산학프로젝트 기능 그룹을 사이트 전체에서 보이게 하거나 숨길 수 있습니다.
            </p>
          </div>
        </header>

        <section className="stat-card !p-0 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <ul>
              {modules.map((m) => (
                <li
                  key={m.module_key}
                  className="flex items-start justify-between gap-4 px-5 py-4 border-b-2 border-border/80 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{m.label_ko}</p>
                    {m.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                    )}
                  </div>
                  <Switch
                    checked={m.enabled}
                    disabled={update.isPending}
                    onCheckedChange={(checked) => {
                      update.mutate(
                        { key: m.module_key, enabled: checked },
                        {
                          onSuccess: () =>
                            toast.success(
                              `${m.label_ko} ${checked ? "사용" : "숨김"}으로 변경되었습니다.`
                            ),
                          onError: (e: any) =>
                            toast.error(e?.message || "변경 실패"),
                        }
                      );
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-[11px] text-muted-foreground">
          변경 사항은 사이드바와 라우트에 즉시 반영됩니다. 비활성 모듈은 학생/관리자 모두에게 노출되지 않습니다.
        </p>
      </div>
    </DashboardLayout>
  );
}