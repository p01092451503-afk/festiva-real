import { Navigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useBranchAdmin } from "@/hooks/useBranchAdmin";
import { FullScreenSkeleton } from "@/components/PageSkeletons";

interface BranchAdminRouteProps {
  children: React.ReactNode;
}

const BranchAdminRoute = ({ children }: BranchAdminRouteProps) => {
  const { user, isLoading } = useUser();
  const { isAdmin, isBranchAdmin } = useUserRole();
  const { isBranchAdmin: hasBranchAssignment, isLoading: branchLoading } = useBranchAdmin();

  if (isLoading || branchLoading) return <FullScreenSkeleton />;
  if (!user) return <Navigate to="/auth" replace />;
  // HQ admins can also access for inspection
  if (!isAdmin && !isBranchAdmin && !hasBranchAssignment) {
    return <Navigate to="/dashboard" replace />;
  }
  if (!isAdmin && !hasBranchAssignment) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

export default BranchAdminRoute;