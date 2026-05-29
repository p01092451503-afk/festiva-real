import { Navigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { FullScreenSkeleton } from "@/components/PageSkeletons";
import ProtectedRoute from "@/components/ProtectedRoute";

/**
 * Wraps teacher-only routes. If the platform admin has disabled the teacher
 * role, redirect to /dashboard so the user lands on their effective role
 * (admin or student).
 */
const TeacherRoute = ({ children }: { children: React.ReactNode }) => {
  const { isLoading } = useUser();
  const { data: siteSettings, isLoading: settingsLoading } = useSiteSettings();

  if (isLoading || settingsLoading) return <FullScreenSkeleton />;

  const teacherRoleEnabled = siteSettings?.teacher_role_enabled !== false;
  if (!teacherRoleEnabled) return <Navigate to="/dashboard" replace />;

  return <ProtectedRoute>{children}</ProtectedRoute>;
};

export default TeacherRoute;