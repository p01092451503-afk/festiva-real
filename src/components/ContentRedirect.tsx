import { Navigate, useParams, useLocation } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useUserRole } from "@/hooks/useUserRole";

/**
 * Redirects generic /courses/:courseId/content/:contentId paths to role-appropriate routes.
 */
const ContentRedirect = () => {
  const { courseId, contentId } = useParams();
  const { search } = useLocation();
  const { user, isLoading: userLoading } = useUser();
  const { primaryRole } = useUserRole();

  if (userLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const isLearningView = new URLSearchParams(search).get("view") === "learn";
  const prefix = isLearningView
    ? "/student"
    : primaryRole === "admin"
    ? "/admin"
    : primaryRole === "teacher"
    ? "/teacher"
    : "/student";

  return <Navigate to={`${prefix}/courses/${courseId}/content/${contentId}${search}`} replace />;
};

export default ContentRedirect;
