import { Users, Search, UserPlus, Trash2, Pencil, KeyRound, BarChart3, UserCheck, GraduationCap, FileSpreadsheet, Download, Send, Building2, ShieldCheck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import StaffEditDialog, { type StaffEditDraft, type StaffRole } from "@/components/admin/StaffEditDialog";
import BulkStaffUploadDialog from "@/components/admin/BulkStaffUploadDialog";
import BulkMessageDialog from "@/components/admin/BulkMessageDialog";
import RichStatCard from "@/components/admin/stats/RichStatCard";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { downloadCsv, todayStamp } from "@/lib/exportCsv";
import {
  MEMBER_STATUS_ORDER,
  memberStatusClass,
  memberStatusLabel,
  GENDER_LABEL,
} from "@/lib/statusMeta";

const ROLE_PRIORITY = ["super_admin", "admin", "teacher", "student"] as const;

const AdminUsers = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [msgOpen, setMsgOpen] = useState(false);
  const [bulkDeptOpen, setBulkDeptOpen] = useState(false);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkDeptId, setBulkDeptId] = useState("__none__");
  const [bulkStatus, setBulkStatus] = useState("active");
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ userId: string; name: string } | null>(null);
  const [staffEdit, setStaffEdit] = useState<StaffEditDraft | null>(null);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "student", departmentId: "", branchId: "" });
  const [resetTarget, setResetTarget] = useState<{ userId: string; name: string } | null>(null);
  const [resetPwd, setResetPwd] = useState({ pw: "", confirm: "" });
  const { t, i18n } = useTranslation();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const isEn = i18n.language?.startsWith("en");
  const { data: siteSettings } = useSiteSettings();
  const teacherRoleEnabled = siteSettings?.teacher_role_enabled !== false;

  const roleLabel: Record<(typeof ROLE_PRIORITY)[number], { text: string; className: string }> = {
    super_admin: { text: t("roles.superAdminLabel", "슈퍼관리자"), className: "text-primary bg-primary/10" },
    admin: { text: t("roles.adminLabel", "관리자"), className: "text-destructive bg-destructive/10" },
    teacher: { text: t("roles.teacherLabel", "강사"), className: "text-primary bg-primary/10" },
    student: { text: t("roles.studentLabel", "학습자"), className: "text-foreground bg-secondary" },
  };

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("*").eq("is_active", true).order("display_order");
      return data || [];
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async () => {
      const effectiveDeptId = newUser.departmentId === "__branch__" ? newUser.branchId : newUser.departmentId;
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: newUser.email,
          password: newUser.password,
          fullName: newUser.name,
          role: newUser.role,
          departmentId: effectiveDeptId || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success(t("admin.userCreated"), { description: t("admin.userCreatedDesc", { name: newUser.name }) });
      setAddOpen(false);
      setNewUser({ name: "", email: "", password: "", role: "student", departmentId: "", branchId: "" });
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success(t("admin.userDeleted"));
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      const message = err?.message || "";

      if (message.includes("Cannot delete yourself")) {
        toast.error(t("admin.cannotDeleteSelf"));
        return;
      }

      if (message.includes("Cannot delete super admin")) {
        toast.error(t("admin.cannotManageSuperAdmin"));
        return;
      }

      if (message.includes("Admin access required")) {
        toast.error(t("admin.adminPermissionRequired"));
        return;
      }

      toast.error(message || t("common.error"));
    },
  });

  const rolesByUser = useMemo(() => {
    const grouped = new Map<string, StaffRole[]>();

    roles.forEach((roleRow: any) => {
      const current = grouped.get(roleRow.user_id) ?? [];
      const nextRole = roleRow.role as StaffRole;

      if (!current.includes(nextRole)) {
        current.push(nextRole);
      }

      grouped.set(roleRow.user_id, current);
    });

    return grouped;
  }, [roles]);

  const getPrimaryRole = (userId: string) => {
    const assignedRoles = rolesByUser.get(userId) ?? [];
    return ROLE_PRIORITY.find((role) => assignedRoles.includes(role as StaffRole)) ?? "student";
  };

  const hasProtectedRole = (userId: string) => (rolesByUser.get(userId) ?? []).includes("super_admin");

  const getDeptName = (deptId: string | null) => {
    if (!deptId) return "-";
    const dept = departments.find((d: any) => d.id === deptId);
    if (!dept) return "-";
    return isEn ? (dept as any).name_en || (dept as any).name : (dept as any).name;
  };

  const filtered = profiles.filter((profile: any) => {
    const q = search.toLowerCase().trim();
    const digits = q.replace(/[^0-9]/g, "");
    const phoneDigits = (profile.phone_number || "").replace(/[^0-9]/g, "");
    const searchableValues = [
      profile.full_name || "",
      profile.email || "",
      profile.department || "",
      profile.position || "",
      profile.employee_id || "",
      profile.phone_number || "",
      profile.birth_date || "",
      profile.admin_memo || "",
      memberStatusLabel(profile.member_status),
      GENDER_LABEL[profile.gender] || "",
      (rolesByUser.get(profile.user_id) ?? []).join(" "),
      getDeptName(profile.department_id),
    ];

    const matchesSearch =
      !q ||
      searchableValues.some((value) => String(value).toLowerCase().includes(q)) ||
      (digits.length >= 2 && phoneDigits.includes(digits));
    const matchesDept = deptFilter === "all" || profile.department_id === deptFilter;
    const matchesStatus = statusFilter === "all" || (profile.member_status || "active") === statusFilter;
    const matchesRole =
      roleFilter === "all" || (rolesByUser.get(profile.user_id) ?? []).includes(roleFilter as StaffRole);
    return matchesSearch && matchesDept && matchesStatus && matchesRole;
  });

  const teacherCount = profiles.filter((profile: any) => getPrimaryRole(profile.user_id) === "teacher").length;
  const activeCount = profiles.filter((p: any) => (p.member_status || "active") === "active").length;

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedProfiles = useMemo(
    () => profiles.filter((p: any) => selectedSet.has(p.user_id)),
    [profiles, selectedSet],
  );
  const allFilteredSelected = filtered.length > 0 && filtered.every((p: any) => selectedSet.has(p.user_id));

  const toggleOne = (userId: string, on: boolean) =>
    setSelectedIds((prev) => (on ? [...new Set([...prev, userId])] : prev.filter((id) => id !== userId)));

  const toggleAllFiltered = (on: boolean) =>
    setSelectedIds((prev) =>
      on
        ? [...new Set([...prev, ...filtered.map((p: any) => p.user_id)])]
        : prev.filter((id) => !filtered.some((p: any) => p.user_id === id)),
    );

  const bulkUpdateMutation = useMutation({
    mutationFn: async (patch: { department_id?: string | null; member_status?: string }) => {
      const { error } = await supabase.from("profiles").update(patch).in("user_id", selectedIds);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${selectedIds.length}명 일괄 변경 완료`);
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      setBulkDeptOpen(false);
      setBulkStatusOpen(false);
      setSelectedIds([]);
    },
    onError: (err: any) => toast.error(err?.message || "일괄 변경에 실패했습니다."),
  });

  const exportMembers = () => {
    const rows = (selectedIds.length > 0 ? selectedProfiles : filtered) as any[];
    downloadCsv(`회원목록_${todayStamp()}`, rows, [
      { header: "이름", value: (r) => r.full_name },
      { header: "이메일", value: (r) => r.email },
      { header: "전화번호", value: (r) => r.phone_number },
      { header: "생년월일", value: (r) => r.birth_date },
      { header: "성별", value: (r) => GENDER_LABEL[r.gender] || "" },
      { header: "회원상태", value: (r) => memberStatusLabel(r.member_status) },
      { header: "역할", value: (r) => (rolesByUser.get(r.user_id) ?? []).join("/") },
      { header: "소속", value: (r) => getDeptName(r.department_id) },
      { header: "직책", value: (r) => r.position },
      { header: "사번", value: (r) => r.employee_id },
      { header: "가입일", value: (r) => (r.created_at ? new Date(r.created_at).toLocaleDateString("ko-KR") : "") },
      { header: "최근접속", value: (r) => (r.last_login_at ? new Date(r.last_login_at).toLocaleString("ko-KR") : "") },
      { header: "관리자메모", value: (r) => r.admin_memo },
    ]);
    toast.success(`${rows.length}명 엑셀(CSV) 다운로드`);
  };

  const openStaffEdit = (profile: any) => {
    const primaryRole = getPrimaryRole(profile.user_id);
    const deptId = profile.department_id || "";
    const dept = departments.find((d: any) => d.id === deptId);
    let branchId = "__none__";
    let departmentId = "__none__";
    if (dept) {
      if ((dept as any).parent_department_id) {
        branchId = (dept as any).parent_department_id;
        departmentId = dept.id;
      } else {
        branchId = dept.id;
        departmentId = "__none__";
      }
    }

    const currentRoles = (rolesByUser.get(profile.user_id) ?? []).filter(
      (r) => r !== "super_admin",
    );
    setStaffEdit({
      userId: profile.user_id,
      name: profile.full_name || "-",
      branchId,
      departmentId,
      position: profile.position || "",
      roles: currentRoles.length > 0 ? (currentRoles as any) : ["student"],
      roleLocked: hasProtectedRole(profile.user_id) || profile.user_id === user?.id,
    });
  };

  const updateStaffMutation = useMutation({
    mutationFn: async (draft: StaffEditDraft) => {
      const departmentId = draft.departmentId !== "__none__" ? draft.departmentId : (draft.branchId !== "__none__" ? draft.branchId : null);
      const position = draft.position.trim();

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ department_id: departmentId, position: position || null })
        .eq("user_id", draft.userId);
      if (profileError) throw profileError;

      if (draft.roleLocked) return;

      const { data: currentRoles, error: roleReadError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", draft.userId);
      if (roleReadError) throw roleReadError;

      if ((currentRoles ?? []).some((item) => item.role === "super_admin")) {
        throw new Error("Cannot delete super admin");
      }

      const { error: deleteRoleError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", draft.userId)
        .neq("role", "super_admin");
      if (deleteRoleError) throw deleteRoleError;

      const rolesToInsert = (draft.roles.length > 0 ? draft.roles : ["student"]).map((role) => ({
        user_id: draft.userId,
        role: role as StaffRole,
      }));
      const { error: insertRoleError } = await supabase.from("user_roles").insert(rolesToInsert);
      if (insertRoleError) throw insertRoleError;
    },
    onSuccess: () => {
      toast.success(t("admin.staffUpdated"));
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      setStaffEdit(null);
    },
    onError: (err: any) => {
      const message = err?.message || "";

      if (message.includes("Cannot delete super admin")) {
        toast.error(t("admin.cannotManageSuperAdmin"));
        return;
      }

      toast.error(message || t("common.error"));
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      const { data, error } = await supabase.functions.invoke("admin-reset-password", {
        body: { userId, newPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success(t("admin.passwordResetSuccess"));
      setResetTarget(null);
      setResetPwd({ pw: "", confirm: "" });
    },
    onError: (err: any) => {
      const message = err?.message || "";
      if (message.includes("Cannot reset super admin")) {
        toast.error(t("admin.cannotResetSuperAdmin"));
        return;
      }
      if (message.includes("Admin access required")) {
        toast.error(t("admin.adminPermissionRequired"));
        return;
      }
      toast.error(message || t("common.error"));
    },
  });

  const submitResetPassword = () => {
    if (!resetTarget) return;
    if (resetPwd.pw.length < 8) {
      toast.error(t("admin.passwordTooShort"));
      return;
    }
    if (resetPwd.pw !== resetPwd.confirm) {
      toast.error(t("admin.passwordMismatch"));
      return;
    }
    resetPasswordMutation.mutate({ userId: resetTarget.userId, newPassword: resetPwd.pw });
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2"><Users className="h-6 w-6" aria-hidden="true" />{t("admin.userManagement")}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t("admin.userManagementDesc")}</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" className="rounded-xl gap-2 flex-1 sm:flex-none" onClick={exportMembers}>
              <Download className="h-4 w-4" /> 엑셀 다운로드
            </Button>
            <Button variant="outline" className="rounded-xl gap-2 flex-1 sm:flex-none" onClick={() => setBulkOpen(true)}>
              <FileSpreadsheet className="h-4 w-4" /> 대량 추가
            </Button>
            <Button className="rounded-xl gap-2 flex-1 sm:flex-none" onClick={() => setAddOpen(true)}>
              <UserPlus className="h-4 w-4" /> {t("admin.addUser")}
            </Button>
          </div>
        </div>

        {/* Stats — visualized */}
        <div className={`grid ${teacherRoleEnabled ? "grid-cols-3" : "grid-cols-2"} gap-3`}>
          <RichStatCard
            label={t("admin.totalUsersCount")}
            value={profiles.length}
            sub={isEn ? "Registered staff" : "등록된 회원"}
            icon={Users}
            tone="indigo"
            visual="bar"
            barValue={100}
            barCaption={isEn ? `${profiles.length} total` : `총 ${profiles.length}명`}
          />
          <RichStatCard
            label={t("admin.activeUsers")}
            value={activeCount}
            sub={isEn ? "Active accounts" : "활성 계정"}
            icon={UserCheck}
            tone="emerald"
            visual="ring"
            ringValue={profiles.length ? Math.round((activeCount / profiles.length) * 100) : 0}
          />
          {teacherRoleEnabled && (
            <RichStatCard
              label={t("admin.teacherCount")}
              value={teacherCount}
              sub={isEn ? "Teaching staff" : "강사 인원"}
              icon={GraduationCap}
              tone="violet"
              visual="dots"
              dotsActive={Math.min(7, teacherCount)}
              dotsTotal={7}
            />
          )}
        </div>

        {/* Search + Filters */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="이름·이메일·전화번호 뒷자리·사번·소속·메모 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 rounded-xl border-border"
            />
          </div>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-28 sm:w-40 rounded-xl">
              <SelectValue placeholder={t("admin.allDepts")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.allDepts")}</SelectItem>
              {departments.map((d: any) => (
                <SelectItem key={d.id} value={d.id}>{isEn ? d.name_en || d.name : d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-24 sm:w-32 rounded-xl">
              <SelectValue placeholder="등급" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 등급</SelectItem>
              {ROLE_PRIORITY.map((r) => (
                <SelectItem key={r} value={r}>{roleLabel[r].text}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-24 sm:w-32 rounded-xl">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              {MEMBER_STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>{memberStatusLabel(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bulk action bar */}
        {selectedIds.length > 0 && (
          <div className="stat-card !p-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">{selectedIds.length}명 선택됨</span>
            <span className="flex-1" />
            <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => setBulkDeptOpen(true)}>
              <Building2 className="h-3.5 w-3.5" /> 소속 변경
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => setBulkStatusOpen(true)}>
              <ShieldCheck className="h-3.5 w-3.5" /> 상태 변경
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => setMsgOpen(true)}>
              <Send className="h-3.5 w-3.5" /> 메일/알림톡 발송
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={exportMembers}>
              <Download className="h-3.5 w-3.5" /> 선택 다운로드
            </Button>
            <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => setSelectedIds([])}>
              선택 해제
            </Button>
          </div>
        )}

        {/* User Table - Desktop */}
        <div className="stat-card !p-0 overflow-x-auto hidden md:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 w-10">
                  <Checkbox
                    checked={allFilteredSelected}
                    onCheckedChange={(v) => toggleAllFiltered(v === true)}
                    aria-label="전체 선택"
                  />
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{t("admin.nameColumn")}</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">연락처</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">{t("admin.departmentColumn")}</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{t("admin.roleColumn")}</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">상태</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">{t("admin.positionColumn")}</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((profile: any) => {
                const currentRole = getPrimaryRole(profile.user_id);
                const role = roleLabel[currentRole] || roleLabel.student;
                const deleteDisabledReason = profile.user_id === user?.id
                  ? t("admin.cannotDeleteSelf")
                  : hasProtectedRole(profile.user_id)
                    ? t("admin.cannotManageSuperAdmin")
                    : null;

                return (
                  <tr key={profile.user_id} className={`transition-colors ${selectedSet.has(profile.user_id) ? "bg-accent/40" : "hover:bg-accent/30"}`}>
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedSet.has(profile.user_id)}
                        onCheckedChange={(v) => toggleOne(profile.user_id, v === true)}
                        aria-label={`${profile.full_name || "회원"} 선택`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center text-xs font-semibold text-accent-foreground shrink-0">
                          {(profile.full_name || "?").slice(0, 1)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{profile.full_name || "-"}</p>
                          <p className="text-xs text-muted-foreground">{profile.email || profile.employee_id || "-"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground">{profile.phone_number || "-"}</span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-sm text-muted-foreground">{getDeptName(profile.department_id)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block whitespace-nowrap text-[10px] font-medium px-2 py-1 rounded-full ${role.className}`}>{role.text}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block whitespace-nowrap text-[10px] font-medium px-2 py-1 rounded-full border ${memberStatusClass(profile.member_status)}`}>
                        {memberStatusLabel(profile.member_status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">{profile.position || "-"}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          title={t("admin.viewLearningDetail", "학습 현황 보기")}
                          aria-label={t("admin.viewLearningDetail", "학습 현황 보기")}
                          onClick={() => navigate(`/admin/users/${profile.user_id}`)}
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-full gap-1.5 px-3"
                          onClick={() => openStaffEdit(profile)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{t("common.edit")}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          disabled={hasProtectedRole(profile.user_id) && !roles.some((r: any) => r.user_id === user?.id && r.role === "super_admin")}
                          title={t("admin.resetPassword")}
                          aria-label={t("admin.resetPassword")}
                          onClick={() => {
                            setResetPwd({ pw: "", confirm: "" });
                            setResetTarget({ userId: profile.user_id, name: profile.full_name || "-" });
                          }}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full text-destructive hover:text-destructive"
                          disabled={!!deleteDisabledReason}
                          title={deleteDisabledReason || t("admin.deleteUser")}
                          aria-label={deleteDisabledReason || t("admin.deleteUser")}
                          onClick={() => setDeleteTarget({ userId: profile.user_id, name: profile.full_name || "-" })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">{t("admin.noUsers")}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* User List - Mobile Cards */}
        <div className="md:hidden space-y-2">
          {filtered.map((profile: any) => {
            const currentRole = getPrimaryRole(profile.user_id);
            const role = roleLabel[currentRole] || roleLabel.student;
            const deleteDisabledReason = profile.user_id === user?.id
              ? t("admin.cannotDeleteSelf")
              : hasProtectedRole(profile.user_id)
                ? t("admin.cannotManageSuperAdmin")
                : null;
            const deptName = getDeptName(profile.department_id);

            return (
              <div key={profile.user_id} className="stat-card !p-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    className="mt-1"
                    checked={selectedSet.has(profile.user_id)}
                    onCheckedChange={(v) => toggleOne(profile.user_id, v === true)}
                    aria-label={`${profile.full_name || "회원"} 선택`}
                  />
                  <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center text-sm font-semibold text-accent-foreground shrink-0">
                    {(profile.full_name || "?").slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{profile.full_name || "-"}</p>
                        <p className="text-xs text-muted-foreground truncate">{profile.email || profile.employee_id || "-"}</p>
                        {profile.phone_number && (
                          <p className="text-xs text-muted-foreground truncate">{profile.phone_number}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`shrink-0 whitespace-nowrap text-[10px] font-medium px-2 py-1 rounded-full ${role.className}`}>{role.text}</span>
                        <span className={`shrink-0 whitespace-nowrap text-[10px] font-medium px-2 py-0.5 rounded-full border ${memberStatusClass(profile.member_status)}`}>
                          {memberStatusLabel(profile.member_status)}
                        </span>
                      </div>
                    </div>
                    {(deptName !== "-" || profile.position) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        {deptName !== "-" && <span className="truncate">{deptName}</span>}
                        {deptName !== "-" && profile.position && <span className="text-border">·</span>}
                        {profile.position && <span className="truncate">{profile.position}</span>}
                      </div>
                    )}
                    <div className="mt-2.5 flex items-center justify-end gap-1 -mr-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        title={t("admin.viewLearningDetail", "학습 현황 보기")}
                        aria-label={t("admin.viewLearningDetail", "학습 현황 보기")}
                        onClick={() => navigate(`/admin/users/${profile.user_id}`)}
                      >
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        title={t("common.edit")}
                        aria-label={t("common.edit")}
                        onClick={() => openStaffEdit(profile)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        disabled={hasProtectedRole(profile.user_id) && !roles.some((r: any) => r.user_id === user?.id && r.role === "super_admin")}
                        title={t("admin.resetPassword")}
                        aria-label={t("admin.resetPassword")}
                        onClick={() => {
                          setResetPwd({ pw: "", confirm: "" });
                          setResetTarget({ userId: profile.user_id, name: profile.full_name || "-" });
                        }}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-destructive hover:text-destructive"
                        disabled={!!deleteDisabledReason}
                        title={deleteDisabledReason || t("admin.deleteUser")}
                        aria-label={deleteDisabledReason || t("admin.deleteUser")}
                        onClick={() => setDeleteTarget({ userId: profile.user_id, name: profile.full_name || "-" })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="stat-card !p-8 text-center text-sm text-muted-foreground">{t("admin.noUsers")}</div>
          )}
        </div>
      </div>

      {/* Add User Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("admin.addUser")}</DialogTitle>
            <DialogDescription>{t("admin.userManagementDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("auth.name")}</Label>
              <Input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} placeholder={t("auth.namePlaceholder")} className="mt-1" />
            </div>
            <div>
              <Label>{t("auth.email")}</Label>
              <Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="user@webheads.co.kr" className="mt-1" />
            </div>
            <div>
              <Label>{t("admin.tempPassword")}</Label>
              <Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="••••••••" className="mt-1" />
            </div>
            <div>
              <Label>{t("branch.branchTitle")}</Label>
              <Select value={newUser.branchId} onValueChange={(v) => setNewUser({ ...newUser, branchId: v, departmentId: "" })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={t("branch.branchTitle")} /></SelectTrigger>
                <SelectContent>
                  {departments.filter((d: any) => !d.parent_department_id).map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{isEn ? d.name_en || d.name : d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("admin.selectDept")}</Label>
              <Select value={newUser.departmentId} onValueChange={(v) => setNewUser({ ...newUser, departmentId: v })} disabled={!newUser.branchId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={t("admin.selectDept")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__branch__">{departments.find((d: any) => d.id === newUser.branchId) ? (isEn ? (departments.find((d: any) => d.id === newUser.branchId) as any).name_en || (departments.find((d: any) => d.id === newUser.branchId) as any).name : (departments.find((d: any) => d.id === newUser.branchId) as any).name) + ` (${t("branch.branchTitle")})` : "-"}</SelectItem>
                  {departments.filter((d: any) => d.parent_department_id === newUser.branchId).map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{isEn ? d.name_en || d.name : d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("admin.selectRole")}</Label>
              <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">{t("roles.studentLabel")}</SelectItem>
                  {teacherRoleEnabled && (
                    <SelectItem value="teacher">{t("roles.teacherLabel")}</SelectItem>
                  )}
                  <SelectItem value="admin">{t("roles.adminLabel")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full rounded-xl" onClick={() => createUserMutation.mutate()} disabled={!newUser.name || !newUser.email || !newUser.password || createUserMutation.isPending}>
              {createUserMutation.isPending ? t("common.processing") : t("admin.addUser")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.deleteUser")}: {deleteTarget?.name}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.deleteUserConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteUserMutation.mutate(deleteTarget.userId)}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? t("common.processing") : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <StaffEditDialog
        open={!!staffEdit}
        onOpenChange={(open) => !open && setStaffEdit(null)}
        draft={staffEdit}
        onDraftChange={setStaffEdit}
        departments={departments}
        isEn={isEn}
        saving={updateStaffMutation.isPending}
        onSave={() => staffEdit && updateStaffMutation.mutate(staffEdit)}
        teacherRoleEnabled={teacherRoleEnabled}
      />

      <BulkStaffUploadDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        departments={departments}
        teacherRoleEnabled={teacherRoleEnabled}
        isEn={isEn}
        onCompleted={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
          queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
        }}
      />

      {/* Reset Password Dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(open) => { if (!open) { setResetTarget(null); setResetPwd({ pw: "", confirm: "" }); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              {t("admin.resetPasswordTitle", { name: resetTarget?.name ?? "" })}
            </DialogTitle>
            <DialogDescription>{t("admin.resetPasswordDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("admin.newPasswordLabel")}</Label>
              <Input
                type="password"
                value={resetPwd.pw}
                onChange={(e) => setResetPwd((s) => ({ ...s, pw: e.target.value }))}
                placeholder={t("admin.newPasswordPlaceholder")}
                className="mt-1"
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label>{t("admin.confirmPasswordLabel")}</Label>
              <Input
                type="password"
                value={resetPwd.confirm}
                onChange={(e) => setResetPwd((s) => ({ ...s, confirm: e.target.value }))}
                placeholder={t("admin.newPasswordPlaceholder")}
                className="mt-1"
                autoComplete="new-password"
                onKeyDown={(e) => { if (e.key === "Enter") submitResetPassword(); }}
              />
            </div>
            <Button
              className="w-full rounded-xl"
              onClick={submitResetPassword}
              disabled={!resetPwd.pw || !resetPwd.confirm || resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? t("common.processing") : t("admin.resetPassword")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminUsers;
