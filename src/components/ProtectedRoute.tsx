import { Navigate, useLocation } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { FullScreenSkeleton } from "@/components/PageSkeletons";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, isLoading } = useUser();
  const location = useLocation();

  if (isLoading) return <FullScreenSkeleton />;
  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/auth?next=${encodeURIComponent(next)}`} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
