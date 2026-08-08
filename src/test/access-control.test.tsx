import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import ProtectedRoute from "@/components/ProtectedRoute";
import TeacherRoute from "@/components/TeacherRoute";
import AdminRoute from "@/components/AdminRoute";
import BranchAdminRoute from "@/components/BranchAdminRoute";

/* -------------------------------------------------------------------------- */
/* Mocks                                                                      */
/* -------------------------------------------------------------------------- */

type RoleKey = "anon" | "student" | "teacher" | "branch_admin" | "admin";

const authState = {
  user: null as { id: string } | null,
  roles: [] as string[],
  isLoading: false,
  hasBranchAssignment: false,
  branchLoading: false,
  teacherRoleEnabled: true,
};

vi.mock("@/contexts/UserContext", () => ({
  useUser: () => ({
    user: authState.user,
    roles: authState.roles,
    isLoading: authState.isLoading,
    profile: null,
    session: null,
    signOut: vi.fn(),
    refreshProfile: vi.fn(),
  }),
}));

vi.mock("@/hooks/useBranchAdmin", () => ({
  useBranchAdmin: () => ({
    isBranchAdmin: authState.hasBranchAssignment,
    isLoading: authState.branchLoading,
    branches: [],
    branchIds: [],
    permissions: [],
  }),
}));

vi.mock("@/hooks/useSiteSettings", () => ({
  useSiteSettings: () => ({
    data: { teacher_role_enabled: authState.teacherRoleEnabled },
    isLoading: false,
  }),
}));

vi.mock("@/components/PageSkeletons", () => ({
  FullScreenSkeleton: () => <div data-testid="loading">loading</div>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: "ko", changeLanguage: vi.fn() },
  }),
}));

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const ROLE_SETUP: Record<RoleKey, () => void> = {
  anon: () => {
    authState.user = null;
    authState.roles = [];
    authState.hasBranchAssignment = false;
  },
  student: () => {
    authState.user = { id: "u-student" };
    authState.roles = ["student"];
    authState.hasBranchAssignment = false;
  },
  teacher: () => {
    authState.user = { id: "u-teacher" };
    authState.roles = ["teacher"];
    authState.hasBranchAssignment = false;
  },
  branch_admin: () => {
    authState.user = { id: "u-branch" };
    authState.roles = ["branch_admin"];
    authState.hasBranchAssignment = true;
  },
  admin: () => {
    authState.user = { id: "u-admin" };
    authState.roles = ["admin"];
    authState.hasBranchAssignment = false;
  },
};

type GuardKey = "protected" | "teacher" | "admin" | "branchAdmin";

const GUARDS: Record<GuardKey, (children: React.ReactNode) => JSX.Element> = {
  protected: (children) => <ProtectedRoute>{children}</ProtectedRoute>,
  teacher: (children) => <TeacherRoute>{children}</TeacherRoute>,
  admin: (children) => <AdminRoute>{children}</AdminRoute>,
  branchAdmin: (children) => <BranchAdminRoute>{children}</BranchAdminRoute>,
};

/** Renders a guarded route and returns "granted" or the redirect destination. */
function renderGuardedRoute(guard: GuardKey, path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path={path}
          element={GUARDS[guard](<div data-testid="page">protected page</div>)}
        />
        <Route path="/auth" element={<div data-testid="redirect">/auth</div>} />
        <Route path="/dashboard" element={<div data-testid="redirect">/dashboard</div>} />
        <Route path="/student" element={<div data-testid="redirect">/student</div>} />
        <Route path="/teacher" element={<div data-testid="redirect">/teacher</div>} />
      </Routes>
    </MemoryRouter>,
  );

  if (screen.queryByTestId("page")) return "granted";
  if (screen.queryByTestId("loading")) return "loading";
  return screen.getByTestId("redirect").textContent as string;
}

/* -------------------------------------------------------------------------- */
/* Route x Role access matrix                                                 */
/* -------------------------------------------------------------------------- */

type Expectation = "granted" | "/auth" | "/dashboard" | "/student" | "/teacher";

interface RouteCase {
  name: string;
  path: string;
  guard: GuardKey;
  expected: Record<RoleKey, Expectation>;
}

const ROUTE_MATRIX: RouteCase[] = [
  {
    name: "학습자 대시보드 (/dashboard)",
    path: "/dashboard-test",
    guard: "protected",
    expected: {
      anon: "/auth",
      student: "granted",
      teacher: "granted",
      branch_admin: "granted",
      admin: "granted",
    },
  },
  {
    name: "학습자 영역 (/student/*)",
    path: "/student/courses",
    guard: "protected",
    expected: {
      anon: "/auth",
      student: "granted",
      teacher: "granted",
      branch_admin: "granted",
      admin: "granted",
    },
  },
  {
    name: "마이페이지 (/mypage)",
    path: "/mypage",
    guard: "protected",
    expected: {
      anon: "/auth",
      student: "granted",
      teacher: "granted",
      branch_admin: "granted",
      admin: "granted",
    },
  },
  {
    name: "강사 영역 (/teacher/*)",
    path: "/teacher/courses",
    guard: "teacher",
    expected: {
      anon: "/auth",
      student: "/dashboard",
      teacher: "granted",
      branch_admin: "/dashboard",
      admin: "granted",
    },
  },
  {
    name: "첨삭 관리 (/corrections)",
    path: "/corrections",
    guard: "teacher",
    expected: {
      anon: "/auth",
      student: "/dashboard",
      teacher: "granted",
      branch_admin: "/dashboard",
      admin: "granted",
    },
  },
  {
    name: "본사 관리자 영역 (/admin/*)",
    path: "/admin/users",
    guard: "admin",
    expected: {
      anon: "/auth",
      student: "/dashboard",
      teacher: "/dashboard",
      branch_admin: "/dashboard",
      admin: "granted",
    },
  },
  {
    name: "시스템 설정 (/admin/settings)",
    path: "/admin/settings",
    guard: "admin",
    expected: {
      anon: "/auth",
      student: "/dashboard",
      teacher: "/dashboard",
      branch_admin: "/dashboard",
      admin: "granted",
    },
  },
  {
    name: "지점 관리자 영역 (/branch/*)",
    path: "/branch/members",
    guard: "branchAdmin",
    expected: {
      anon: "/auth",
      student: "/dashboard",
      teacher: "/dashboard",
      branch_admin: "granted",
      admin: "granted",
    },
  },
];

const ROLES: RoleKey[] = ["anon", "student", "teacher", "branch_admin", "admin"];

describe("라우트 x 역할 접근 제어 매트릭스", () => {
  beforeEach(() => {
    localStorage.clear();
    authState.isLoading = false;
    authState.branchLoading = false;
    authState.teacherRoleEnabled = true;
  });

  ROUTE_MATRIX.forEach((route) => {
    describe(route.name, () => {
      ROLES.forEach((role) => {
        const expected = route.expected[role];
        it(`${role} → ${expected === "granted" ? "접근 허용" : `${expected} 리다이렉트`}`, () => {
          ROLE_SETUP[role]();
          expect(renderGuardedRoute(route.guard, route.path)).toBe(expected);
        });
      });
    });
  });
});

describe("추가 접근 제어 규칙", () => {
  beforeEach(() => {
    localStorage.clear();
    authState.isLoading = false;
    authState.branchLoading = false;
    authState.teacherRoleEnabled = true;
  });

  it("super_admin은 관리자 영역에 접근할 수 있다", () => {
    authState.user = { id: "u-super" };
    authState.roles = ["super_admin"];
    expect(renderGuardedRoute("admin", "/admin/users")).toBe("granted");
  });

  it("역할 전환(학습자 모드) 중인 관리자는 관리자 영역에서 /student로 이동한다", () => {
    ROLE_SETUP.admin();
    localStorage.setItem("nf-active-role", "student");
    expect(renderGuardedRoute("admin", "/admin/users")).toBe("/student");
  });

  it("역할 전환(강사 모드) 중인 관리자는 관리자 영역에서 /teacher로 이동한다", () => {
    ROLE_SETUP.admin();
    localStorage.setItem("nf-active-role", "teacher");
    expect(renderGuardedRoute("admin", "/admin/users")).toBe("/teacher");
  });

  it("강사 역할이 비활성화되면 강사도 /dashboard로 이동한다", () => {
    ROLE_SETUP.teacher();
    authState.teacherRoleEnabled = false;
    expect(renderGuardedRoute("teacher", "/teacher/courses")).toBe("/dashboard");
  });

  it("지점 배정이 없는 branch_admin은 지점 영역에 접근할 수 없다", () => {
    ROLE_SETUP.branch_admin();
    authState.hasBranchAssignment = false;
    expect(renderGuardedRoute("branchAdmin", "/branch/members")).toBe("/dashboard");
  });

  it("인증 로딩 중에는 판정을 미루고 스켈레톤을 보여준다", () => {
    ROLE_SETUP.anon();
    authState.isLoading = true;
    expect(renderGuardedRoute("protected", "/mypage")).toBe("loading");
  });
});
