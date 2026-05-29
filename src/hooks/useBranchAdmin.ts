import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";

export type BranchCapability =
  | "track_manage"
  | "staff_manage"
  | "track_assign"
  | "stats_view";

interface BranchAssignment {
  branch_id: string;
  branch?: { id: string; name: string; name_en: string | null; code: string | null };
}

interface BranchPermission {
  branch_id: string;
  capability_code: BranchCapability;
  enabled: boolean;
}

/**
 * Returns the branches and capabilities the current user has as branch_admin.
 * Returns empty arrays if user has no assignments.
 */
export const useBranchAdmin = () => {
  const { user } = useUser();

  const { data: assignments = [], isLoading: loadingAssign } = useQuery({
    queryKey: ["branch-admin-assignments", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branch_admin_assignments")
        .select("branch_id, branch:departments(id, name, name_en, code)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as BranchAssignment[];
    },
  });

  const { data: permissions = [], isLoading: loadingPerm } = useQuery({
    queryKey: ["branch-admin-permissions", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branch_admin_permissions")
        .select("branch_id, capability_code, enabled")
        .eq("user_id", user!.id)
        .eq("enabled", true);
      if (error) throw error;
      return (data ?? []) as BranchPermission[];
    },
  });

  const branchIds = assignments.map((a) => a.branch_id);
  const branches = assignments
    .map((a) => a.branch)
    .filter((b): b is NonNullable<typeof b> => !!b);

  const hasCapability = (cap: BranchCapability, branchId?: string) =>
    permissions.some(
      (p) =>
        p.capability_code === cap &&
        p.enabled &&
        (branchId ? p.branch_id === branchId : true),
    );

  const capabilitiesForBranch = (branchId: string): BranchCapability[] =>
    permissions
      .filter((p) => p.enabled && p.branch_id === branchId)
      .map((p) => p.capability_code);

  return {
    isBranchAdmin: assignments.length > 0,
    branchIds,
    branches,
    permissions,
    hasCapability,
    capabilitiesForBranch,
    isLoading: loadingAssign || loadingPerm,
  };
};