import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { GraduationCap, Presentation, Building2, ShieldCheck } from "lucide-react";

export type StaffRole = "admin" | "teacher" | "student" | "super_admin" | "branch_admin";
export type SelectableRole = Exclude<StaffRole, "super_admin">;

export interface StaffEditDraft {
  userId: string;
  name: string;
  /** Multi-select roles. A user can simultaneously be e.g. student + branch_admin. */
  roles: SelectableRole[];
  departmentId: string;
  branchId: string;
  position: string;
  roleLocked: boolean;
}

interface DepartmentOption {
  id: string;
  name: string;
  name_en: string | null;
  parent_department_id?: string | null;
}

interface StaffEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: StaffEditDraft | null;
  onDraftChange: (draft: StaffEditDraft | null) => void;
  departments: DepartmentOption[];
  isEn: boolean;
  onSave: () => void;
  saving: boolean;
  teacherRoleEnabled?: boolean;
}

const StaffEditDialog = ({
  open,
  onOpenChange,
  draft,
  onDraftChange,
  departments,
  isEn,
  onSave,
  saving,
  teacherRoleEnabled = true,
}: StaffEditDialogProps) => {
  const { t } = useTranslation();

  const branches = useMemo(() => departments.filter((d) => !d.parent_department_id), [departments]);

  const teams = useMemo(() => {
    if (!draft?.branchId || draft.branchId === "__none__") return [];
    return departments.filter((d) => d.parent_department_id === draft.branchId);
  }, [departments, draft?.branchId]);

  if (!draft) return null;

  const getDeptLabel = (d: DepartmentOption) => (isEn ? d.name_en || d.name : d.name);

  const selectedBranch = branches.find((b) => b.id === draft.branchId);

  const toggleRole = (role: SelectableRole, on: boolean) => {
    const next = new Set(draft.roles);
    if (on) next.add(role);
    else next.delete(role);
    // Always ensure at least one role; default to student.
    if (next.size === 0) next.add("student");
    onDraftChange({ ...draft, roles: Array.from(next) as SelectableRole[] });
  };

  const ROLE_OPTIONS: {
    value: SelectableRole;
    label: string;
    desc: string;
    icon: React.ReactNode;
    show: boolean;
  }[] = [
    {
      value: "student",
      label: t("roles.studentLabel", "학습자"),
      desc: t("admin.roleDesc.student", "본인이 강의를 수강하고 평가를 응시합니다."),
      icon: <GraduationCap className="h-4 w-4" />,
      show: true,
    },
    {
      value: "teacher",
      label: t("roles.teacherLabel", "강사"),
      desc: t("admin.roleDesc.teacher", "강의를 개설하고 학습자를 지도합니다."),
      icon: <Presentation className="h-4 w-4" />,
      show: false,
    },
    {
      value: "branch_admin",
      label: t("roles.branchAdminLabel", "지점 중간관리자"),
      desc: t("admin.roleDesc.branchAdmin", "담당 지점의 회원과 학습 현황을 관리합니다."),
      icon: <Building2 className="h-4 w-4" />,
      show: false,
    },
    {
      value: "admin",
      label: t("roles.adminLabel", "관리자"),
      desc: t("admin.roleDesc.admin", "시스템 전반의 운영 권한을 갖습니다."),
      icon: <ShieldCheck className="h-4 w-4" />,
      show: true,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("admin.editStaff")}</DialogTitle>
          <DialogDescription>{t("admin.editStaffDesc", { name: draft.name })}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("branch.branchTitle")}</Label>
            <Select
              value={draft.branchId}
              onValueChange={(branchId) => onDraftChange({ ...draft, branchId, departmentId: "__none__" })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("branch.branchTitle")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">-</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {getDeptLabel(branch)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("admin.departmentColumn")}</Label>
            <Select
              value={draft.departmentId}
              onValueChange={(departmentId) => onDraftChange({ ...draft, departmentId })}
              disabled={!draft.branchId || draft.branchId === "__none__"}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("admin.selectDept")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  {selectedBranch ? `${getDeptLabel(selectedBranch)} (${t("branch.branchTitle")})` : "-"}
                </SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {getDeptLabel(team)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label>{t("admin.roleColumn", "역할")}</Label>
              <span className="text-[11px] text-muted-foreground">
                {t("admin.rolesMultiHint", "복수 선택 가능 (예: 학습자 + 지점 중간관리자)")}
              </span>
            </div>
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 ${draft.roleLocked ? "opacity-60 pointer-events-none" : ""}`}>
              {ROLE_OPTIONS.filter((o) => o.show).map((opt) => {
                const checked = draft.roles.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    htmlFor={`role-${opt.value}`}
                    className={`flex items-start gap-2.5 rounded-lg border-2 p-3 cursor-pointer transition-colors ${
                      checked ? "border-primary bg-primary/5" : "border-border hover:border-border/80"
                    }`}
                  >
                    <Checkbox
                      id={`role-${opt.value}`}
                      checked={checked}
                      onCheckedChange={(v) => toggleRole(opt.value, v === true)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <span className="text-muted-foreground">{opt.icon}</span>
                        <span className="truncate">{opt.label}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{opt.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
            {draft.roleLocked && (
              <p className="text-xs text-muted-foreground">{t("admin.roleLockedHint")}</p>
            )}
            {draft.roles.includes("branch_admin") && (
              <p className="text-[11px] text-muted-foreground">
                {t(
                  "admin.branchAdminAssignmentHint",
                  "관리할 지점 지정은 ‘지점 관리자 배정’ 화면에서 별도로 설정합니다.",
                )}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t("admin.positionColumn")}</Label>
            <Input
              value={draft.position}
              onChange={(event) => onDraftChange({ ...draft, position: event.target.value })}
              placeholder={t("admin.positionColumn")}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={onSave} disabled={saving}>
            {saving ? t("common.processing") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StaffEditDialog;
