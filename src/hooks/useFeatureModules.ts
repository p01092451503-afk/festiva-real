import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FeatureModuleKey =
  | "beneficiaries"
  | "programs"
  | "projects"
  | "evidence"
  | "surveys_ops"
  | "certificates_ops"
  | "stats_ops"
  | "closed_lms";

export interface FeatureModule {
  module_key: FeatureModuleKey;
  label_ko: string;
  label_en: string;
  description: string | null;
  enabled: boolean;
  sort_order: number;
}

/**
 * 산학프로젝트 기능 모듈의 ON/OFF 상태를 조회합니다.
 * - 사이드바, 라우트, 진입 버튼이 이 값을 보고 노출 여부를 결정합니다.
 * - 관리자 시스템 설정에서 토글하면 5분 캐시 만료 후 자동 반영.
 */
export function useFeatureModules() {
  const query = useQuery({
    queryKey: ["feature-modules"],
    queryFn: async (): Promise<FeatureModule[]> => {
      const { data, error } = await supabase
        .from("feature_modules")
        .select("module_key, label_ko, label_en, description, enabled, sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data as FeatureModule[]) || [];
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: true,
  });

  const map = new Map<string, FeatureModule>();
  (query.data || []).forEach((m) => map.set(m.module_key, m));

  const isEnabled = (key: FeatureModuleKey): boolean => {
    // 데이터가 아직 로드되지 않은 경우 false 반환(깜빡임 방지)
    if (!query.data) return false;
    return map.get(key)?.enabled ?? false;
  };

  return {
    modules: query.data ?? [],
    isEnabled,
    isLoading: query.isLoading,
  };
}

export function useUpdateFeatureModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, enabled }: { key: FeatureModuleKey; enabled: boolean }) => {
      const { error, data } = await supabase
        .from("feature_modules")
        .update({ enabled })
        .eq("module_key", key)
        .select("module_key, enabled");
      if (error) throw error;
      if (!data || data.length === 0) {
        // RLS가 행을 막아 0건이 업데이트된 경우 — 권한 부족
        throw new Error("권한이 없거나 변경된 항목이 없습니다.");
      }
    },
    onMutate: async ({ key, enabled }) => {
      // 낙관적 업데이트 — 스위치/사이드바가 즉시 반영되도록
      await qc.cancelQueries({ queryKey: ["feature-modules"] });
      const prev = qc.getQueryData<FeatureModule[]>(["feature-modules"]);
      if (prev) {
        qc.setQueryData<FeatureModule[]>(
          ["feature-modules"],
          prev.map((m) => (m.module_key === key ? { ...m, enabled } : m))
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["feature-modules"], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["feature-modules"] });
    },
  });
}