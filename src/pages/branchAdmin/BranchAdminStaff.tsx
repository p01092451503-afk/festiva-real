import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Users, Search, Building2, Lock } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBranchAdmin } from "@/hooks/useBranchAdmin";
import { supabase } from "@/integrations/supabase/client";

const BranchAdminStaff = () => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const { branches, branchIds, hasCapability, isLoading: loadingBA } = useBranchAdmin();
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>("all");

  const canManage = branchIds.some((bid) => hasCapability("staff_manage", bid)) || branchIds.some((bid) => hasCapability("stats_view", bid));

  const { data: depts = [] } = useQuery({
    queryKey: ["branch-admin-staff-depts", branchIds],
    enabled: branchIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, name_en, parent_department_id, code")
        .or(`id.in.(${branchIds.join(",")}),parent_department_id.in.(${branchIds.join(",")})`);
      if (error) throw error;
      return data ?? [];
    },
  });

  const allDeptIds = useMemo(() => depts.map((d) => d.id), [depts]);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["branch-admin-staff", allDeptIds, branchFilter],
    enabled: allDeptIds.length > 0,
    queryFn: async () => {
      let activeDeptIds = allDeptIds;
      if (branchFilter !== "all") {
        const filterIds = depts
          .filter((d) => d.id === branchFilter || d.parent_department_id === branchFilter)
          .map((d) => d.id);
        activeDeptIds = filterIds;
      }
      if (activeDeptIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, position, department_id, employee_id, phone_number")
        .in("department_id", activeDeptIds)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!search) return staff;
    const s = search.toLowerCase();
    return staff.filter(
      (p) => p.full_name?.toLowerCase().includes(s) || p.email?.toLowerCase().includes(s),
    );
  }, [staff, search]);

  const deptName = (id?: string | null) => {
    if (!id) return "-";
    const d = depts.find((x) => x.id === id);
    if (!d) return "-";
    return isEn ? d.name_en || d.name : d.name;
  };

  if (loadingBA) {
    return (
      <DashboardLayout role="branch_admin">
        <div className="p-6 text-muted-foreground">{t("common.loading", "불러오는 중...")}</div>
      </DashboardLayout>
    );
  }

  if (!canManage) {
    return (
      <DashboardLayout role="branch_admin">
        <div className="p-6 text-center text-muted-foreground">
          <Lock className="h-12 w-12 mx-auto mb-3 opacity-50" />
          {t("branchAdmin.noStaffPerm", "회원 관리 권한이 없습니다. 본사 관리자에게 문의해주세요.")}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="branch_admin">
      <div className="min-w-0 space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-semibold">
            <Users className="h-6 w-6 text-primary" />
            {t("nav.branchAdminStaff", "지점 회원 관리")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("branchAdminStaff.subtitle", "담당 지점에 소속된 회원 목록입니다.")}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("branchAdminStaff.searchPh", "이름 또는 이메일 검색")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("branchAdminStaff.allBranches", "전체 지점")}</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {isEn ? b.name_en || b.name : b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="self-start sm:self-center whitespace-nowrap">
            {filtered.length}
          </Badge>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground">{t("common.loading", "불러오는 중...")}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 border-2 border-dashed border-border/60 rounded-lg">
            {t("branchAdminStaff.empty", "회원이 없습니다")}
          </div>
        ) : (
          <div className="border-2 border-border/80 rounded-lg overflow-hidden">
            {filtered.map((p) => (
              <div key={p.user_id} className="p-4 border-b-2 border-border/80 last:border-b-0 hover:bg-muted/30 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{p.full_name || "-"}</span>
                      {p.position && <Badge variant="outline" className="text-[10px]">{p.position}</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">{p.email}</div>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" />
                    {deptName(p.department_id)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default BranchAdminStaff;