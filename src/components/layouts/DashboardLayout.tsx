import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, BookOpen, ClipboardList, Trophy, Users, Settings, Compass, UserCircle, ClipboardCheck, Library,
  LogOut, Menu, X, ChevronRight, GraduationCap, CalendarCheck, Activity, Building2, Bell, Megaphone, FileText, BarChart3, Video,
  CreditCard, ImageIcon, Palette, Layers, Globe2, PanelLeftClose, PanelLeftOpen, NotebookPen, ChevronDown, Languages, BookText,
  Info, ShieldCheck, Sparkles, Newspaper, Film, SlidersHorizontal, CalendarClock,
  Users2,
  MessageSquare,
  Coins,
  Calculator,
  Rss,
  Receipt,
  KeyRound,
  TrendingUp,
  MessageSquareText,
  CalendarRange, Briefcase, FolderCheck, Award, ToggleRight, PenLine, UserCog,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUser } from "@/contexts/UserContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useBranchAdmin } from "@/hooks/useBranchAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useDemoPreset } from "@/contexts/DemoPresetContext";
import LanguageToggle from "@/components/LanguageToggle";
import RoleSwitcher from "@/components/RoleSwitcher";
import NotificationBell from "@/components/NotificationBell";
import GuidedTourButton from "@/components/GuidedTourButton";
import WebVitalsBadge from "@/components/admin/WebVitalsBadge";
import webheadsLogoPng from "@/assets/webheads-logo.png";
import AnimatedBrand from "@/components/AnimatedBrand";
import { useFeatureModules } from "@/hooks/useFeatureModules";


interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  showNew?: boolean;
  tourId?: string;
  navKey?: string;
  children?: NavItem[];
  groupId?: string;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  role?: "student" | "teacher" | "admin" | "branch_admin";
  contentClassName?: string;
}

const DashboardLayout = ({ children, role, contentClassName }: DashboardLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Desktop collapse state — persisted across reloads
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("nf-sidebar-collapsed") === "1";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("nf-sidebar-collapsed", collapsed ? "1" : "0");
    }
  }, [collapsed]);
  const { profile, signOut } = useUser();
  const { primaryRole, isAdmin, isTeacher } = useUserRole();
  const { isBranchAdmin: hasBranchAssignment } = useBranchAdmin();
  const { t, i18n } = useTranslation();
  const { data: siteSettings } = useSiteSettings();
  const { activePreset } = useDemoPreset();
  const { isEnabled: isModuleEnabled } = useFeatureModules();
  const isEn = i18n.language?.startsWith("en");
  const baseCompanyName = isEn
    ? (siteSettings?.company_name_en || siteSettings?.company_name || t("common.companyLogoArea"))
    : (siteSettings?.company_name || t("common.companyLogoArea"));
  const displayCompanyName =
    activePreset?.sidebar_brand_name || activePreset?.brand_name || baseCompanyName;
  const presetSidebarLogo = activePreset?.sidebar_logo_url || activePreset?.logo_url || null;

  // Auto-detect role from URL so pages cannot accidentally render the wrong sidebar.
  // Explicit `role` prop still wins when provided (e.g. legacy admin pages reusing teacher layout).
  const pathRole: "student" | "teacher" | "admin" | "branch_admin" | null =
    location.pathname.startsWith("/admin")
      ? "admin"
      : location.pathname.startsWith("/branch-admin")
      ? "branch_admin"
      : location.pathname.startsWith("/teacher")
      ? "teacher"
      : location.pathname.startsWith("/student") ||
        location.pathname.startsWith("/dashboard") ||
        location.pathname.startsWith("/community") ||
        location.pathname.startsWith("/articles") ||
        location.pathname.startsWith("/mypage") ||
        location.pathname.startsWith("/my/") ||
        location.pathname.startsWith("/catalog")
      ? "student"
      : null;
  // Users assigned as branch admins (via branch_admin_assignments) may not have an
  // explicit "branch_admin" role row — treat them as branch_admin when no other
  // higher-priority role applies so they get the correct sidebar everywhere.
  const derivedPrimary =
    !isAdmin && !isTeacher && hasBranchAssignment ? "branch_admin" : primaryRole;
  const activeRole = role || pathRole || derivedPrimary || "student";
  const teacherRoleEnabled = siteSettings?.teacher_role_enabled !== false;
  // If teacher role is disabled, treat teacher dashboards as student
  const effectiveRole = activeRole === "teacher" && !teacherRoleEnabled ? "student" : activeRole;

  // Hidden nav menu keys (configured globally by super admin in system settings)
  const hiddenNavKeys = new Set<string>(siteSettings?.hidden_nav_keys ?? []);
  const isHidden = (key?: string) => !!key && hiddenNavKeys.has(key);

  // Cached "NEW" badge checks (10 min). Single shared cache across all pages.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: hasNewAnnouncement = false } = useQuery({
    queryKey: ["nav-new-announcements", since.slice(0, 13)],
    queryFn: async () => {
      const { count } = await supabase
        .from("announcements").select("id", { count: "exact", head: true })
        .eq("is_published", true).gte("created_at", since);
      return (count ?? 0) > 0;
    },
    staleTime: 10 * 60 * 1000,
  });
  const { data: hasNewBoardPost = false } = useQuery({
    queryKey: ["nav-new-board", since.slice(0, 13)],
    queryFn: async () => {
      const { count } = await supabase
        .from("board_posts").select("id", { count: "exact", head: true })
        .eq("is_published", true).gte("created_at", since);
      return (count ?? 0) > 0;
    },
    staleTime: 10 * 60 * 1000,
  });

  // Preload user avatar for instant rendering
  useEffect(() => {
    if (profile?.avatar_url) {
      const img = new Image();
      img.src = profile.avatar_url;
    }
  }, [profile?.avatar_url]);

  const { isEnabled } = useFeatureModules();

  const studentNav: NavItem[] = [
    { navKey: "student.dashboard", label: t("nav.dashboard"), href: "/student", icon: LayoutDashboard, tourId: "nav-dashboard" },
    { navKey: "student.catalog", label: t("nav.courseCatalog"), href: "/catalog", icon: Compass, tourId: "nav-catalog" },
    { navKey: "student.myCourses", label: t("nav.myCourses"), href: "/dashboard/courses", icon: BookOpen, tourId: "nav-courses" },
    { navKey: "student.videoSessions", label: t("nav.videoSessions", "화상 세션"), href: "/student/video-sessions", icon: Video },
    { navKey: "student.notes", label: t("nav.myNotes", "내 학습 메모"), href: "/student/notes", icon: NotebookPen },
    { navKey: "student.englishCorrection", label: t("nav.englishCorrection", "AI 영어 교정"), href: "/tools/english-correction", icon: Sparkles },
    { navKey: "student.articles", label: t("nav.articles", "아티클"), href: "/articles", icon: Newspaper },
    { navKey: "student.assignments", label: t("nav.assignments"), href: "/dashboard/assignments", icon: ClipboardList, tourId: "nav-assignments" },
    { navKey: "student.corrections", label: t("nav.corrections", "에세이(첨삭) 작성"), href: "/student/corrections", icon: PenLine },
    { navKey: "student.achievements", label: t("nav.achievements"), href: "/dashboard/achievements", icon: Trophy, tourId: "nav-achievements" },
    ...(isEnabled("programs")
      ? [{ navKey: "student.programs", label: t("nav.programs", "프로그램 신청"), href: "/student/programs", icon: CalendarRange } as NavItem]
      : []),
    ...(isEnabled("evidence")
      ? [{ navKey: "student.evidence", label: t("nav.evidence", "증빙자료 제출"), href: "/student/evidence", icon: FolderCheck } as NavItem]
      : []),
    ...(isEnabled("certificates_ops")
      ? [{ navKey: "student.certificates", label: t("nav.certificates", "내 수료증"), href: "/student/certificates", icon: Award } as NavItem]
      : []),
    ...(isEnabled("surveys_ops")
      ? [{ navKey: "student.surveys", label: t("nav.surveys", "만족도 조사"), href: "/student/surveys", icon: ClipboardList } as NavItem]
      : []),
    {
      navKey: "student.communication",
      label: t("nav.groupCommunication", "소통"),
      href: "#group-student-communication",
      icon: Megaphone,
      showNew: hasNewAnnouncement || hasNewBoardPost,
      children: [
        { navKey: "student.announcements", label: t("nav.announcements", "공지사항"), href: "/student/announcements", icon: Megaphone, showNew: hasNewAnnouncement },
        { navKey: "student.board", label: t("nav.board", "게시판"), href: "/student/board", icon: FileText, showNew: hasNewBoardPost },
        { navKey: "student.community", label: t("nav.community", "커뮤니티"), href: "/student/community", icon: Users2 },
      ],
    },
    { navKey: "student.mypage", label: t("nav.myPage"), href: "/mypage", icon: UserCircle },
  ].filter((i) => !isHidden(i.navKey));

  const teacherNav: NavItem[] = [
    { navKey: "teacher.dashboard", label: t("nav.dashboard"), href: "/teacher", icon: LayoutDashboard, tourId: "nav-dashboard" },
    { navKey: "teacher.assignments", label: t("nav.assignmentManagement"), href: "/teacher/assignments", icon: ClipboardList, tourId: "nav-assignment-mgmt" },
    { navKey: "teacher.corrections", label: t("nav.correctionsMgmt", "첨삭 관리"), href: "/teacher/corrections", icon: PenLine },
    { navKey: "teacher.students", label: t("nav.studentManagement"), href: "/teacher/students", icon: Users, tourId: "nav-student-mgmt" },
    {
      navKey: "teacher.communication",
      label: t("nav.groupCommunicationMgmt", "소통 관리"),
      href: "#group-teacher-communication",
      icon: Megaphone,
      children: [
        { navKey: "teacher.notifications", label: t("nav.notificationManagement", "알림 관리"), href: "/teacher/notifications", icon: Bell },
        { navKey: "teacher.announcements", label: t("nav.announcementManagement", "공지사항 관리"), href: "/teacher/announcements", icon: Megaphone },
        { navKey: "teacher.board", label: t("nav.boardManagement", "게시판 관리"), href: "/teacher/board", icon: FileText },
      ],
    },
    { navKey: "teacher.attendance", label: t("nav.attendanceManagement"), href: "/teacher/attendance", icon: CalendarCheck },
    { navKey: "teacher.videoSessions", label: t("nav.videoSessions", "화상 세션"), href: "/teacher/video-sessions", icon: Video },
    { navKey: "teacher.cms", label: t("nav.cms", "CMS · 아티클"), href: "/teacher/cms", icon: Newspaper },
    { navKey: "teacher.englishCorrection", label: t("nav.englishCorrection", "AI 영어 교정"), href: "/tools/english-correction", icon: Sparkles },
  ].filter((i) => !isHidden(i.navKey));
  const branchAdminNav: NavItem[] = [
    { navKey: "branchAdmin.dashboard", label: t("nav.dashboard", "대시보드"), href: "/branch-admin", icon: LayoutDashboard },
    { navKey: "branchAdmin.tracks", label: t("nav.branchAdminTracks", "지점 트랙 관리"), href: "/branch-admin/tracks", icon: Layers },
    { navKey: "branchAdmin.staff", label: t("nav.branchAdminStaff", "지점 회원 관리"), href: "/branch-admin/staff", icon: Users },
    { navKey: "branchAdmin.assignments", label: t("nav.branchAdminAssign", "트랙 배정"), href: "/branch-admin/assignments", icon: ClipboardCheck },
    { navKey: "branchAdmin.stats", label: t("nav.branchAdminStats", "지점 학습 통계"), href: "/branch-admin/stats", icon: BarChart3 },
    { navKey: "branchAdmin.certificates", label: t("nav.branchAdminCertificates", "수료증 일괄 발급"), href: "/branch-admin/certificates", icon: Award },
    { navKey: "branchAdmin.mypage", label: t("nav.myPage", "마이페이지"), href: "/mypage", icon: UserCircle },
  ].filter((i) => !isHidden(i.navKey));
  const adminNav: NavItem[] = [
    { navKey: "admin.dashboard", label: t("nav.dashboard"), href: "/admin", icon: LayoutDashboard, tourId: "nav-dashboard" },
    { navKey: "admin.traffic", label: t("nav.trafficMonitoring", "통계 현황"), href: "/admin/traffic", icon: BarChart3, tourId: "nav-traffic" },
    { navKey: "admin.globalDashboard", label: t("nav.globalDashboard", "글로벌 대시보드"), href: "/admin/global-dashboard", icon: Globe2 },
    { navKey: "admin.users", label: t("nav.learnerManagement", "학습자 관리"), href: "/admin/users", icon: Users, tourId: "nav-user-mgmt" },
    // 결제 관리는 사이트 설정에서 B2C 기능이 활성화된 경우에만 노출
    ...(siteSettings?.b2c_enabled !== false && !isModuleEnabled("closed_lms" as any)
      ? [{ navKey: "admin.orders", label: t("nav.paymentManagement", "결제 관리"), href: "/admin/orders", icon: CreditCard }]
      : []),
    { navKey: "admin.branches", label: t("nav.branchManagement", "지점 관리"), href: "/admin/branches", icon: Building2, tourId: "nav-branch-mgmt" },
    { navKey: "admin.branchAdmins", label: t("nav.branchAdminMgmt", "중간관리자 관리"), href: "/admin/branch-admins", icon: ShieldCheck },
    { navKey: "admin.courses", label: t("nav.courseManagement"), href: "/admin/courses", icon: BookOpen, tourId: "nav-course-mgmt" },
    { navKey: "admin.saleStatus", label: t("nav.saleStatus", "상품 판매 상태"), href: "/admin/sale-status", icon: BookOpen },
    { navKey: "admin.contentLibrary", label: t("nav.contentLibrary", "콘텐츠 라이브러리"), href: "/admin/content-library", icon: Film },
    { navKey: "admin.courseOptions", label: t("nav.courseOptions", "강의 판매·운영 옵션"), href: "/admin/course-options", icon: SlidersHorizontal },
    { navKey: "admin.courseOps", label: t("nav.courseOps", "수강 연장·일시정지"), href: "/admin/course-ops", icon: CalendarClock },
    { navKey: "admin.memberGroups", label: t("nav.memberGroups", "회원 그룹·등급"), href: "/admin/member-groups", icon: Users2 },
    { navKey: "admin.refunds", label: t("nav.refunds", "환불 관리"), href: "/admin/refunds", icon: Receipt },
    { navKey: "admin.messaging", label: t("nav.messaging", "발송 관리"), href: "/admin/messaging", icon: MessageSquare },
    { navKey: "admin.points", label: t("nav.pointsCoupons", "포인트·자동쿠폰"), href: "/admin/points", icon: Coins },
    { navKey: "admin.settlements", label: t("nav.settlements", "강사 정산"), href: "/admin/settlements", icon: Calculator },
    { navKey: "admin.privacyAudit", label: t("nav.privacyAudit", "개인정보 감사"), href: "/admin/privacy-audit", icon: ShieldCheck },
    { navKey: "admin.instructors", label: t("nav.instructorManagement", "강사 관리"), href: "/admin/instructors", icon: UserCog },
    { navKey: "admin.tracks", label: t("nav.trackManagement", "학습 트랙 관리"), href: "/admin/tracks", icon: Layers },
    { navKey: "admin.videoSessions", label: t("nav.videoSessions", "화상 세션"), href: "/admin/video-sessions", icon: Video },
    { navKey: "admin.videos", label: t("nav.videoManagement", "동영상 관리"), href: "/admin/videos", icon: Video },
    { navKey: "admin.enrollments", label: t("nav.enrollmentManagement"), href: "/admin/enrollments", icon: ClipboardCheck, tourId: "nav-enrollment-mgmt" },
    { navKey: "admin.learning", label: t("nav.learningManagement"), href: "/admin/learning", icon: GraduationCap },
    { navKey: "admin.attendance", label: t("nav.attendanceManagement"), href: "/admin/attendance", icon: CalendarCheck },
    { navKey: "admin.completion", label: t("nav.completionManagement"), href: "/admin/completion", icon: Trophy, tourId: "nav-completion-mgmt" },
    { navKey: "admin.assessments", label: t("nav.assessmentStatus", "평가 현황"), href: "/admin/assessments", icon: ClipboardCheck },
    { navKey: "admin.questionBank", label: t("nav.questionBank", "문제은행"), href: "/admin/question-bank", icon: Library },
    { navKey: "admin.aiProgressPrediction", label: t("nav.aiProgressPrediction", "AI 진도 예측"), href: "/admin/ai-progress-prediction", icon: TrendingUp },
    { navKey: "admin.aiFeedback", label: t("nav.aiFeedback", "AI 과제 피드백"), href: "/admin/ai-feedback", icon: MessageSquareText },
    { navKey: "admin.englishCorrection", label: t("nav.englishCorrection", "AI 영어 교정"), href: "/tools/english-correction", icon: Sparkles },
    { navKey: "admin.cms", label: t("nav.cms", "CMS · 아티클"), href: "/admin/cms", icon: Newspaper },
    { navKey: "admin.notifications", label: t("nav.notificationManagement", "알림 관리"), href: "/admin/notifications", icon: Bell },
    { navKey: "admin.announcements", label: t("nav.announcementManagement", "공지사항 관리"), href: "/admin/announcements", icon: Megaphone },
    { navKey: "admin.board", label: t("nav.boardManagement", "게시판 관리"), href: "/admin/board", icon: FileText },
    { navKey: "admin.community", label: t("nav.communityManagement", "커뮤니티 관리"), href: "/admin/community", icon: Users2 },
    { navKey: "admin.surveys", label: t("nav.surveyManagement", "설문 관리"), href: "/admin/surveys", icon: ClipboardList },
    { navKey: "admin.i18nDashboard", label: t("nav.i18nDashboard", "다국어 관리"), href: "/admin/i18n-dashboard", icon: Languages },
    { navKey: "admin.translationGlossary", label: t("nav.translationGlossary", "다국어 용어 관리"), href: "/admin/translation-glossary", icon: BookText },
    { navKey: "admin.siteSettings", label: t("nav.siteSettings", "사이트 설정"), href: "/admin/site-settings", icon: Palette },
    { navKey: "admin.settings", label: t("nav.settings", "시스템 설정"), href: "/admin/settings", icon: Settings, tourId: "nav-settings" },
    { navKey: "admin.systemInfo", label: t("nav.systemInfo", "시스템 정보"), href: "/admin/system-info", icon: Info },
    { navKey: "admin.manual", label: t("nav.manual", "사용자 매뉴얼"), href: "/admin/manual", icon: BookOpen },
  ].filter((i) => !isHidden(i.navKey));

  const adminGroupsRaw: NavGroup[] = [
    {
      id: "insights",
      label: t("nav.groupInsights", "인사이트"),
      items: [
        { navKey: "admin.dashboard", label: t("nav.dashboard", "관리자 대시보드"), href: "/admin", icon: LayoutDashboard, tourId: "nav-dashboard" },
        { navKey: "admin.traffic", label: t("nav.trafficMonitoring", "통계 현황"), href: "/admin/traffic", icon: BarChart3, tourId: "nav-traffic" },
        { navKey: "admin.globalDashboard", label: t("nav.globalDashboard", "글로벌 대시보드"), href: "/admin/global-dashboard", icon: Globe2 },
      ],
    },
    {
      id: "members",
      label: t("nav.groupMembers", "회원·조직"),
      items: [
        { navKey: "admin.users", label: t("nav.learnerManagement", "학습자 관리"), href: "/admin/users", icon: Users, tourId: "nav-user-mgmt" },
        { navKey: "admin.branches", label: t("nav.branchManagement", "지점 관리"), href: "/admin/branches", icon: Building2, tourId: "nav-branch-mgmt" },
        { navKey: "admin.branchAdmins", label: t("nav.branchAdminMgmt", "중간관리자 관리"), href: "/admin/branch-admins", icon: ShieldCheck },
        ...(siteSettings?.b2c_enabled !== false && !isModuleEnabled("closed_lms" as any)
          ? [{ navKey: "admin.orders", label: t("nav.paymentManagement", "결제 관리"), href: "/admin/orders", icon: CreditCard }]
          : []),
      ],
    },
    {
      id: "content",
      label: t("nav.groupContent", "콘텐츠"),
      items: [
        { navKey: "admin.courses", label: t("nav.courseManagement"), href: "/admin/courses", icon: BookOpen, tourId: "nav-course-mgmt" },
        { navKey: "admin.saleStatus", label: t("nav.saleStatus", "상품 판매 상태"), href: "/admin/sale-status", icon: BookOpen },
    { navKey: "admin.contentLibrary", label: t("nav.contentLibrary", "콘텐츠 라이브러리"), href: "/admin/content-library", icon: Film },
    { navKey: "admin.courseOptions", label: t("nav.courseOptions", "강의 판매·운영 옵션"), href: "/admin/course-options", icon: SlidersHorizontal },
    { navKey: "admin.courseOps", label: t("nav.courseOps", "수강 연장·일시정지"), href: "/admin/course-ops", icon: CalendarClock },
    { navKey: "admin.memberGroups", label: t("nav.memberGroups", "회원 그룹·등급"), href: "/admin/member-groups", icon: Users2 },
    { navKey: "admin.refunds", label: t("nav.refunds", "환불 관리"), href: "/admin/refunds", icon: Receipt },
    { navKey: "admin.messaging", label: t("nav.messaging", "발송 관리"), href: "/admin/messaging", icon: MessageSquare },
    { navKey: "admin.points", label: t("nav.pointsCoupons", "포인트·자동쿠폰"), href: "/admin/points", icon: Coins },
    { navKey: "admin.settlements", label: t("nav.settlements", "강사 정산"), href: "/admin/settlements", icon: Calculator },
    { navKey: "admin.privacyAudit", label: t("nav.privacyAudit", "개인정보 감사"), href: "/admin/privacy-audit", icon: ShieldCheck },
        { navKey: "admin.instructors", label: t("nav.instructorManagement", "강사 관리"), href: "/admin/instructors", icon: UserCog },
        { navKey: "admin.tracks", label: t("nav.trackManagement", "학습 트랙 관리"), href: "/admin/tracks", icon: Layers },
        { navKey: "admin.videoSessions", label: t("nav.videoSessions", "화상 세션"), href: "/admin/video-sessions", icon: Video },
        { navKey: "admin.englishCorrection", label: t("nav.englishCorrection", "AI 영어 교정"), href: "/tools/english-correction", icon: Sparkles },
        { navKey: "admin.videos", label: t("nav.videoManagement", "동영상 관리"), href: "/admin/videos", icon: Video },
        { navKey: "admin.cms", label: t("nav.cms", "CMS · 아티클"), href: "/admin/cms", icon: Newspaper },
      ],
    },
    {
      id: "i18n",
      label: t("nav.groupI18n", "다국어"),
      items: [
        { navKey: "admin.i18nDashboard", label: t("nav.i18nDashboard", "다국어 관리"), href: "/admin/i18n-dashboard", icon: Languages },
        { navKey: "admin.translationGlossary", label: t("nav.translationGlossary", "다국어 용어 관리"), href: "/admin/translation-glossary", icon: BookText },
      ],
    },
    {
      id: "operations",
      label: t("nav.groupOperations", "학습 운영"),
      items: [
        { navKey: "admin.enrollments", label: t("nav.enrollmentManagement"), href: "/admin/enrollments", icon: ClipboardCheck, tourId: "nav-enrollment-mgmt" },
        { navKey: "admin.learning", label: t("nav.learningManagement"), href: "/admin/learning", icon: GraduationCap },
        { navKey: "admin.attendance", label: t("nav.attendanceManagement"), href: "/admin/attendance", icon: CalendarCheck },
        { navKey: "admin.completion", label: t("nav.completionManagement"), href: "/admin/completion", icon: Trophy, tourId: "nav-completion-mgmt" },
        { navKey: "admin.bulkCertificates", label: t("nav.bulkCertificates", "수료증 일괄 발급"), href: "/branch-admin/certificates", icon: Award },
        { navKey: "admin.assessments", label: t("nav.assessmentStatus", "평가 현황"), href: "/admin/assessments", icon: ClipboardCheck },
        { navKey: "admin.questionBank", label: t("nav.questionBank", "문제은행"), href: "/admin/question-bank", icon: Library },
        { navKey: "admin.aiProgressPrediction", label: t("nav.aiProgressPrediction", "AI 진도 예측"), href: "/admin/ai-progress-prediction", icon: TrendingUp },
        { navKey: "admin.aiFeedback", label: t("nav.aiFeedback", "AI 과제 피드백"), href: "/admin/ai-feedback", icon: MessageSquareText },
        { navKey: "admin.corrections", label: t("nav.correctionsMgmt", "첨삭 관리"), href: "/admin/corrections", icon: PenLine },
      ],
    },
    {
      id: "communication",
      label: t("nav.groupCommunication", "커뮤니케이션"),
      items: [
        { navKey: "admin.notifications", label: t("nav.notificationManagement", "알림 관리"), href: "/admin/notifications", icon: Bell },
        { navKey: "admin.announcements", label: t("nav.announcementManagement", "공지사항 관리"), href: "/admin/announcements", icon: Megaphone, showNew: hasNewAnnouncement },
        { navKey: "admin.board", label: t("nav.boardManagement", "게시판 관리"), href: "/admin/board", icon: FileText, showNew: hasNewBoardPost },
        { navKey: "admin.community", label: t("nav.communityManagement", "커뮤니티 관리"), href: "/admin/community", icon: Users2 },
        { navKey: "admin.surveys", label: t("nav.surveyManagement", "설문 관리"), href: "/admin/surveys", icon: ClipboardList },
      ],
    },
    {
      id: "system",
      label: t("nav.groupSystem", "시스템"),
      items: [
        { navKey: "admin.siteSettings", label: t("nav.siteSettings", "사이트 설정"), href: "/admin/site-settings", icon: Palette },
        { navKey: "admin.settings", label: t("nav.settings", "시스템 설정"), href: "/admin/settings", icon: Settings, tourId: "nav-settings" },
        { navKey: "admin.moduleSettings", label: "기능 모듈", href: "/admin/settings/modules", icon: ToggleRight },
        { navKey: "admin.systemInfo", label: t("nav.systemInfo", "시스템 정보"), href: "/admin/system-info", icon: Info },
        { navKey: "admin.apiClients", label: t("nav.apiClients", "API 클라이언트"), href: "/admin/api-clients", icon: KeyRound },
        { navKey: "admin.manual", label: t("nav.manual", "사용자 매뉴얼"), href: "/admin/manual", icon: BookOpen },
      ],
    },
  ];

  // 산학프로젝트 모듈 그룹 — feature_modules 토글로 ON/OFF
  const opsItems: NavItem[] = [
    { navKey: "admin.ops.beneficiaries", label: "수혜학생 DB", href: "/admin/beneficiaries", icon: Users, _flag: "beneficiaries" } as any,
    { navKey: "admin.ops.programs", label: "프로그램 관리", href: "/admin/programs", icon: CalendarRange, _flag: "programs" } as any,
    { navKey: "admin.ops.projects", label: "산학프로젝트", href: "/admin/ops-projects", icon: Briefcase, _flag: "projects" } as any,
    { navKey: "admin.ops.evidence", label: "증빙자료 제출", href: "/admin/evidence", icon: FolderCheck, _flag: "evidence" } as any,
    { navKey: "admin.ops.surveys", label: "만족도 조사", href: "/admin/ops-surveys", icon: ClipboardList, _flag: "surveys_ops" } as any,
    { navKey: "admin.ops.certificates", label: "수료증/참가확인서", href: "/admin/ops-certificates", icon: Award, _flag: "certificates_ops" } as any,
    { navKey: "admin.ops.stats", label: "운영 통계", href: "/admin/ops-stats", icon: BarChart3, _flag: "stats_ops" } as any,
  ].filter((i: any) => isModuleEnabled(i._flag) && !isHidden(i.navKey));

  if (opsItems.length > 0) {
    adminGroupsRaw.splice(adminGroupsRaw.length - 1, 0, {
      id: "ops",
      label: "산학프로젝트",
      items: opsItems,
    });
  }

  // 폐쇄형 LMS 모듈 그룹 — feature_modules.closed_lms 토글 시 노출
  if (isModuleEnabled("closed_lms" as any)) {
    adminGroupsRaw.splice(adminGroupsRaw.length - 1, 0, {
      id: "closed_lms",
      label: "폐쇄형 LMS",
      items: [
        { navKey: "admin.closedLms.invitations", label: "수강자 일괄 초대", href: "/admin/invitations", icon: Users },
        { navKey: "admin.closedLms.logs", label: "초대 발송 현황", href: "/admin/invitations/logs", icon: ClipboardList },
        { navKey: "admin.closedLms.sms", label: "SMS 설정", href: "/admin/settings/sms", icon: Bell },
      ],
    });
  }

  const adminGroups: NavGroup[] = adminGroupsRaw
    .map((g) => ({ ...g, items: g.items.filter((i) => !isHidden(i.navKey)) }))
    .filter((g) => g.items.length > 0);

  const navItems =
    effectiveRole === "admin"
      ? adminNav
      : effectiveRole === "branch_admin"
      ? branchAdminNav
      : effectiveRole === "teacher"
      ? teacherNav
      : studentNav;
  const roleLabel = t(`roles.${effectiveRole}`);

  // Group expand/collapse state for admin sidebar (persisted)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem("nf-sidebar-groups");
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  });
  // Auto-expand the group containing the active route
  useEffect(() => {
    if (effectiveRole !== "admin") return;
    const activeGroup = adminGroups.find((g) => g.items.some((i) => i.href === location.pathname));
    if (activeGroup && !openGroups[activeGroup.id]) {
      setOpenGroups((s) => ({ ...s, [activeGroup.id]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, effectiveRole]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("nf-sidebar-groups", JSON.stringify(openGroups));
    }
  }, [openGroups]);
  const toggleGroup = (id: string) =>
    setOpenGroups((s) => ({ ...s, [id]: !s[id] }));

  // Solid, high-visibility chip
  const roleBadgeClass =
    effectiveRole === "admin"
      ? "bg-amber-500 text-white dark:bg-amber-500 dark:text-white"
      : effectiveRole === "branch_admin"
      ? "bg-emerald-600 text-white dark:bg-emerald-600 dark:text-white"
      : effectiveRole === "teacher"
      ? "bg-violet-600 text-white dark:bg-violet-600 dark:text-white"
      : "bg-sky-600 text-white dark:bg-sky-600 dark:text-white";
  const roleDotClass =
    effectiveRole === "admin"
      ? "bg-white/90"
      : effectiveRole === "teacher"
      ? "bg-white/90"
      : "bg-white/90";
  const RoleChip = ({ ariaLabelled = false }: { ariaLabelled?: boolean }) => (
    <span
      className={`mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full ${roleBadgeClass}`}
      {...(ariaLabelled
        ? { "aria-label": `${t("common.role", "역할")}: ${roleLabel}` }
        : {})}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${roleDotClass}`} />
      {roleLabel}
    </span>
  );

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const initials = profile?.full_name
    ? profile.full_name.slice(0, 2)
    : "NF";

  return (
    <div className="flex min-h-screen bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden" aria-hidden="true" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-[transform,width] duration-300 ease-out w-64 ${collapsed ? "lg:w-16" : "lg:w-64"} ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
        role="navigation"
        aria-label={t("nav.mainNavigation", "메인 내비게이션")}
      >
        <div className={`relative flex flex-col items-start ${collapsed ? "lg:p-2 lg:items-center p-6" : "p-6"}`}>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" aria-label={t("common.closeSidebar", "사이드바 닫기")}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          {collapsed ? null : (
            <>
              <Link to="/" className="flex items-center gap-2 hover:opacity-70 transition-opacity">
                {presetSidebarLogo ? (
                  <img
                    src={presetSidebarLogo}
                    alt={displayCompanyName}
                    className="block h-9 w-auto object-contain"
                  />
                ) : activePreset?.sidebar_brand_name || activePreset?.brand_name ? (
                  <span className="block text-lg font-semibold tracking-wide text-sidebar-foreground">
                    {activePreset.sidebar_brand_name || activePreset.brand_name}
                  </span>
                ) : (
                  <AnimatedBrand className="text-2xl" />
                )}
              </Link>
              <RoleChip ariaLabelled />
            </>
          )}
          {/* Mobile keeps full layout — collapse only affects lg+ */}
          {collapsed && (
            <div className="lg:hidden">
              <Link to="/" className="flex items-center gap-2 hover:opacity-70 transition-opacity">
                {presetSidebarLogo ? (
                  <img
                    src={presetSidebarLogo}
                    alt={displayCompanyName}
                    className="block h-9 w-auto object-contain"
                  />
                ) : activePreset?.sidebar_brand_name || activePreset?.brand_name ? (
                  <span className="block text-lg font-semibold tracking-wide text-sidebar-foreground">
                    {activePreset.sidebar_brand_name || activePreset.brand_name}
                  </span>
                ) : (
                  <AnimatedBrand className="text-2xl" />
                )}
              </Link>
              <RoleChip />
            </div>
          )}
        </div>

        <TooltipProvider delayDuration={150}>
          <nav className={`flex-1 overflow-y-auto py-4 space-y-1 ${collapsed ? "lg:px-2 px-3" : "px-3"}`} data-tour="sidebar-nav" aria-label={t("nav.sideNavigation", "사이드 메뉴")}>
            {effectiveRole === "admin" && !collapsed ? (
              adminGroups.map((group) => {
                const isGroupOpen = openGroups[group.id] ?? false;
                const groupHasActive = group.items.some((i) => i.href === location.pathname);
                return (
                  <div key={group.id} className="pb-2">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      className={`group/header w-full flex items-center justify-between gap-2 mx-1 my-0.5 pl-2 pr-2 py-1.5 rounded-md transition-colors ${
                        isGroupOpen
                          ? "bg-muted/70 hover:bg-muted"
                          : "bg-transparent hover:bg-muted/50"
                      }`}
                      aria-expanded={isGroupOpen}
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide ${
                            groupHasActive
                              ? "bg-foreground/85 text-background"
                              : "bg-muted-foreground/15 text-muted-foreground"
                          }`}
                        >
                          {group.label}
                        </span>
                      </span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-transform ${
                          isGroupOpen ? "rotate-0" : "-rotate-90"
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                    {isGroupOpen && (
                      <div className="mt-1 space-y-0.5 pl-1.5 border-l border-border/60 ml-3">
                        {group.items.map((item) => {
                          const isActive = location.pathname === item.href;
                          return (
                            <Link
                              key={item.href}
                              to={item.href}
                              onClick={() => setSidebarOpen(false)}
                              className={`nav-item ${isActive ? "nav-item-active" : ""}`}
                              aria-current={isActive ? "page" : undefined}
                              {...(item.tourId ? { "data-tour": item.tourId } : {})}
                            >
                              <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                              <span>{item.label}</span>
                              {item.showNew && (
                                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold leading-none rounded bg-destructive text-destructive-foreground animate-pulse">
                                  NEW
                                </span>
                              )}
                              {isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto" aria-hidden="true" />}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              navItems.map((item) => {
              // Inline collapsible group (used by student/teacher communication group)
              if (item.children && item.children.length > 0) {
                const groupId = `inline-${item.navKey || item.href}`;
                const childActive = item.children.some((c) => c.href === location.pathname);
                const isGroupOpen = (openGroups[groupId] ?? false) || childActive;
                if (collapsed) {
                  // In collapsed mode, render children as individual tooltip icons
                  return (
                    <div key={groupId} className="space-y-1">
                      {item.children.map((child) => {
                        const isActive = location.pathname === child.href;
                        return (
                          <Tooltip key={child.href}>
                            <TooltipTrigger asChild>
                              <Link to={child.href} onClick={() => setSidebarOpen(false)}
                                className={`nav-item ${isActive ? "nav-item-active" : ""} lg:justify-center lg:px-0 lg:gap-0`}
                                aria-current={isActive ? "page" : undefined}
                                aria-label={child.label}>
                                <child.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                                {child.showNew && (
                                  <span className="hidden lg:block absolute -mt-4 ml-4 h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" aria-hidden="true" />
                                )}
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="hidden lg:block">{child.label}</TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  );
                }
                return (
                  <div key={groupId}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(groupId)}
                      className={`nav-item w-full ${childActive ? "text-foreground" : ""}`}
                      aria-expanded={isGroupOpen}
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.showNew && (
                        <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold leading-none rounded bg-destructive text-destructive-foreground animate-pulse">
                          NEW
                        </span>
                      )}
                      <ChevronDown
                        className={`h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-transform ${isGroupOpen ? "rotate-0" : "-rotate-90"}`}
                        aria-hidden="true"
                      />
                    </button>
                    {isGroupOpen && (
                      <div className="mt-1 space-y-0.5 pl-1.5 border-l border-border/60 ml-3">
                        {item.children.map((child) => {
                          const isActive = location.pathname === child.href;
                          return (
                            <Link key={child.href} to={child.href} onClick={() => setSidebarOpen(false)}
                              className={`nav-item ${isActive ? "nav-item-active" : ""}`}
                              aria-current={isActive ? "page" : undefined}>
                              <child.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                              <span>{child.label}</span>
                              {child.showNew && (
                                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold leading-none rounded bg-destructive text-destructive-foreground animate-pulse">
                                  NEW
                                </span>
                              )}
                              {isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto" aria-hidden="true" />}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }
              const isActive = location.pathname === item.href;
              const linkEl = (
                <Link key={item.href} to={item.href} onClick={() => setSidebarOpen(false)}
                  className={`nav-item ${isActive ? "nav-item-active" : ""} ${collapsed ? "lg:justify-center lg:px-0 lg:gap-0" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  {...(item.tourId ? { "data-tour": item.tourId } : {})}>
                  <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                  <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
                  {item.showNew && !collapsed && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold leading-none rounded bg-destructive text-destructive-foreground animate-pulse">
                      NEW
                    </span>
                  )}
                  {item.showNew && collapsed && (
                    <span className="hidden lg:block absolute -mt-4 ml-4 h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" aria-hidden="true" />
                  )}
                  {isActive && !collapsed && <ChevronRight className="h-3.5 w-3.5 ml-auto" aria-hidden="true" />}
                </Link>
              );
              if (!collapsed) return linkEl;
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                  <TooltipContent side="right" className="hidden lg:block">{item.label}</TooltipContent>
                </Tooltip>
              );
              })
            )}
          </nav>
        </TooltipProvider>

        <div className={`border-t border-sidebar-border ${collapsed ? "lg:p-2 p-4" : "p-4"}`}>
          <button
            onClick={handleSignOut}
            className={`nav-item w-full text-muted-foreground hover:text-destructive ${collapsed ? "lg:justify-center lg:px-0 lg:gap-0" : ""}`}
            aria-label={t("auth.logout")}
            title={collapsed ? t("auth.logout") : undefined}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            <span className={collapsed ? "lg:hidden" : ""}>{t("auth.logout")}</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <header
          className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border min-h-16 flex items-center px-3 sm:px-6 gap-2 sm:gap-4"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
          role="banner"
        >
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-muted-foreground hover:text-foreground -ml-1 p-1" aria-label={t("common.openSidebar", "메뉴 열기")}>
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden lg:inline-flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label={collapsed ? t("common.expandSidebar", "사이드바 펼치기") : t("common.collapseSidebar", "사이드바 접기")}
            aria-expanded={!collapsed}
            title={collapsed ? t("common.expandSidebar", "사이드바 펼치기") : t("common.collapseSidebar", "사이드바 접기")}
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" aria-hidden="true" /> : <PanelLeftClose className="h-5 w-5" aria-hidden="true" />}
          </button>
          <div className="flex-1" />
          {/* <GuidedTourButton role={activeRole as "student" | "teacher" | "admin"} /> */}
          {effectiveRole !== "admin" && (
            <div data-tour="language-toggle"><LanguageToggle /></div>
          )}
          <RoleSwitcher />
          <div data-tour="notification-bell"><NotificationBell /></div>
          <div className="pl-2 sm:pl-3 border-l border-border" data-tour="user-profile">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex items-center gap-2 sm:gap-3 rounded-full pl-1 pr-2 sm:pr-3 py-1 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                aria-label={`${profile?.full_name || t("common.user")} ${t("common.menu", "메뉴")}`}
              >
                <div
                  className="h-9 w-9 rounded-full bg-accent flex items-center justify-center text-xs font-semibold text-accent-foreground overflow-hidden ring-1 ring-border"
                  role="img"
                  aria-label={profile?.full_name || t("common.user")}
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile?.full_name || t("common.user")}
                      className="h-full w-full object-cover"
                      fetchPriority="high"
                      decoding="async"
                    />
                  ) : (
                    <span aria-hidden="true">{initials}</span>
                  )}
                </div>
                <span className="hidden sm:inline text-sm font-medium text-foreground leading-none">
                  {profile?.full_name || t("common.user")}
                </span>
                <ChevronDown
                  className="hidden sm:inline h-3.5 w-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-foreground truncate">
                    {profile?.full_name || t("common.user")}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground truncate">
                    {roleLabel}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/mypage")} className="cursor-pointer">
                  <UserCircle className="h-4 w-4 mr-2" aria-hidden="true" />
                  {t("nav.myPage", "마이페이지")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4 mr-2" aria-hidden="true" />
                  {t("auth.logout", "로그아웃")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main
          className={contentClassName || "flex-1 min-w-0 p-4 sm:p-6 lg:p-8"}
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          role="main"
        >
          {children}
        </main>
      </div>

      {/* Show real-user Web Vitals only on admin pages */}
      {effectiveRole === "admin" && <WebVitalsBadge />}
    </div>
  );
};

export default DashboardLayout;
