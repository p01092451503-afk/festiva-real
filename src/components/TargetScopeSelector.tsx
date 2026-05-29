import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";

/** Multi-target value used by both announcements and board posts. */
export interface TargetValue {
  target_country_codes: string[];
  target_branch_ids: string[];
  target_course_ids: string[];
}

export const EMPTY_TARGET: TargetValue = {
  target_country_codes: [],
  target_branch_ids: [],
  target_course_ids: [],
};

const COUNTRY_NAMES_KO: Record<string, string> = {
  KR: "대한민국", US: "미국", JP: "일본", CN: "중국", VN: "베트남",
  TH: "태국", ID: "인도네시아", PH: "필리핀", MY: "말레이시아", SG: "싱가포르",
  IN: "인도", TW: "대만", HK: "홍콩", AU: "호주", NZ: "뉴질랜드",
  GB: "영국", DE: "독일", FR: "프랑스", IT: "이탈리아", ES: "스페인",
  CA: "캐나다", MX: "멕시코", BR: "브라질", RU: "러시아",
  AE: "아랍에미리트", SA: "사우디아라비아",
};

export const getCountryName = (code: string | null | undefined): string => {
  if (!code) return "";
  return COUNTRY_NAMES_KO[code.toUpperCase()] || code;
};

interface Props {
  value: TargetValue;
  onChange: (next: TargetValue) => void;
}

const TargetScopeSelector = ({ value, onChange }: Props) => {
  const { t } = useTranslation();
  const [countryInput, setCountryInput] = useState("");

  const { data: branches = [] } = useQuery({
    queryKey: ["target-branches"],
    queryFn: async () => {
      const { data } = await supabase
        .from("departments")
        .select("id, name, country_code")
        .eq("entity_type", "branch")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["target-courses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("id, title")
        .eq("status", "published")
        .order("title");
      return data || [];
    },
  });

  const branchMap = useMemo(
    () => Object.fromEntries(branches.map((b) => [b.id, b])),
    [branches]
  );
  const courseMap = useMemo(
    () => Object.fromEntries(courses.map((c) => [c.id, c])),
    [courses]
  );

  const hasAny =
    value.target_country_codes.length > 0 ||
    value.target_branch_ids.length > 0 ||
    value.target_course_ids.length > 0;

  const addCountry = () => {
    const code = countryInput.trim().toUpperCase();
    if (!code) return;
    if (value.target_country_codes.includes(code)) {
      setCountryInput("");
      return;
    }
    onChange({ ...value, target_country_codes: [...value.target_country_codes, code] });
    setCountryInput("");
  };

  const removeCountry = (code: string) =>
    onChange({
      ...value,
      target_country_codes: value.target_country_codes.filter((c) => c !== code),
    });

  const addBranch = (id: string) => {
    if (!id || value.target_branch_ids.includes(id)) return;
    onChange({ ...value, target_branch_ids: [...value.target_branch_ids, id] });
  };

  const removeBranch = (id: string) =>
    onChange({
      ...value,
      target_branch_ids: value.target_branch_ids.filter((b) => b !== id),
    });

  const addCourse = (id: string) => {
    if (!id || value.target_course_ids.includes(id)) return;
    onChange({ ...value, target_course_ids: [...value.target_course_ids, id] });
  };

  const removeCourse = (id: string) =>
    onChange({
      ...value,
      target_course_ids: value.target_course_ids.filter((c) => c !== id),
    });

  const branchOptions = branches.filter((b) => !value.target_branch_ids.includes(b.id));
  const courseOptions = courses.filter((c) => !value.target_course_ids.includes(c.id));

  return (
    <div className="rounded-lg border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {t("targetScope.title", "대상 설정")}
        </h3>
        {!hasAny && (
          <span className="text-xs text-destructive">
            {t("targetScope.requiredHint", "비워두면 전체 사용자에게 노출됩니다")}
          </span>
        )}
      </div>

      {/* 국가 */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          {t("targetScope.country", "국가")} ({t("targetScope.countryHint", "예: KR, JP, US")})
        </Label>
        <div className="flex gap-2">
          <Input
            value={countryInput}
            onChange={(e) => setCountryInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCountry();
              }
            }}
            placeholder={t("targetScope.countryPlaceholder", "국가 코드 입력")}
            className="h-9 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={addCountry}
            aria-label={t("targetScope.addCountry", "국가 추가")}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {value.target_country_codes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {value.target_country_codes.map((code) => (
              <Badge key={code} variant="secondary" className="gap-1 pr-1">
                {getCountryName(code)} ({code})
                <button
                  type="button"
                  onClick={() => removeCountry(code)}
                  className="ml-0.5 rounded-sm hover:bg-muted-foreground/10"
                  aria-label={t("common.remove", "제거")}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* 지점 */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          {t("targetScope.branch", "지점")}
        </Label>
        <Select value="" onValueChange={addBranch}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder={t("targetScope.selectBranch", "지점 선택")} />
          </SelectTrigger>
          <SelectContent>
            {branchOptions.length > 0 ? (
              branchOptions.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                  {b.country_code ? ` (${b.country_code})` : ""}
                </SelectItem>
              ))
            ) : (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {t("targetScope.allBranchesAdded", "선택할 수 있는 지점이 없습니다")}
              </div>
            )}
          </SelectContent>
        </Select>
        {value.target_branch_ids.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {value.target_branch_ids.map((id) => (
              <Badge key={id} variant="secondary" className="gap-1 pr-1">
                {branchMap[id]?.name || id}
                <button
                  type="button"
                  onClick={() => removeBranch(id)}
                  className="ml-0.5 rounded-sm hover:bg-muted-foreground/10"
                  aria-label={t("common.remove", "제거")}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* 강의 */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          {t("targetScope.course", "강의")}
        </Label>
        <Select value="" onValueChange={addCourse}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder={t("targetScope.selectCourse", "강의 선택")} />
          </SelectTrigger>
          <SelectContent>
            {courseOptions.length > 0 ? (
              courseOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
              ))
            ) : (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {t("targetScope.allCoursesAdded", "선택할 수 있는 강의가 없습니다")}
              </div>
            )}
          </SelectContent>
        </Select>
        {value.target_course_ids.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {value.target_course_ids.map((id) => (
              <Badge key={id} variant="secondary" className="gap-1 pr-1">
                {courseMap[id]?.title || id}
                <button
                  type="button"
                  onClick={() => removeCourse(id)}
                  className="ml-0.5 rounded-sm hover:bg-muted-foreground/10"
                  aria-label={t("common.remove", "제거")}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TargetScopeSelector;

/** Pretty label for the target columns on a list row. */
export const formatTargetLabel = (
  ctx: {
    countries?: string[] | null;
    branchNames?: string[] | null;
    courseTitles?: string[] | null;
  }
): string => {
  const parts: string[] = [];
  if (ctx.countries?.length) {
    parts.push(`🌐 ${ctx.countries.map((c) => getCountryName(c)).join(", ")}`);
  }
  if (ctx.branchNames?.length) {
    parts.push(`🏢 ${ctx.branchNames.join(", ")}`);
  }
  if (ctx.courseTitles?.length) {
    parts.push(`📚 ${ctx.courseTitles.join(", ")}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "전체";
};
