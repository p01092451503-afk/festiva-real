import { Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useUser } from "@/contexts/UserContext";
import { useUserRole } from "@/hooks/useUserRole";
import { FullScreenSkeleton } from "@/components/PageSkeletons";

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute = ({ children }: AdminRouteProps) => {
  const { user, isLoading } = useUser();
  const { isAdmin, roles } = useUserRole();
  const isSuperAdmin = roles.includes("super_admin");
  const { i18n } = useTranslation();

  // Admin/Super Admin operators are Korean — force KO inside admin area
  // regardless of any saved language preference or browser detection.
  useEffect(() => {
    if (!user) return;
    if (!(isAdmin || isSuperAdmin)) return;
    if (!i18n.language?.toLowerCase().startsWith("ko")) {
      i18n.changeLanguage("ko");
    }
  }, [user, isAdmin, isSuperAdmin, i18n, i18n.language]);

  if (isLoading) return <FullScreenSkeleton />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin && !isSuperAdmin) return <Navigate to="/dashboard" replace />;

  // Role switcher 활성 역할이 admin이 아닌 경우(student/teacher 모드로 전환)
  // admin 권한이 있더라도 admin 페이지 접근을 차단한다.
  const activeRole = (() => {
    try {
      return localStorage.getItem("nf-active-role");
    } catch {
      return null;
    }
  })();
  if (activeRole && activeRole !== "admin") {
    const target = activeRole === "teacher" ? "/teacher" : "/student";
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
