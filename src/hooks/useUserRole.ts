import { useUser } from "@/contexts/UserContext";

export const useUserRole = () => {
  const { roles } = useUser();

  const isSuperAdmin = roles.includes("super_admin");
  const isAdmin = roles.includes("admin") || isSuperAdmin;
  const isTeacher = roles.includes("teacher");
  const isStudent = roles.includes("student");
  const isBranchAdmin = roles.includes("branch_admin");

  const primaryRole = isAdmin
    ? "admin"
    : isBranchAdmin
    ? "branch_admin"
    : isTeacher
    ? "teacher"
    : "student";

  return { roles, isSuperAdmin, isAdmin, isTeacher, isStudent, isBranchAdmin, primaryRole };
};
