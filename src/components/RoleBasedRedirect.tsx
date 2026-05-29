import { Navigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { FullScreenSkeleton } from "@/components/PageSkeletons";

const RoleBasedRedirect = () => {
  const { user, isLoading } = useUser();
  const { primaryRole, roles } = useUserRole();
  const { data: siteSettings } = useSiteSettings();
  const teacherRoleEnabled = siteSettings?.teacher_role_enabled !== false;

  if (isLoading) return <FullScreenSkeleton />;
  if (!user) return <Navigate to="/auth" replace />;

  // Resolve effective role when teacher is disabled
  let effectiveRole = primaryRole;
  if (!teacherRoleEnabled && effectiveRole === "teacher") {
    if (roles.includes("admin") || roles.includes("super_admin")) {
      effectiveRole = "admin";
    } else {
      effectiveRole = "student";
    }
  }

  switch (effectiveRole) {
    case "admin":
      return <Navigate to="/admin" replace />;
    case "branch_admin":
      return <Navigate to="/branch-admin" replace />;
    case "teacher":
      return <Navigate to="/teacher" replace />;
    default:
      return <Navigate to="/student" replace />;
  }
};

export default RoleBasedRedirect;
