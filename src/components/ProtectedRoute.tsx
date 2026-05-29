import { Navigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { FullScreenSkeleton } from "@/components/PageSkeletons";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, isLoading } = useUser();

  if (isLoading) return <FullScreenSkeleton />;
  if (!user) return <Navigate to="/auth" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;
