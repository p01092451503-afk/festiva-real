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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, X, ChevronsUpDown } from "lucide-react";
import { getCountryName } from "@/components/TargetScopeSelector";

/** Targeting value used by learning_tracks. */
export interface TrackTargetValue {
  target_scope: string; // 'all' | 'targeted'
  target_country_codes: string[];
  target_branch_ids: string[];
  target_user_ids: string[];
}

export const EMPTY_TRACK_TARGET: TrackTargetValue = {
  target_scope: "all",
  target_country_codes: [],
  target_branch_ids: [],
  target_user_ids: [],
};

interface Props {
  value: TrackTargetValue;
  onChange: (next: TrackTargetValue) => void;
}

const TrackTargetSelector = ({ value, onChange }: Props) => {
  const { t } = useTranslation();
  const [countryInput, setCountryInput] = useState("");
  const [userPickerOpen, setUserPickerOpen] = useState(false);

  const { data: branches = [] } = useQuery({
    queryKey: ["track-target-branches"],
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

  const { data: users = [] } = useQuery({
    queryKey: ["track-target-users"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, department_id")
        .order("full_name");
      return data || [];
    },
  });

  const branchMap = useMemo(
    () => Object.fromEntries(branches.map((b) => [b.id, b])),
    [branches]
  );
  const userMap = useMemo(
    () => Object.fromEntries(users.map((u) => [u.user_id, u])),
    [users]
  );

  const isTargeted = value.target_scope === "targeted";

  const setScope = (scope: string) => {
    if (scope === "all") {
      onChange({
        target_scope: "all",
        target_country_codes: [],
        target_branch_ids: [],
        target_user_ids: [],
      });
    } else {
      onChange({ ...value, target_scope: "targeted" });
    }
  };

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

  const toggleUser = (id: string) => {
    if (value.target_user_ids.includes(id)) {
      onChange({
        ...value,
        target_user_ids: value.target_user_ids.filter((u) => u !== id),
      });
    } else {
      onChange({ ...value, target_user_ids: [...value.target_user_ids, id] });
    }
  };
  const removeUser = (id: string) =>
    onChange({
      ...value,
      target_user_ids: value.target_user_ids.filter((u) => u !== id),
    });

  const branchOptions = branches.filter((b) => !value.target_branch_ids.includes(b.id));

  return (
    <div className="rounded-lg border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {t("trackTarget.title", "트랙 배정 대상")}
        </h3>
      </div>

      {/* Scope toggle */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={!isTargeted ? "default" : "outline"}
          onClick={() => setScope("all")}
        >
          {t("trackTarget.scopeAll", "전체 학습자")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={isTargeted ? "default" : "outline"}
          onClick={() => setScope("targeted")}
        >
          {t("trackTarget.scopeTargeted", "특정 대상 지정")}
        </Button>
      </div>

      {isTargeted && (
        <>
          {/* Country */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {t("trackTarget.country", "국가")}{" "}
              ({t("trackTarget.countryHint", "예: KR, JP, US")})
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
                placeholder={t("trackTarget.countryPlaceholder", "국가 코드 입력")}
                className="h-9 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={addCountry}
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
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Branch */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {t("trackTarget.branch", "지점")}
            </Label>
            <Select value="" onValueChange={addBranch}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder={t("trackTarget.selectBranch", "지점 선택")} />
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
                    {t("trackTarget.allBranchesAdded", "선택할 수 있는 지점이 없습니다")}
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
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Users */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {t("trackTarget.users", "회원")}
            </Label>
            <Popover open={userPickerOpen} onOpenChange={setUserPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  className="w-full h-9 justify-between text-sm font-normal"
                >
                  {t("trackTarget.selectUsers", "회원 검색 및 선택")}
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder={t("trackTarget.searchUsers", "이름 또는 이메일 검색")} />
                  <CommandList>
                    <CommandEmpty>
                      {t("trackTarget.noUsersFound", "검색 결과가 없습니다")}
                    </CommandEmpty>
                    <CommandGroup>
                      {users.map((u) => {
                        const checked = value.target_user_ids.includes(u.user_id);
                        return (
                          <CommandItem
                            key={u.user_id}
                            value={`${u.full_name || ""} ${u.email || ""}`}
                            onSelect={() => toggleUser(u.user_id)}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              readOnly
                              className="mr-2"
                            />
                            <div className="flex flex-col">
                              <span className="text-sm">{u.full_name || u.email}</span>
                              {u.email && (
                                <span className="text-xs text-muted-foreground">{u.email}</span>
                              )}
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {value.target_user_ids.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {value.target_user_ids.map((id) => (
                  <Badge key={id} variant="secondary" className="gap-1 pr-1">
                    {userMap[id]?.full_name || userMap[id]?.email || id.slice(0, 8)}
                    <button
                      type="button"
                      onClick={() => removeUser(id)}
                      className="ml-0.5 rounded-sm hover:bg-muted-foreground/10"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {value.target_country_codes.length === 0 &&
            value.target_branch_ids.length === 0 &&
            value.target_user_ids.length === 0 && (
              <p className="text-xs text-destructive">
                {t(
                  "trackTarget.requiredHint",
                  "최소 한 가지 대상(국가/지점/회원)을 선택하세요. 비어두면 누구에게도 노출되지 않습니다."
                )}
              </p>
            )}
        </>
      )}
    </div>
  );
};

export default TrackTargetSelector;