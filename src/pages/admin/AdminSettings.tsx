import { useState, lazy, Suspense } from "react";
import { Settings, Bell, Shield, Building2, Plus, Pencil, Trash2, Palette, Users as UsersIcon, ToggleRight, CreditCard, EyeOff } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useEffect } from "react";
import { useUserRole } from "@/hooks/useUserRole";

const DemoPresetManager = lazy(() => import("@/components/admin/DemoPresetManager"));

interface GeneralSettingsForm {
  platform_name: string;
  default_language: string;
  timezone: string;
  notify_new_signup: boolean;
  notify_assignment_submit: boolean;
  notify_completion: boolean;
  min_password_length: number;
  session_expiry_hours: number;
  two_factor_auth: boolean;
  teacher_role_enabled: boolean;
  b2c_enabled: boolean;
}

const DEFAULT_FORM: GeneralSettingsForm = {
  platform_name: "WEBHEADS SaaS LMS",
  default_language: "ko",
  timezone: "Asia/Seoul",
  notify_new_signup: true,
  notify_assignment_submit: true,
  notify_completion: true,
  min_password_length: 8,
  session_expiry_hours: 24,
  two_factor_auth: false,
  teacher_role_enabled: true,
  b2c_enabled: true,
};

const AdminSettings = () => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useUserRole();
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<any>(null);
  const [deleteDeptId, setDeleteDeptId] = useState<string | null>(null);
  const [deptForm, setDeptForm] = useState({ name: "", name_en: "", code: "", parent_department_id: "", team_name: "" });
  const [form, setForm] = useState<GeneralSettingsForm>(DEFAULT_FORM);
  const [settingsRowId, setSettingsRowId] = useState<string | null>(null);
  const [hiddenNavKeys, setHiddenNavKeys] = useState<string[]>([]);
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);

  // Load existing site settings
  const { data: siteSettings } = useQuery({
    queryKey: ["site-settings-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (siteSettings) {
      setSettingsRowId(siteSettings.id);
      setForm({
        platform_name: (siteSettings as any).platform_name ?? DEFAULT_FORM.platform_name,
        default_language: (siteSettings as any).default_language ?? DEFAULT_FORM.default_language,
        timezone: (siteSettings as any).timezone ?? DEFAULT_FORM.timezone,
        notify_new_signup: (siteSettings as any).notify_new_signup ?? DEFAULT_FORM.notify_new_signup,
        notify_assignment_submit: (siteSettings as any).notify_assignment_submit ?? DEFAULT_FORM.notify_assignment_submit,
        notify_completion: (siteSettings as any).notify_completion ?? DEFAULT_FORM.notify_completion,
        min_password_length: (siteSettings as any).min_password_length ?? DEFAULT_FORM.min_password_length,
        session_expiry_hours: (siteSettings as any).session_expiry_hours ?? DEFAULT_FORM.session_expiry_hours,
        two_factor_auth: (siteSettings as any).two_factor_auth ?? DEFAULT_FORM.two_factor_auth,
        teacher_role_enabled: (siteSettings as any).teacher_role_enabled ?? DEFAULT_FORM.teacher_role_enabled,
        b2c_enabled: (siteSettings as any).b2c_enabled ?? DEFAULT_FORM.b2c_enabled,
      });
      setHiddenNavKeys(((siteSettings as any).hidden_nav_keys as string[] | null) ?? []);
    }
  }, [siteSettings]);

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      payload.hidden_nav_keys = hiddenNavKeys;
      if (settingsRowId) {
        const { error } = await supabase
          .from("site_settings")
          .update(payload)
          .eq("id", settingsRowId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("site_settings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(t("admin.settingsSaved", "설정이 저장되었습니다"));
      queryClient.invalidateQueries({ queryKey: ["site-settings-admin"] });
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      queryClient.invalidateQueries({ queryKey: ["site-settings-edit"] });
    },
    onError: (err: any) => toast.error(err.message ?? "저장 실패"),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments-all"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("*").order("display_order");
      return data || [];
    },
  });

  // Count members per department
  const { data: profiles = [] } = useQuery({
    queryKey: ["dept-member-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("department_id");
      return data || [];
    },
  });

  const memberCounts = new Map<string, number>();
  profiles.forEach((p: any) => {
    if (p.department_id) memberCounts.set(p.department_id, (memberCounts.get(p.department_id) || 0) + 1);
  });

  const createDeptMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { name: deptForm.name, name_en: deptForm.name_en || null, code: deptForm.code || null, team_name: deptForm.team_name || null };
      if (deptForm.parent_department_id) payload.parent_department_id = deptForm.parent_department_id;

      if (editingDept) {
        const { error } = await supabase.from("departments").update(payload).eq("id", editingDept.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("departments").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingDept ? t("admin.deptUpdated") : t("admin.deptCreated"));
      setDeptDialogOpen(false);
      setEditingDept(null);
      setDeptForm({ name: "", name_en: "", code: "", parent_department_id: "", team_name: "" });
      queryClient.invalidateQueries({ queryKey: ["departments-all"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteDeptMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("admin.deptDeleted"));
      setDeleteDeptId(null);
      queryClient.invalidateQueries({ queryKey: ["departments-all"] });
    },
  });

  const openEditDept = (dept: any) => {
    setEditingDept(dept);
    setDeptForm({ name: dept.name, name_en: dept.name_en || "", code: dept.code || "", parent_department_id: dept.parent_department_id || "", team_name: dept.team_name || "" });
    setDeptDialogOpen(true);
  };

  const openAddDept = () => {
    setEditingDept(null);
    setDeptForm({ name: "", name_en: "", code: "", parent_department_id: "", team_name: "" });
    setDeptDialogOpen(true);
  };

  // Build tree structure
  const topLevel = departments.filter((d: any) => !d.parent_department_id);
  const getChildren = (parentId: string) => departments.filter((d: any) => d.parent_department_id === parentId);

  // Sidebar menu visibility registry (must mirror DashboardLayout nav keys)
  type NavItem = { key: string; label: string };
  type NavCategory = { id: string; label: string; items: NavItem[] };
  type NavGroup = { role: string; roleLabel: string; categories: NavCategory[] };

  const NAV_REGISTRY: NavGroup[] = [
    {
      role: "admin",
      roleLabel: t("roles.admin", "관리자"),
      categories: [
        {
          id: "insights",
          label: t("nav.groupInsights", "인사이트·통계"),
          items: [
            { key: "admin.dashboard", label: t("nav.dashboard", "관리자 대시보드") },
            { key: "admin.traffic", label: t("nav.trafficMonitoring", "통계 현황") },
            { key: "admin.salesStats", label: t("nav.salesStats", "매출·주문 통계") },
            { key: "admin.globalDashboard", label: t("nav.globalDashboard", "글로벌 대시보드") },
          ],
        },
        {
          id: "members",
          label: t("nav.groupMembers", "회원·조직"),
          items: [
            { key: "admin.users", label: t("nav.learnerManagement", "학습자 관리") },
            { key: "admin.memberGroups", label: t("nav.memberGroups", "회원 그룹·등급") },
            { key: "admin.instructors", label: t("nav.instructorManagement", "강사 관리") },
            { key: "admin.branches", label: t("nav.branchManagement", "지점 관리") },
            { key: "admin.branchAdmins", label: t("nav.branchAdminMgmt", "중간관리자 관리") },
            { key: "admin.privacyAudit", label: t("nav.privacyAudit", "개인정보 감사") },
          ],
        },
        {
          id: "content",
          label: t("nav.groupContent", "강의·콘텐츠"),
          items: [
            { key: "admin.courses", label: t("nav.courseManagement", "강의 관리") },
            { key: "admin.tracks", label: t("nav.trackManagement", "학습 트랙 관리") },
            { key: "admin.contentLibrary", label: t("nav.contentLibrary", "콘텐츠 라이브러리") },
            { key: "admin.videos", label: t("nav.videoManagement", "동영상 관리") },
            { key: "admin.microLearning", label: t("nav.microLearning", "마이크로러닝") },
            { key: "admin.cms", label: t("nav.cms", "CMS · 아티클") },
          ],
        },
        {
          id: "commerce",
          label: t("nav.groupCommerce", "판매·결제"),
          items: [
            { key: "admin.saleStatus", label: t("nav.saleStatus", "상품 판매 상태") },
            { key: "admin.courseOptions", label: t("nav.courseOptions", "강의 판매·운영 옵션") },
            { key: "admin.orders", label: t("nav.paymentManagement", "결제 관리") },
            { key: "admin.checkoutFields", label: t("nav.checkoutFields", "결제 추가정보") },
            { key: "admin.subscriptions", label: t("nav.subscriptions", "정기구독 관리") },
            { key: "admin.market", label: t("nav.market", "도서·마켓 관리") },
            { key: "admin.points", label: t("nav.pointsCoupons", "포인트·자동쿠폰") },
            { key: "admin.refunds", label: t("nav.refunds", "환불 관리") },
            { key: "admin.settlements", label: t("nav.settlements", "강사 정산") },
          ],
        },
        {
          id: "operations",
          label: t("nav.groupOperations", "학습 운영"),
          items: [
            { key: "admin.enrollments", label: t("nav.enrollmentManagement", "수강 승인") },
            { key: "admin.courseOps", label: t("nav.courseOps", "수강 연장·일시정지") },
            { key: "admin.learning", label: t("nav.learningManagement", "학습 관리") },
            { key: "admin.attendance", label: t("nav.attendanceManagement", "출석 관리") },
            { key: "admin.offlineClasses", label: t("nav.offlineClasses", "집합강의·연수") },
            { key: "admin.videoSessions", label: t("nav.videoSessions", "화상 세션") },
            { key: "admin.aiProgressPrediction", label: t("nav.aiProgressPrediction", "AI 진도 예측") },
          ],
        },
        {
          id: "assessment",
          label: t("nav.groupAssessment", "평가·자격"),
          items: [
            { key: "admin.assessments", label: t("nav.assessmentStatus", "평가 현황") },
            { key: "admin.questionBank", label: t("nav.questionBank", "문제은행") },
            { key: "admin.corrections", label: t("nav.correctionsMgmt", "첨삭 관리") },
            { key: "admin.aiFeedback", label: t("nav.aiFeedback", "AI 과제 피드백") },
            { key: "admin.englishCorrection", label: t("nav.englishCorrection", "AI 영어 교정") },
            { key: "admin.completion", label: t("nav.completionManagement", "수료 관리") },
            { key: "admin.bulkCertificates", label: t("nav.bulkCertificates", "수료증 일괄 발급") },
            { key: "admin.qualifications", label: t("nav.qualifications", "자격검정 관리") },
          ],
        },
        {
          id: "communication",
          label: t("nav.groupCommunication", "커뮤니케이션"),
          items: [
            { key: "admin.messaging", label: t("nav.messaging", "발송 관리") },
            { key: "admin.notifications", label: t("nav.notificationManagement", "알림 관리") },
            { key: "admin.announcements", label: t("nav.announcementManagement", "공지사항 관리") },
            { key: "admin.board", label: t("nav.boardManagement", "게시판 관리") },
            { key: "admin.community", label: t("nav.communityManagement", "커뮤니티 관리") },
            { key: "admin.surveys", label: t("nav.surveyManagement", "설문 관리") },
          ],
        },
        {
          id: "site",
          label: t("nav.groupSite", "사이트·디자인"),
          items: [
            { key: "admin.designManager", label: t("nav.designManager", "디자인 관리") },
            { key: "admin.siteSettings", label: t("nav.siteSettings", "사이트 설정") },
          ],
        },
        {
          id: "ops",
          label: t("admin.navCat.opsHub", "산학프로젝트"),
          items: [
            { key: "admin.ops.beneficiaries", label: t("nav.opsBeneficiaries", "수혜학생 DB") },
            { key: "admin.ops.programs", label: t("nav.opsPrograms", "프로그램 관리") },
            { key: "admin.ops.projects", label: t("nav.opsProjects", "산학프로젝트") },
            { key: "admin.ops.evidence", label: t("nav.opsEvidence", "증빙자료 제출") },
            { key: "admin.ops.surveys", label: t("nav.opsSurveys", "만족도 조사") },
            { key: "admin.ops.certificates", label: t("nav.opsCertificates", "수료증/참가확인서") },
            { key: "admin.ops.stats", label: t("nav.opsStats", "운영 통계") },
          ],
        },
        {
          id: "closed_lms",
          label: t("nav.groupClosedLms", "폐쇄형 LMS"),
          items: [
            { key: "admin.closedLms.invitations", label: t("nav.closedLmsInvitations", "수강자 일괄 초대") },
            { key: "admin.closedLms.logs", label: t("nav.closedLmsLogs", "초대 발송 현황") },
            { key: "admin.closedLms.sms", label: t("nav.closedLmsSms", "SMS 설정") },
          ],
        },
        {
          id: "i18n",
          label: t("nav.groupI18n", "다국어"),
          items: [
            { key: "admin.i18nDashboard", label: t("nav.i18nDashboard", "다국어 관리") },
            { key: "admin.translationGlossary", label: t("nav.translationGlossary", "다국어 용어 관리") },
          ],
        },
        {
          id: "system",
          label: t("nav.groupSystem", "시스템"),
          items: [
            { key: "admin.settings", label: t("nav.settings", "시스템 설정") },
            { key: "admin.moduleSettings", label: t("nav.moduleSettings", "기능 모듈") },
            { key: "admin.apiClients", label: t("nav.apiClients", "API 클라이언트") },
            { key: "admin.systemInfo", label: t("nav.systemInfo", "시스템 정보") },
            { key: "admin.manual", label: t("nav.manual", "사용자 매뉴얼") },
          ],
        },
      ],
    },
    {
      role: "branchAdmin",
      roleLabel: t("roles.branch_admin", "중간관리자"),
      categories: [
        {
          id: "branchAdmin.all",
          label: t("admin.navCat.menu", "메뉴"),
          items: [
            { key: "branchAdmin.dashboard", label: t("nav.dashboard", "대시보드") },
            { key: "branchAdmin.tracks", label: t("nav.branchAdminTracks", "지점 트랙 관리") },
            { key: "branchAdmin.staff", label: t("nav.branchAdminStaff", "지점 회원 관리") },
            { key: "branchAdmin.assignments", label: t("nav.branchAdminAssign", "트랙 배정") },
            { key: "branchAdmin.stats", label: t("nav.branchAdminStats", "지점 학습 통계") },
            { key: "branchAdmin.certificates", label: t("nav.branchAdminCertificates", "수료증 일괄 발급") },
            { key: "branchAdmin.mypage", label: t("nav.myPage", "마이페이지") },
          ],
        },
      ],
    },
    {
      role: "teacher",
      roleLabel: t("roles.teacher", "강사"),
      categories: [
        {
          id: "teacher.all",
          label: t("admin.navCat.menu", "메뉴"),
          items: [
            { key: "teacher.dashboard", label: t("nav.dashboard", "대시보드") },
            { key: "teacher.assignments", label: t("nav.assignmentManagement", "과제 관리") },
            { key: "teacher.corrections", label: t("nav.correctionsMgmt", "첨삭 관리") },
            { key: "teacher.students", label: t("nav.studentManagement", "학생 관리") },
            { key: "teacher.notifications", label: t("nav.notificationManagement", "알림 관리") },
            { key: "teacher.announcements", label: t("nav.announcementManagement", "공지사항 관리") },
            { key: "teacher.board", label: t("nav.boardManagement", "게시판 관리") },
            { key: "teacher.attendance", label: t("nav.attendanceManagement", "출석 관리") },
            { key: "teacher.videoSessions", label: t("nav.videoSessions", "화상 세션") },
            { key: "teacher.cms", label: t("nav.cms", "CMS · 아티클") },
            { key: "teacher.englishCorrection", label: t("nav.englishCorrection", "AI 영어 교정") },
          ],
        },
      ],
    },
    {
      role: "student",
      roleLabel: t("roles.student", "학습자"),
      categories: [
        {
          id: "student.all",
          label: t("admin.navCat.menu", "메뉴"),
          items: [
            { key: "student.dashboard", label: t("nav.dashboard", "대시보드") },
            { key: "student.catalog", label: t("nav.courseCatalog", "강의 카탈로그") },
            { key: "student.myCourses", label: t("nav.myCourses", "내 강의") },
            { key: "student.videoSessions", label: t("nav.videoSessions", "화상 세션") },
            { key: "student.notes", label: t("nav.myNotes", "내 학습 메모") },
            { key: "student.microLearning", label: t("nav.microLearning", "마이크로러닝") },
            { key: "student.qualifications", label: t("nav.qualifications", "자격검정") },
            { key: "student.englishCorrection", label: t("nav.englishCorrection", "AI 영어 교정") },
            { key: "student.articles", label: t("nav.articles", "아티클") },
            { key: "student.assignments", label: t("nav.assignments", "과제") },
            { key: "student.corrections", label: t("nav.corrections", "에세이(첨삭) 작성") },
            { key: "student.achievements", label: t("nav.achievements", "성취") },
            { key: "student.programs", label: t("nav.programs", "프로그램 신청") },
            { key: "student.evidence", label: t("nav.evidence", "증빙자료 제출") },
            { key: "student.certificates", label: t("nav.certificates", "내 수료증") },
            { key: "student.surveys", label: t("nav.surveys", "만족도 조사") },
            { key: "student.communication", label: t("nav.groupCommunication", "커뮤니케이션") },
            { key: "student.announcements", label: t("nav.announcements", "공지사항") },
            { key: "student.board", label: t("nav.board", "게시판") },
            { key: "student.community", label: t("nav.community", "커뮤니티") },
            { key: "student.mypage", label: t("nav.myPage", "마이페이지") },
          ],
        },
      ],
    },
  ];

  const toggleNavKey = (key: string, hidden: boolean) => {
    const set = new Set(hiddenNavKeys);
    if (hidden) set.add(key);
    else set.delete(key);
    const next = Array.from(set);
    setHiddenNavKeys(next);
    // Persist immediately so the sidebar reflects the change without requiring a manual Save.
    if (settingsRowId) {
      supabase
        .from("site_settings")
        .update({ hidden_nav_keys: next })
        .eq("id", settingsRowId)
        .then(({ error }) => {
          if (error) {
            toast.error(error.message ?? "저장 실패");
            return;
          }
          queryClient.invalidateQueries({ queryKey: ["site-settings-admin"] });
          queryClient.invalidateQueries({ queryKey: ["site-settings"] });
          queryClient.invalidateQueries({ queryKey: ["site-settings-edit"] });
        });
    }
  };

  const renderDeptRow = (dept: any, level: number = 0) => {
    const children = getChildren(dept.id);
    const count = memberCounts.get(dept.id) || 0;
    return (
      <div key={dept.id}>
        <div className={`flex items-center justify-between py-3 px-4 hover:bg-accent/30 transition-colors border-b border-border`}>
          <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 24}px` }}>
            {level > 0 && <span className="text-muted-foreground text-xs">└</span>}
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {isEn ? dept.name_en || dept.name : dept.name}
            </span>
            {dept.code && <span className="text-[10px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{dept.code}</span>}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{count}{isEn ? "" : "명"}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDept(dept)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteDeptId(dept.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {children.map((c: any) => renderDeptRow(c, level + 1))}
      </div>
    );
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2"><Settings className="h-6 w-6" aria-hidden="true" />{t("admin.settingsTitle")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("admin.settingsDesc")}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPresetDialogOpen(true)}
            className="gap-2 border-dashed"
            title="WEBHEADS 전용 도구"
          >
            <Palette className="h-4 w-4" />
            <span>{t("admin.demoPresets", "데모 프리셋")}</span>
            <span className="ml-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">WEBHEADS</span>
          </Button>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general">{t("admin.generalSettings")}</TabsTrigger>
            <TabsTrigger value="departments">{t("admin.deptManagement")}</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-8">
            {/* General */}
            <div className="stat-card space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <Settings className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-base font-semibold text-foreground">{t("admin.generalSettings")}</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <label className="text-sm text-foreground">{t("admin.platformName")}</label>
                  <Input
                    value={form.platform_name}
                    onChange={(e) => setForm({ ...form, platform_name: e.target.value })}
                    className="w-64 h-9 rounded-xl text-sm text-right"
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <label className="text-sm text-foreground">{t("admin.defaultLanguage")}</label>
                  <Select value={form.default_language} onValueChange={(v) => setForm({ ...form, default_language: v })}>
                    <SelectTrigger className="w-64 h-9 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ko">한국어</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <label className="text-sm text-foreground">{t("admin.timezone")}</label>
                  <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })}>
                    <SelectTrigger className="w-64 h-9 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Seoul">Asia/Seoul (UTC+9)</SelectItem>
                      <SelectItem value="Asia/Tokyo">Asia/Tokyo (UTC+9)</SelectItem>
                      <SelectItem value="America/Los_Angeles">America/Los_Angeles (UTC-8)</SelectItem>
                      <SelectItem value="America/New_York">America/New_York (UTC-5)</SelectItem>
                      <SelectItem value="Europe/London">Europe/London (UTC+0)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Notification */}
            <div className="stat-card space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-base font-semibold text-foreground">{t("admin.notificationSettings")}</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-foreground">{t("admin.newSignupNotif")}</label>
                  <Switch checked={form.notify_new_signup} onCheckedChange={(v) => setForm({ ...form, notify_new_signup: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-foreground">{t("admin.assignmentSubmitNotif")}</label>
                  <Switch checked={form.notify_assignment_submit} onCheckedChange={(v) => setForm({ ...form, notify_assignment_submit: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-foreground">{t("admin.completionNotif")}</label>
                  <Switch checked={form.notify_completion} onCheckedChange={(v) => setForm({ ...form, notify_completion: v })} />
                </div>
              </div>
            </div>

            {/* Security */}
            <div className="stat-card space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-base font-semibold text-foreground">{t("admin.securitySettings")}</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <label className="text-sm text-foreground">{t("admin.minPasswordLength")}</label>
                  <Input
                    type="number"
                    min={6}
                    max={32}
                    value={form.min_password_length}
                    onChange={(e) => setForm({ ...form, min_password_length: parseInt(e.target.value) || 8 })}
                    className="w-64 h-9 rounded-xl text-sm text-right"
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <label className="text-sm text-foreground">{t("admin.sessionExpiry")}</label>
                  <Select value={String(form.session_expiry_hours)} onValueChange={(v) => setForm({ ...form, session_expiry_hours: parseInt(v) })}>
                    <SelectTrigger className="w-64 h-9 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1h</SelectItem>
                      <SelectItem value="6">6h</SelectItem>
                      <SelectItem value="12">12h</SelectItem>
                      <SelectItem value="24">24h</SelectItem>
                      <SelectItem value="72">72h (3일)</SelectItem>
                      <SelectItem value="168">168h (7일)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-foreground">{t("admin.twoFactorAuth")}</label>
                  <Switch checked={form.two_factor_auth} onCheckedChange={(v) => setForm({ ...form, two_factor_auth: v })} />
                </div>
              </div>
            </div>

            {/* Feature Toggles */}
            <div className="stat-card space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <ToggleRight className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-base font-semibold text-foreground">
                  {t("admin.featureSettings", "기능 설정")}
                </h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-border">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <label className="text-sm font-medium text-foreground">
                        {t("admin.b2cFeature", "B2C 판매 기능")}
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t(
                        "admin.b2cFeatureDesc",
                        "외부 학습자 대상 결제·판매 기능입니다. 활성화 시 사이드바의 '결제 관리' 메뉴, 관리자 대시보드의 'B2C 매출 현황' 위젯, 강의 편집 화면의 'B2C 판매 설정' 영역이 노출됩니다. 사내 전용 플랫폼으로 운영하는 경우 비활성화하세요."
                      )}
                    </p>
                  </div>
                  <Switch
                    checked={form.b2c_enabled}
                    onCheckedChange={(v) => setForm({ ...form, b2c_enabled: v })}
                  />
                </div>
              </div>
            </div>

            {/* Role Visibility */}
            <div className="stat-card space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <UsersIcon className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-base font-semibold text-foreground">
                  {t("admin.roleVisibility", "역할 표시 설정")}
                </h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-border">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <UsersIcon className="h-4 w-4 text-muted-foreground" />
                      <label className="text-sm font-medium text-foreground">
                        {t("admin.teacherRoleEnabled", "강사 역할 사용")}
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                      {t(
                        "admin.teacherRoleEnabledDesc",
                        "비활성화하면 모든 사용자에게 강사 메뉴, 강사 대시보드, 역할 전환의 강사 옵션이 숨겨집니다."
                      )}
                    </p>
                  </div>
                  <Switch
                    checked={form.teacher_role_enabled}
                    onCheckedChange={(v) => setForm({ ...form, teacher_role_enabled: v })}
                  />
                </div>
              </div>
            </div>

            {/* Sidebar Menu Visibility */}
            {(
              <div className="stat-card space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-border">
                  <EyeOff className="h-5 w-5 text-muted-foreground" />
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-foreground">
                      {t("admin.menuVisibility", "사이드바 메뉴 숨김 설정")}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t(
                        "admin.menuVisibilityDesc",
                        "역할별 사이드바 메뉴를 개별적으로 숨길 수 있습니다. 숨김 처리된 메뉴는 모든 사용자에게 노출되지 않습니다. (슈퍼관리자 전용)"
                      )}
                    </p>
                  </div>
                </div>
                <div className="space-y-6">
                  {NAV_REGISTRY.map((group) => {
                    const allItems = group.categories.flatMap((c) => c.items);
                    const hiddenCount = allItems.filter((i) => hiddenNavKeys.includes(i.key)).length;
                    return (
                      <div key={group.role} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {group.roleLabel}
                          </h3>
                          <span className="text-[11px] text-muted-foreground">
                            {hiddenCount}/{allItems.length} {t("admin.menuVisibilityHidden", "숨김")}
                          </span>
                        </div>
                        <Accordion type="multiple" className="rounded-lg border border-border divide-y-2 divide-border/80">
                         {group.categories.map((category) => {
                            const catHidden = category.items.filter((i) => hiddenNavKeys.includes(i.key)).length;
                            const allHidden = catHidden === category.items.length && category.items.length > 0;
                            return (
                              <AccordionItem key={category.id} value={category.id} className="border-0">
                                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                                  <div className="flex items-center justify-between flex-1 gap-3 min-w-0">
                                    <span className={`text-sm font-medium truncate ${allHidden ? "text-muted-foreground line-through" : "text-foreground"}`}>
                                      {category.label}
                                      {allHidden && (
                                        <span className="ml-2 text-[10px] font-normal not-italic no-underline text-muted-foreground">
                                          ({t("admin.categoryHiddenNote", "사이드바에서 분류 자체 숨김")})
                                        </span>
                                      )}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                      {catHidden}/{category.items.length} {t("admin.menuVisibilityHidden", "숨김")}
                                    </span>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="pb-0">
                                  <div className="divide-y-2 divide-border/80 border-t-2 border-border/80">
                                    {category.items.map((item) => {
                                      const hidden = hiddenNavKeys.includes(item.key);
                                      return (
                                        <div
                                          key={item.key}
                                          className="flex items-center justify-between px-4 py-2.5 bg-muted/20"
                                        >
                                          <span
                                            className={`text-sm ${
                                              hidden ? "text-muted-foreground line-through" : "text-foreground"
                                            }`}
                                          >
                                            {item.label}
                                          </span>
                                          <div className="flex items-center gap-2">
                                            <span className="text-[11px] text-muted-foreground w-10 text-right">
                                              {hidden
                                                ? t("admin.menuVisibilityHidden", "숨김")
                                                : t("admin.menuVisibilityShown", "표시")}
                                            </span>
                                            <Switch
                                              checked={!hidden}
                                              onCheckedChange={(checked) => toggleNavKey(item.key, !checked)}
                                              aria-label={item.label}
                                            />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                className="rounded-xl"
                onClick={() => saveSettingsMutation.mutate()}
                disabled={saveSettingsMutation.isPending}
              >
                {saveSettingsMutation.isPending ? t("common.saving", "저장 중...") : t("admin.saveSettings")}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="departments" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">{t("admin.deptManagement")}</h2>
                <p className="text-xs text-muted-foreground mt-1">{t("admin.deptManagementDesc")}</p>
              </div>
              <Button className="rounded-xl gap-2" onClick={openAddDept}>
                <Plus className="h-4 w-4" /> {t("admin.addDepartment")}
              </Button>
            </div>
            <div className="stat-card !p-0 overflow-hidden">
              {topLevel.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">{t("admin.noDepartments")}</p>
              ) : (
                topLevel.map((d: any) => renderDeptRow(d))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* WEBHEADS-only: Demo Preset Manager */}
      <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              {t("admin.demoPresets", "데모 프리셋")}
              <span className="ml-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">WEBHEADS</span>
            </DialogTitle>
            <DialogDescription>
              플랫폼 기본 기능이 아닌 WEBHEADS 운영팀 전용 데모/PT 도구입니다.
            </DialogDescription>
          </DialogHeader>
          <Suspense fallback={<div className="py-8 text-center text-sm text-muted-foreground">로딩 중...</div>}>
            <DemoPresetManager />
          </Suspense>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Department Dialog */}
      <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDept ? t("admin.editDept") : t("admin.addDepartment")}</DialogTitle>
            <DialogDescription>{t("admin.deptManagementDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("admin.deptName")}</Label>
              <Input value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>{t("admin.deptNameEn")}</Label>
              <Input value={deptForm.name_en} onChange={(e) => setDeptForm({ ...deptForm, name_en: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>{t("admin.teamName")}</Label>
              <Input value={deptForm.team_name} onChange={(e) => setDeptForm({ ...deptForm, team_name: e.target.value })} placeholder={t("admin.teamName")} className="mt-1" />
            </div>
            <div>
              <Label>{t("admin.deptCode")}</Label>
              <Input value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })} placeholder="MKT" className="mt-1" />
            </div>
            <div>
              <Label>{t("admin.parentDept")}</Label>
              <Select value={deptForm.parent_department_id || "none"} onValueChange={(v) => setDeptForm({ ...deptForm, parent_department_id: v === "none" ? "" : v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("admin.noParent")}</SelectItem>
                  {departments.filter((d: any) => d.id !== editingDept?.id).map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{isEn ? d.name_en || d.name : d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full rounded-xl" onClick={() => createDeptMutation.mutate()} disabled={!deptForm.name || createDeptMutation.isPending}>
              {createDeptMutation.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteDeptId} onOpenChange={() => setDeleteDeptId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.deleteDept")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.deleteDeptConfirm", { name: departments.find((d: any) => d.id === deleteDeptId)?.name || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteDeptId && deleteDeptMutation.mutate(deleteDeptId)}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default AdminSettings;
