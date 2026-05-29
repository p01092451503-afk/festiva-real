import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ShieldCheck, Plus, Trash2, Search, Building2, ChevronDown, Check } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";

interface Capability {
  code: string;
  name_ko: string;
  name_en: string;
  description_ko: string | null;
  description_en: string | null;
  sort_order: number;
}

interface Branch {
  id: string;
  name: string;
  name_en: string | null;
  code: string | null;
}

interface Profile {
  user_id: string;
  full_name: string | null;
  email: string | null;
  department_id: string | null;
}

interface Assignment {
  id: string;
  user_id: string;
  branch_id: string;
  assigned_at: string;
  profile?: Profile;
  branch?: Branch;
}

interface Permission {
  id: string;
  user_id: string;
  branch_id: string;
  capability_code: string;
  enabled: boolean;
}

const AdminBranchAdmins = () => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newBranchId, setNewBranchId] = useState<string>("");
  const [newUserId, setNewUserId] = useState<string>("");
  const [userSearch, setUserSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null);
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Capabilities
  const { data: capabilities = [] } = useQuery({
    queryKey: ["branch-admin-capabilities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branch_admin_capabilities")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as Capability[];
    },
  });

  // Branches (top-level departments)
  const { data: branches = [] } = useQuery({
    queryKey: ["branches-toplevel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, name_en, code, parent_department_id")
        .is("parent_department_id", null)
        .order("name");
      if (error) throw error;
      return (data ?? []) as (Branch & { parent_department_id: string | null })[];
    },
  });

  // Assignments + permissions
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["branch-admin-assignments-all"],
    queryFn: async () => {
      const a = await supabase
        .from("branch_admin_assignments")
        .select("id, user_id, branch_id, assigned_at")
        .order("assigned_at", { ascending: false });
      if (a.error) throw a.error;
      const userIds = Array.from(new Set(a.data.map((x) => x.user_id)));
      const branchIds = Array.from(new Set(a.data.map((x) => x.branch_id)));
      const [pRes, bRes] = await Promise.all([
        userIds.length
          ? supabase.from("profiles").select("user_id, full_name, email, department_id").in("user_id", userIds)
          : Promise.resolve({ data: [] as Profile[] }),
        branchIds.length
          ? supabase.from("departments").select("id, name, name_en, code").in("id", branchIds)
          : Promise.resolve({ data: [] as Branch[] }),
      ]);
      const profiles = (pRes.data ?? []) as Profile[];
      const brs = (bRes.data ?? []) as Branch[];
      return a.data.map((row) => ({
        ...row,
        profile: profiles.find((p) => p.user_id === row.user_id),
        branch: brs.find((b) => b.id === row.branch_id),
      })) as Assignment[];
    },
  });

  const { data: permissions = [] } = useQuery({
    queryKey: ["branch-admin-permissions-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branch_admin_permissions")
        .select("id, user_id, branch_id, capability_code, enabled");
      if (error) throw error;
      return data as Permission[];
    },
  });

  // Searchable users (for create dialog)
  const { data: candidates = [] } = useQuery({
    queryKey: ["candidates-for-branch-admin", userSearch],
    enabled: createOpen && userSearch.length >= 1,
    queryFn: async () => {
      const q = supabase
        .from("profiles")
        .select("user_id, full_name, email, department_id")
        .limit(20);
      if (userSearch) q.or(`full_name.ilike.%${userSearch}%,email.ilike.%${userSearch}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const filteredAssignments = useMemo(() => {
    let list = assignments;
    if (branchFilter !== "all") {
      list = list.filter((a) => a.branch_id === branchFilter);
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.profile?.full_name?.toLowerCase().includes(s) ||
          a.profile?.email?.toLowerCase().includes(s) ||
          a.branch?.name?.toLowerCase().includes(s) ||
          a.branch?.name_en?.toLowerCase().includes(s),
      );
    }
    return list;
  }, [assignments, search, branchFilter]);

  const branchLabel = (b?: Branch) =>
    !b ? "-" : isEn ? b.name_en || b.name : b.name;

  const capLabel = (c: Capability) => (isEn ? c.name_en : c.name_ko);
  const capDesc = (c: Capability) => (isEn ? c.description_en : c.description_ko);

  // Create assignment with all capabilities enabled by default
  const createAssignment = useMutation({
    mutationFn: async () => {
      if (!newUserId || !newBranchId) throw new Error(t("branchAdmin.selectBoth", "사용자와 지점을 모두 선택해주세요"));

      // Insert assignment
      const { error: aErr } = await supabase
        .from("branch_admin_assignments")
        .insert({ user_id: newUserId, branch_id: newBranchId, assigned_by: user?.id });
      if (aErr) throw aErr;

      // Insert all capabilities (enabled by default)
      const rows = capabilities.map((c) => ({
        user_id: newUserId,
        branch_id: newBranchId,
        capability_code: c.code,
        enabled: true,
        granted_by: user?.id,
      }));
      if (rows.length) {
        await supabase.from("branch_admin_permissions").upsert(rows, { onConflict: "user_id,branch_id,capability_code" });
      }

      // Ensure branch_admin role
      await supabase
        .from("user_roles")
        .upsert({ user_id: newUserId, role: "branch_admin" as const }, { onConflict: "user_id,role" });
    },
    onSuccess: () => {
      toast({ title: t("branchAdmin.created", "중간관리자 지정 완료") });
      setCreateOpen(false);
      setNewBranchId("");
      setNewUserId("");
      setUserSearch("");
      queryClient.invalidateQueries({ queryKey: ["branch-admin-assignments-all"] });
      queryClient.invalidateQueries({ queryKey: ["branch-admin-permissions-all"] });
    },
    onError: (e: Error) => {
      toast({ title: t("common.error", "오류"), description: e.message, variant: "destructive" });
    },
  });

  const togglePermission = useMutation({
    mutationFn: async (params: { userId: string; branchId: string; cap: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("branch_admin_permissions")
        .upsert(
          {
            user_id: params.userId,
            branch_id: params.branchId,
            capability_code: params.cap,
            enabled: params.enabled,
            granted_by: user?.id,
          },
          { onConflict: "user_id,branch_id,capability_code" },
        );
      if (error) throw error;
    },
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: ["branch-admin-permissions-all"] });
      const prev = queryClient.getQueryData<Permission[]>(["branch-admin-permissions-all"]) ?? [];
      const next = [...prev];
      const idx = next.findIndex(
        (p) => p.user_id === params.userId && p.branch_id === params.branchId && p.capability_code === params.cap,
      );
      if (idx >= 0) next[idx] = { ...next[idx], enabled: params.enabled };
      else
        next.push({
          id: `tmp-${Date.now()}`,
          user_id: params.userId,
          branch_id: params.branchId,
          capability_code: params.cap,
          enabled: params.enabled,
        });
      queryClient.setQueryData(["branch-admin-permissions-all"], next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["branch-admin-permissions-all"], ctx.prev);
      toast({ title: t("common.error", "오류"), description: t("branchAdmin.toggleFailed", "권한 변경 실패"), variant: "destructive" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-admin-permissions-all"] });
    },
  });

  const removeAssignment = useMutation({
    mutationFn: async (a: Assignment) => {
      // Delete permissions first
      await supabase
        .from("branch_admin_permissions")
        .delete()
        .eq("user_id", a.user_id)
        .eq("branch_id", a.branch_id);
      const { error } = await supabase.from("branch_admin_assignments").delete().eq("id", a.id);
      if (error) throw error;

      // If user has no more assignments, remove branch_admin role
      const { count } = await supabase
        .from("branch_admin_assignments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", a.user_id);
      if ((count ?? 0) === 0) {
        await supabase.from("user_roles").delete().eq("user_id", a.user_id).eq("role", "branch_admin");
      }
    },
    onSuccess: () => {
      toast({ title: t("branchAdmin.removed", "중간관리자 해제 완료") });
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["branch-admin-assignments-all"] });
      queryClient.invalidateQueries({ queryKey: ["branch-admin-permissions-all"] });
    },
    onError: (e: Error) => {
      toast({ title: t("common.error", "오류"), description: e.message, variant: "destructive" });
    },
  });

  const isPermEnabled = (userId: string, branchId: string, cap: string) =>
    permissions.find((p) => p.user_id === userId && p.branch_id === branchId && p.capability_code === cap)?.enabled ??
    false;

  return (
    <DashboardLayout role="admin">
      <div className="min-w-0 space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-semibold">
              <ShieldCheck className="h-6 w-6 text-primary" />
              {t("branchAdmin.title", "지점 중간관리자 관리")}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t(
                "branchAdmin.subtitle",
                "각 지점의 중간관리자를 지정하고 권한을 켜고 끌 수 있습니다. 본사 관리자만 변경 가능합니다.",
              )}
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2 whitespace-nowrap">
            <Plus className="h-4 w-4" />
            {t("branchAdmin.addNew", "중간관리자 지정")}
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("branchAdmin.searchPlaceholder", "이름, 이메일, 지점 검색")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-full sm:w-56 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("branchAdminStaff.allBranches", "전체 지점")}</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {branchLabel(b)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="self-start sm:self-center whitespace-nowrap h-9 px-3 flex items-center">
            {t("branchAdmin.totalCount", "{{count}}명", { count: filteredAssignments.length })}
          </Badge>
        </div>

        {/* Assignments list */}
        {isLoading ? (
          <div className="text-center text-muted-foreground py-12">{t("common.loading", "불러오는 중...")}</div>
        ) : filteredAssignments.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 border-2 border-dashed border-border/60 rounded-lg">
            {search
              ? t("branchAdmin.noResults", "검색 결과가 없습니다")
              : t("branchAdmin.empty", "지정된 중간관리자가 없습니다")}
          </div>
        ) : (
          <div className="border-2 border-border/80 rounded-lg overflow-hidden bg-card">
            {/* Header row (desktop) */}
            <div className="hidden md:grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.6fr)_auto] gap-4 px-4 py-2.5 bg-muted/40 border-b-2 border-border/80 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              <div>{t("branchAdmin.col.user", "사용자")}</div>
              <div>{t("branchAdmin.col.branch", "지점")}</div>
              <div>{t("branchAdmin.col.permissions", "권한")}</div>
              <div className="text-right pr-1">{t("branchAdmin.col.actions", "작업")}</div>
            </div>
            {filteredAssignments.map((a) => {
              const isOpen = expandedId === a.id;
              const enabledCount = capabilities.filter((c) =>
                isPermEnabled(a.user_id, a.branch_id, c.code),
              ).length;
              return (
                <div key={a.id} className="border-b-2 border-border/80 last:border-b-0">
                  {/* Compact row */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedId(isOpen ? null : a.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setExpandedId(isOpen ? null : a.id);
                      }
                    }}
                    className={cn(
                      "grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.6fr)_auto] gap-2 md:gap-4 px-3 md:px-4 py-2.5 items-center cursor-pointer hover:bg-muted/30 transition-colors",
                      isOpen && "bg-muted/30",
                    )}
                  >
                    {/* User */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform",
                            !isOpen && "-rotate-90",
                          )}
                        />
                        <span className="font-semibold text-sm truncate">
                          {a.profile?.full_name || "-"}
                        </span>
                        <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                          {a.profile?.email}
                        </span>
                      </div>
                    </div>
                    {/* Branch */}
                    <div className="flex items-center gap-1.5 min-w-0 pl-5 md:pl-0">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{branchLabel(a.branch)}</span>
                      {a.branch?.code && (
                        <span className="text-[10px] text-muted-foreground tabular-nums hidden lg:inline">
                          {a.branch.code}
                        </span>
                      )}
                    </div>
                    {/* Permissions chips */}
                    {/* Permissions summary */}
                    <div className="flex items-center gap-2 pl-5 md:pl-0">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border",
                          enabledCount === capabilities.length
                            ? "bg-primary/10 text-primary border-primary/20"
                            : enabledCount === 0
                              ? "bg-muted text-muted-foreground border-transparent"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
                        )}
                      >
                        <Check className="h-3 w-3" />
                        <span className="tabular-nums">
                          {enabledCount}/{capabilities.length}
                        </span>
                        <span className="hidden sm:inline">
                          {t("branchAdmin.permissionsLabel", "권한")}
                        </span>
                      </span>
                      <span className="text-[11px] text-muted-foreground hidden md:inline">
                        {t("branchAdmin.clickToEdit", "클릭해 편집")}
                      </span>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center justify-end pl-5 md:pl-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 gap-1 text-destructive hover:text-destructive whitespace-nowrap"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(a);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="text-xs">{t("branchAdmin.unassign", "해제")}</span>
                      </Button>
                    </div>
                  </div>

                  {/* Expanded permission editor */}
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 bg-muted/20 border-t border-border/60">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {capabilities.map((c) => {
                          const enabled = isPermEnabled(a.user_id, a.branch_id, c.code);
                          return (
                            <label
                              key={c.code}
                              className="flex items-start gap-3 p-2.5 rounded-md hover:bg-background/60 cursor-pointer transition-colors"
                            >
                              <Switch
                                checked={enabled}
                                onCheckedChange={(checked) =>
                                  togglePermission.mutate({
                                    userId: a.user_id,
                                    branchId: a.branch_id,
                                    cap: c.code,
                                    enabled: checked,
                                  })
                                }
                                className="mt-0.5"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm">{capLabel(c)}</div>
                                {capDesc(c) && (
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    {capDesc(c)}
                                  </div>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Create dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("branchAdmin.addNew", "중간관리자 지정")}</DialogTitle>
              <DialogDescription>
                {t(
                  "branchAdmin.addNewDesc",
                  "지점에 대한 중간관리자를 지정합니다. 모든 권한이 기본 활성화되며, 이후 개별로 끌 수 있습니다.",
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("branchAdmin.selectBranch", "지점 선택")}</label>
                <Select value={newBranchId} onValueChange={setNewBranchId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("branchAdmin.selectBranchPh", "지점 선택")} />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {branchLabel(b)} {b.code && <span className="text-muted-foreground ml-1">({b.code})</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t("branchAdmin.selectUser", "사용자 검색")}</label>
                <Input
                  placeholder={t("branchAdmin.searchUserPh", "이름 또는 이메일로 검색")}
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
                {userSearch.length >= 1 && (
                  <div className="max-h-60 overflow-y-auto border-2 border-border/60 rounded-md">
                    {candidates.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground text-center">
                        {t("branchAdmin.noUsers", "검색 결과가 없습니다")}
                      </div>
                    ) : (
                      candidates.map((p) => (
                        <button
                          key={p.user_id}
                          type="button"
                          onClick={() => {
                            setNewUserId(p.user_id);
                            setUserSearch(p.full_name || p.email || "");
                          }}
                          className={`w-full text-left p-3 hover:bg-muted/50 transition-colors border-b border-border/40 last:border-b-0 ${
                            newUserId === p.user_id ? "bg-muted" : ""
                          }`}
                        >
                          <div className="font-medium text-sm">{p.full_name || "-"}</div>
                          <div className="text-xs text-muted-foreground">{p.email}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                {t("common.cancel", "취소")}
              </Button>
              <Button
                onClick={() => createAssignment.mutate()}
                disabled={!newUserId || !newBranchId || createAssignment.isPending}
              >
                {createAssignment.isPending ? t("common.processing", "처리 중...") : t("common.save", "저장")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("branchAdmin.confirmRemoveTitle", "중간관리자 해제")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t(
                  "branchAdmin.confirmRemoveDesc",
                  "{{name}} 님의 {{branch}} 지점 중간관리자 권한을 해제합니다. 이 작업은 되돌릴 수 없습니다.",
                  {
                    name: deleteTarget?.profile?.full_name || "-",
                    branch: branchLabel(deleteTarget?.branch),
                  },
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel", "취소")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteTarget && removeAssignment.mutate(deleteTarget)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t("branchAdmin.unassign", "해제")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminBranchAdmins;