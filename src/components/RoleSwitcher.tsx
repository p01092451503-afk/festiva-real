import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Shield, GraduationCap, Users, Building2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const roleConfig = {
  admin: { icon: Shield, path: "/admin", labelKey: "roles.admin" },
  branch_admin: { icon: Building2, path: "/branch-admin", labelKey: "roles.branchAdmin" },
  teacher: { icon: Users, path: "/teacher", labelKey: "roles.teacher" },
  student: { icon: GraduationCap, path: "/student", labelKey: "roles.student" },
} as const;

const RoleSwitcher = () => {
  const { roles, primaryRole } = useUserRole();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: siteSettings } = useSiteSettings();
  const teacherRoleEnabled = siteSettings?.teacher_role_enabled !== false;

  // Map roles to switchable dashboard roles (super_admin → admin).
  // Admin/super_admin/teacher always get a "student" option so they can
  // preview the learner experience.
  const mapped = new Set(roles.map((r) => (r === "super_admin" ? "admin" : r)));
  if (mapped.has("admin") || mapped.has("teacher") || mapped.has("branch_admin")) {
    mapped.add("student");
  }
  const switchableRoles = Array.from(mapped)
    .filter((r) => r in roleConfig)
    .filter((r) => teacherRoleEnabled || r !== "teacher") as Array<keyof typeof roleConfig>;

  if (switchableRoles.length <= 1) return null;

  const CurrentIcon = roleConfig[primaryRole]?.icon || GraduationCap;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Switch role">
          <CurrentIcon className="h-[18px] w-[18px]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {switchableRoles.map((role) => {
          const config = roleConfig[role];
          if (!config) return null;
          const Icon = config.icon;
          return (
            <DropdownMenuItem
              key={role}
              onClick={() => {
                try {
                  localStorage.setItem("nf-active-role", role);
                } catch {}
                navigate(config.path);
              }}
              className="text-xs gap-2"
            >
              <Icon className="h-3.5 w-3.5" />
              {t(config.labelKey)}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default RoleSwitcher;
