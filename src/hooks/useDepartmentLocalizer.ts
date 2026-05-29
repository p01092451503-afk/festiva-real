import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveLanguage } from "@/hooks/useI18nMaps";

/**
 * 모든 departments(지점/팀)를 캐싱하고 id 또는 이름으로 영문(name_en) 매핑을 제공한다.
 *
 * 한국 회원 정보를 영문 UI에서 표시할 때 다음 두 경우 모두 자동 변환:
 *  - department_id 기반 (정식 매핑)
 *  - team_name 같이 free-text 필드라도 departments.name 과 일치하면 변환
 *
 * 영어가 아니거나 name_en 이 비어 있으면 원문(KO)을 그대로 반환한다.
 */
export const useDepartmentLocalizer = () => {
  const { isEn } = useActiveLanguage();

  const { data = [] } = useQuery({
    queryKey: ["departments-i18n-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, name_en")
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60_000,
  });

  const { byId, byName } = useMemo(() => {
    const byId = new Map<string, string>();
    const byName = new Map<string, string>();
    for (const d of data as Array<{ id: string; name: string; name_en: string | null }>) {
      const en = d.name_en?.trim();
      if (en) {
        byId.set(d.id, en);
        byName.set(d.name, en);
      }
    }
    return { byId, byName };
  }, [data]);

  /** id 우선, 없으면 fallback 한글 이름을 반환 */
  const localizeById = (id: string | null | undefined, fallback?: string | null): string => {
    if (!isEn) return fallback ?? "";
    if (id && byId.has(id)) return byId.get(id)!;
    return fallback ?? "";
  };

  /** 자유 텍스트(team_name 등)에 대해 departments.name 과 매칭되면 EN, 아니면 원문 그대로 */
  const localizeByName = (name: string | null | undefined): string => {
    if (!name) return "";
    if (!isEn) return name;
    return byName.get(name) || name;
  };

  return { isEn, localizeById, localizeByName };
};