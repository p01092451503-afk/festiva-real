import { useCallback } from "react";
import { driver, DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { useTranslation } from "react-i18next";

const TOUR_SEEN_KEY_PREFIX = "nf_tour_seen_";

interface TourStep {
  element: string;
  title: string;
  description: string;
  side?: "top" | "bottom" | "left" | "right";
}

export const useGuidedTour = (role: "student" | "teacher" | "admin") => {
  const { t } = useTranslation();

  const getSteps = useCallback((): TourStep[] => {
    const common: TourStep[] = [
      {
        element: '[data-tour="sidebar-nav"]',
        title: t("tour.sidebarNav", "사이드바 메뉴"),
        description: t("tour.sidebarNavDesc", "이곳에서 모든 주요 기능에 접근할 수 있습니다. 원하는 메뉴를 클릭하세요."),
      },
      {
        element: '[data-tour="language-toggle"]',
        title: t("tour.language", "언어 전환"),
        description: t("tour.languageDesc", "한국어/영어 간 언어를 전환할 수 있습니다."),
      },
      {
        element: '[data-tour="notification-bell"]',
        title: t("tour.notifications", "알림"),
        description: t("tour.notificationsDesc", "새로운 알림을 확인할 수 있습니다. 미확인 알림이 있으면 배지가 표시됩니다."),
      },
      {
        element: '[data-tour="user-profile"]',
        title: t("tour.profile", "내 프로필"),
        description: t("tour.profileDesc", "현재 로그인한 사용자 정보를 확인할 수 있습니다."),
      },
    ];

    const studentSteps: TourStep[] = [
      {
        element: '[data-tour="nav-dashboard"]',
        title: t("tour.studentDashboard", "대시보드"),
        description: t("tour.studentDashboardDesc", "학습 현황, 진행 중인 강좌, 최근 활동 등을 한눈에 확인할 수 있습니다."),
      },
      {
        element: '[data-tour="nav-catalog"]',
        title: t("tour.catalog", "강의 카탈로그"),
        description: t("tour.catalogDesc", "수강 가능한 모든 강의를 탐색하고 수강 신청할 수 있습니다."),
      },
      {
        element: '[data-tour="nav-courses"]',
        title: t("tour.myCourses", "내 강의"),
        description: t("tour.myCoursesDesc", "현재 수강 중인 강의 목록과 진도율을 확인할 수 있습니다."),
      },
      {
        element: '[data-tour="nav-assignments"]',
        title: t("tour.assignments", "과제"),
        description: t("tour.assignmentsDesc", "제출해야 할 과제를 확인하고 제출할 수 있습니다."),
      },
      {
        element: '[data-tour="nav-achievements"]',
        title: t("tour.achievements", "성취"),
        description: t("tour.achievementsDesc", "획득한 배지, 포인트, 수료증을 확인할 수 있습니다."),
      },
    ];

    const teacherSteps: TourStep[] = [
      {
        element: '[data-tour="nav-dashboard"]',
        title: t("tour.teacherDashboard", "강사 대시보드"),
        description: t("tour.teacherDashboardDesc", "담당 강의 현황과 학습자 통계를 한눈에 확인할 수 있습니다."),
      },
      {
        element: '[data-tour="nav-course-mgmt"]',
        title: t("tour.courseManagement", "강의 관리"),
        description: t("tour.courseManagementDesc", "강의를 생성·편집하고 차시를 관리할 수 있습니다."),
      },
      {
        element: '[data-tour="nav-assignment-mgmt"]',
        title: t("tour.assignmentMgmt", "과제 관리"),
        description: t("tour.assignmentMgmtDesc", "과제를 출제하고 제출된 과제를 채점할 수 있습니다."),
      },
      {
        element: '[data-tour="nav-student-mgmt"]',
        title: t("tour.studentMgmt", "학습자 관리"),
        description: t("tour.studentMgmtDesc", "수강생 목록을 확인하고 개별 학습 현황을 추적할 수 있습니다."),
      },
    ];

    const adminSteps: TourStep[] = [
      {
        element: '[data-tour="nav-dashboard"]',
        title: t("tour.adminDashboard", "관리자 대시보드"),
        description: t("tour.adminDashboardDesc", "전체 플랫폼 운영 현황을 한눈에 파악할 수 있습니다."),
      },
      {
        element: '[data-tour="nav-user-mgmt"]',
        title: t("tour.userMgmt", "회원 관리"),
        description: t("tour.userMgmtDesc", "사용자 계정을 생성·관리하고 역할을 부여할 수 있습니다."),
      },
      {
        element: '[data-tour="nav-branch-mgmt"]',
        title: t("tour.branchMgmt", "지점 관리"),
        description: t("tour.branchMgmtDesc", "지점(부서)을 생성·편집하고 조직 구조를 관리할 수 있습니다."),
      },
      {
        element: '[data-tour="nav-course-mgmt"]',
        title: t("tour.adminCourseMgmt", "강의 관리"),
        description: t("tour.adminCourseMgmtDesc", "모든 강의를 관리하고 새 강의를 생성할 수 있습니다."),
      },
      {
        element: '[data-tour="nav-enrollment-mgmt"]',
        title: t("tour.enrollmentMgmt", "수강 관리"),
        description: t("tour.enrollmentMgmtDesc", "수강 신청을 승인·관리하고 일괄 등록할 수 있습니다."),
      },
      {
        element: '[data-tour="nav-completion-mgmt"]',
        title: t("tour.completionMgmt", "수료 관리"),
        description: t("tour.completionMgmtDesc", "수료 기준을 설정하고 수료증을 발급·관리할 수 있습니다."),
      },
      {
        element: '[data-tour="nav-traffic"]',
        title: t("tour.traffic", "통계 현황"),
        description: t("tour.trafficDesc", "플랫폼 이용 통계와 트래픽을 모니터링할 수 있습니다."),
      },
      {
        element: '[data-tour="nav-settings"]',
        title: t("tour.settings", "설정"),
        description: t("tour.settingsDesc", "플랫폼 전반의 설정을 관리할 수 있습니다."),
      },
    ];

    const roleSteps = role === "admin" ? adminSteps : role === "teacher" ? teacherSteps : studentSteps;
    return [...roleSteps, ...common];
  }, [role, t]);

  const startTour = useCallback(() => {
    const steps = getSteps();
    const driveSteps: DriveStep[] = steps
      .filter((s) => document.querySelector(s.element))
      .map((s) => ({
        element: s.element,
        popover: {
          title: s.title,
          description: s.description,
          side: s.side || "bottom" as const,
        },
      }));

    if (driveSteps.length === 0) return;

    const d = driver({
      showProgress: true,
      animate: true,
      overlayColor: "hsl(var(--foreground) / 0.4)",
      stagePadding: 8,
      stageRadius: 8,
      popoverClass: "nf-tour-popover",
      nextBtnText: t("common.next", "다음"),
      prevBtnText: t("common.previous", "이전"),
      doneBtnText: t("common.confirm", "확인"),
      progressText: "{{current}} / {{total}}",
      steps: driveSteps,
      onDestroyed: () => {
        localStorage.setItem(`${TOUR_SEEN_KEY_PREFIX}${role}`, "true");
      },
    });

    d.drive();
  }, [getSteps, role, t]);

  const hasSeenTour = localStorage.getItem(`${TOUR_SEEN_KEY_PREFIX}${role}`) === "true";

  const resetTour = useCallback(() => {
    localStorage.removeItem(`${TOUR_SEEN_KEY_PREFIX}${role}`);
  }, [role]);

  return { startTour, hasSeenTour, resetTour };
};
