import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useUser } from "@/contexts/UserContext";
import { FullScreenSkeleton } from "@/components/PageSkeletons";
import { useFeatureModules } from "@/hooks/useFeatureModules";

/**
 * Gates B2C storefront pages (/, /store, /store/courses/*).
 * If B2C is disabled in site settings, redirects:
 *  - logged-in users → /dashboard (role-based redirect handles routing)
 *  - guests → /auth
 */
const StorefrontGate = ({ children }: { children: ReactNode }) => {
  const { data: settings, isLoading } = useSiteSettings();
  const { user, isLoading: userLoading } = useUser();
  const { isEnabled, isLoading: modulesLoading } = useFeatureModules();

  if (isLoading || userLoading || modulesLoading) return <FullScreenSkeleton />;

  // 폐쇄형 LMS가 켜져 있으면 결제/스토어 진입을 강제로 차단
  if (settings?.b2c_enabled === false || isEnabled("closed_lms")) {
    return <Navigate to={user ? "/dashboard" : "/auth"} replace />;
  }

  return <>{children}</>;
};

export default StorefrontGate;