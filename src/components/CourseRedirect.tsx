import { Navigate, useParams, useLocation } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useUserRole } from "@/hooks/useUserRole";

/**
 * Redirects generic /courses/:courseId paths to role-appropriate routes.
 * e.g. admin → /admin/courses/:id, teacher → /teacher/courses/:id, student → /student/courses/:id
 */
const CourseRedirect = () => {
  const { courseId } = useParams();
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

  return <Navigate to={`${prefix}/courses/${courseId}${search}`} replace />;
};

export default CourseRedirect;
