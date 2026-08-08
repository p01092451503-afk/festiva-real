import { Navigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { FullScreenSkeleton } from "@/components/PageSkeletons";
import ProtectedRoute from "@/components/ProtectedRoute";

/**
 * Wraps teacher-only routes.
 * - If the platform admin disabled the teacher role, send users to /dashboard.
 * - Only users holding the teacher role (or admin/super_admin) may enter.
 */
const TeacherRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useUser();
  const { isTeacher, isAdmin } = useUserRole();
  const { data: siteSettings, isLoading: settingsLoading } = useSiteSettings();

  if (isLoading || settingsLoading) return <FullScreenSkeleton />;

  const teacherRoleEnabled = siteSettings?.teacher_role_enabled !== false;
  if (!teacherRoleEnabled) return <Navigate to="/dashboard" replace />;

  if (!user) return <Navigate to="/auth" replace />;
  if (!isTeacher && !isAdmin) return <Navigate to="/dashboard" replace />;

  return <ProtectedRoute>{children}</ProtectedRoute>;
};

export default TeacherRoute;
