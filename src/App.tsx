import { Suspense } from "react";
import { lazyWithRetry as lazy } from "@/lib/lazyWithRetry";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProvider } from "@/contexts/UserContext";
import { DemoPresetProvider } from "@/contexts/DemoPresetContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import TeacherRoute from "@/components/TeacherRoute";
import TrafficLogger from "@/components/TrafficLogger";
import { FullScreenSkeleton } from "@/components/PageSkeletons";
import StorefrontGate from "@/components/StorefrontGate";
import AppUpdateBanner from "@/components/AppUpdateBanner";
import RouteReporter from "@/components/RouteReporter";
import AdminAssistantFAB from "@/components/admin/AdminAssistantFAB";
import FeatureGate from "@/components/ops/FeatureGate";

// Skeleton loading fallback (no spinner)
const PageLoader = () => <FullScreenSkeleton />;

// ── Lazy-loaded pages ──────────────────────────────────
const RoleBasedRedirect = lazy(() => import("@/components/RoleBasedRedirect"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Student
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const StudentCourses = lazy(() => import("./pages/student/StudentCourses"));
const StudentAssignments = lazy(() => import("./pages/student/StudentAssignments"));
const StudentAchievements = lazy(() => import("./pages/student/StudentAchievements"));
const CourseCatalog = lazy(() => import("./pages/student/CourseCatalog"));
const MyPage = lazy(() => import("./pages/student/MyPage"));
const StudentAnnouncements = lazy(() => import("./pages/student/StudentAnnouncements"));
const StudentBoard = lazy(() => import("./pages/student/StudentBoard"));
const StudentCommunity = lazy(() => import("./pages/student/StudentCommunity"));
const CommunityMemberProfile = lazy(() => import("./pages/community/MemberProfile"));
const CommunityMyFeed = lazy(() => import("./pages/community/MyFeed"));
const CommunityPostDetail = lazy(() => import("./pages/community/PostDetail"));
const CommunityRanking = lazy(() => import("./pages/community/Ranking"));
const StudentTracks = lazy(() => import("./pages/student/StudentTracks"));
const StudentNotes = lazy(() => import("./pages/student/StudentNotes"));
const StudentArticles = lazy(() => import("./pages/student/StudentArticles"));
const StudentArticleDetail = lazy(() => import("./pages/student/StudentArticleDetail"));
const EnglishCorrection = lazy(() => import("./pages/student/EnglishCorrection"));
const StudentCorrections = lazy(() => import("./pages/student/StudentCorrections"));
const CorrectionsQueue = lazy(() => import("./pages/corrections/CorrectionsQueue"));
const CorrectionDetail = lazy(() => import("./pages/corrections/CorrectionDetail"));

// Teacher
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard"));
const TeacherCourses = lazy(() => import("./pages/teacher/TeacherCourses"));
const TeacherAssignments = lazy(() => import("./pages/teacher/TeacherAssignments"));
const CreateCourse = lazy(() => import("./pages/teacher/CreateCourse"));
const TeacherStudents = lazy(() => import("./pages/teacher/TeacherStudents"));
const TeacherStudentDetail = lazy(() => import("./pages/teacher/TeacherStudentDetail"));
const TeacherNotifications = lazy(() => import("./pages/teacher/TeacherNotifications"));
const TeacherAnnouncements = lazy(() => import("./pages/teacher/TeacherAnnouncements"));

// Admin
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminUserDetail = lazy(() => import("./pages/admin/AdminUserDetail"));
const AdminCourses = lazy(() => import("./pages/admin/AdminCourses"));
const AdminSaleStatus = lazy(() => import("./pages/admin/AdminSaleStatus"));
const AdminContentLibrary = lazy(() => import("./pages/admin/AdminContentLibrary"));
const AdminCourseOptions = lazy(() => import("./pages/admin/AdminCourseOptions"));
const AdminCourseOps = lazy(() => import("./pages/admin/AdminCourseOps"));
const AdminMemberGroups = lazy(() => import("./pages/admin/AdminMemberGroups"));
const AdminRefunds = lazy(() => import("./pages/admin/AdminRefunds"));
const AdminMessaging = lazy(() => import("./pages/admin/AdminMessaging"));
const AdminPoints = lazy(() => import("./pages/admin/AdminPoints"));
const AdminPrivacyAudit = lazy(() => import("./pages/admin/AdminPrivacyAudit"));
const AdminSalesStats = lazy(() => import("./pages/admin/AdminSalesStats"));
const AdminCheckoutFields = lazy(() => import("./pages/admin/AdminCheckoutFields"));
const AdminSubscriptions = lazy(() => import("./pages/admin/AdminSubscriptions"));
const AdminMarket = lazy(() => import("./pages/admin/AdminMarket"));
const AdminMicroLearning = lazy(() => import("./pages/admin/AdminMicroLearning"));
const AdminOfflineClasses = lazy(() => import("./pages/admin/AdminOfflineClasses"));
const AdminDesignManager = lazy(() => import("./pages/admin/AdminDesignManager"));
const AdminQualifications = lazy(() => import("./pages/admin/AdminQualifications"));
const AdminSettlements = lazy(() => import("./pages/admin/AdminSettlements"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const ApiClients = lazy(() => import("./pages/admin/ApiClients"));
const ApiDocs = lazy(() => import("./pages/ApiDocs"));
const OAuthAuthorize = lazy(() => import("./pages/OAuthAuthorize"));
const AdminSystemInfo = lazy(() => import("./pages/admin/AdminSystemInfo"));
const AdminManual = lazy(() => import("./pages/admin/AdminManual"));
const AdminLearning = lazy(() => import("./pages/admin/AdminLearning"));
const AdminAttendance = lazy(() => import("./pages/admin/AdminAttendance"));
const AdminCompletion = lazy(() => import("./pages/admin/AdminCompletion"));
const AdminTraffic = lazy(() => import("./pages/admin/AdminTraffic"));
const AdminAssessmentsStatus = lazy(() => import("./pages/admin/AdminAssessmentsStatus"));
const AdminQuestionBank = lazy(() => import("./pages/admin/AdminQuestionBank"));
const AdminAIQuestionGen = lazy(() => import("./pages/admin/AdminAIQuestionGen"));
const AdminAIProgressPrediction = lazy(() => import("./pages/admin/AdminAIProgressPrediction"));
const AdminAIFeedback = lazy(() => import("./pages/admin/AdminAIFeedback"));
const AdminCmsArticles = lazy(() => import("./pages/admin/AdminCmsArticles"));
const AdminBranches = lazy(() => import("./pages/admin/AdminBranches"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const AdminAnnouncements = lazy(() => import("./pages/admin/AdminAnnouncements"));
const AdminBoard = lazy(() => import("./pages/admin/AdminBoard"));
const AdminCommunity = lazy(() => import("./pages/admin/AdminCommunity"));
const AdminSurveys = lazy(() => import("./pages/admin/AdminSurveys"));
const AdminVideos = lazy(() => import("./pages/admin/AdminVideos"));
const AdminInstructors = lazy(() => import("./pages/admin/AdminInstructors"));
const AdminEnrollments = lazy(() => import("./pages/admin/AdminEnrollments"));
const AdminBanners = lazy(() => import("./pages/admin/AdminBanners"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminCoupons = lazy(() => import("./pages/admin/AdminCoupons"));
const AdminSiteSettings = lazy(() => import("./pages/admin/AdminSiteSettings"));
const AdminTracks = lazy(() => import("./pages/admin/AdminTracks"));
const AdminGlobalDashboard = lazy(() => import("./pages/admin/AdminGlobalDashboard"));
const AdminI18nDashboard = lazy(() => import("./pages/admin/AdminI18nDashboard"));
const AdminTranslationGlossary = lazy(() => import("./pages/admin/AdminTranslationGlossary"));

// Dept Admin
const DeptAdminDashboard = lazy(() => import("./pages/DeptAdminDashboard"));

// Branch Admin (지점 중간관리자)
const BranchAdminDashboard = lazy(() => import("./pages/branchAdmin/BranchAdminDashboard"));
const BranchAdminTracks = lazy(() => import("./pages/branchAdmin/BranchAdminTracks"));
const BranchAdminStaff = lazy(() => import("./pages/branchAdmin/BranchAdminStaff"));
const BranchAdminAssignments = lazy(() => import("./pages/branchAdmin/BranchAdminAssignments"));
const BranchAdminStats = lazy(() => import("./pages/branchAdmin/BranchAdminStats"));
const BranchAdminCertificates = lazy(() => import("./pages/branchAdmin/BranchAdminCertificates"));
const AdminBranchAdmins = lazy(() => import("./pages/admin/AdminBranchAdmins"));

// Admin · Ops (산학프로젝트)
const AdminBeneficiaries = lazy(() => import("./pages/admin/ops/AdminBeneficiaries"));
const AdminPrograms = lazy(() => import("./pages/admin/ops/AdminPrograms"));
const AdminProgramDetail = lazy(() => import("./pages/admin/ops/AdminProgramDetail"));
const AdminOpsProjects = lazy(() => import("./pages/admin/ops/AdminOpsProjects"));
const AdminOpsProjectDetail = lazy(() => import("./pages/admin/ops/AdminOpsProjectDetail"));
const AdminEvidence = lazy(() => import("./pages/admin/ops/AdminEvidence"));
const AdminOpsSurveys = lazy(() => import("./pages/admin/ops/AdminOpsSurveys"));
const AdminOpsCertificates = lazy(() => import("./pages/admin/ops/AdminOpsCertificates"));
const AdminOpsStats = lazy(() => import("./pages/admin/ops/AdminOpsStats"));
const AdminModuleSettings = lazy(() => import("./pages/admin/ops/AdminModuleSettings"));
const BranchAdminRoute = lazy(() => import("./components/BranchAdminRoute"));
const StudentPrograms = lazy(() => import("./pages/student/StudentPrograms"));
const StudentCertificates = lazy(() => import("./pages/student/StudentCertificates"));
const StudentEvidence = lazy(() => import("./pages/student/StudentEvidence"));
const StudentSurveys = lazy(() => import("./pages/student/StudentSurveys"));
const VerifyCertificate = lazy(() => import("./pages/public/VerifyCertificate"));

// Video Sessions
const VideoSessionsManage = lazy(() => import("./pages/video/VideoSessionsManage"));
const VideoSessionsStudent = lazy(() => import("./pages/video/VideoSessionsStudent"));
const VideoRoom = lazy(() => import("./pages/video/VideoRoom"));

// Course Detail & Player
const CourseDetail = lazy(() => import("./pages/CourseDetail"));
const ContentPlayer = lazy(() => import("./pages/ContentPlayer"));
const AssessmentPage = lazy(() => import("./pages/AssessmentPage"));
const CourseRedirect = lazy(() => import("./components/CourseRedirect"));
const ContentRedirect = lazy(() => import("./components/ContentRedirect"));

// B2C Store
const StorefrontHome = lazy(() => import("./pages/store/StorefrontHome"));
const StorefrontCatalog = lazy(() => import("./pages/store/StorefrontCatalog"));
const StorefrontCourseDetail = lazy(() => import("./pages/store/StorefrontCourseDetail"));
const StorefrontBooks = lazy(() => import("./pages/store/StorefrontBooks"));
const StorefrontSubscriptions = lazy(() => import("./pages/store/StorefrontSubscriptions"));
const StorefrontClasses = lazy(() => import("./pages/store/StorefrontClasses"));
const CartPage = lazy(() => import("./pages/store/CartPage"));
const CheckoutPage = lazy(() => import("./pages/store/CheckoutPage"));
const CheckoutSuccess = lazy(() => import("./pages/store/CheckoutSuccess"));
const CheckoutFail = lazy(() => import("./pages/store/CheckoutFail"));
const Community = lazy(() => import("./pages/Community"));

// Closed LMS
const AdminInvitations = lazy(() => import("./pages/admin/closedLms/AdminInvitations"));
const AdminInvitationLogs = lazy(() => import("./pages/admin/closedLms/AdminInvitationLogs"));
const AdminSmsSettings = lazy(() => import("./pages/admin/closedLms/AdminSmsSettings"));
const OneTimeLogin = lazy(() => import("./pages/auth/OneTimeLogin"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <UserProvider>
      <DemoPresetProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <TrafficLogger />
          <RouteReporter />
          <AppUpdateBanner />
          <AdminAssistantFAB />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public Store */}
              <Route path="/" element={<StorefrontGate><StorefrontHome /></StorefrontGate>} />
              <Route path="/store" element={<StorefrontGate><StorefrontHome /></StorefrontGate>} />
              <Route path="/store/courses" element={<StorefrontGate><StorefrontCatalog /></StorefrontGate>} />
              <Route path="/store/courses/:courseId" element={<StorefrontGate><StorefrontCourseDetail /></StorefrontGate>} />
              <Route path="/community" element={<StorefrontGate><Community /></StorefrontGate>} />

              {/* Auth */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/auth/otl" element={<OneTimeLogin />} />

              {/* Closed LMS (admin only) */}
              <Route path="/admin/invitations" element={<AdminRoute><AdminInvitations /></AdminRoute>} />
              <Route path="/admin/invitations/logs" element={<AdminRoute><AdminInvitationLogs /></AdminRoute>} />
              <Route path="/admin/settings/sms" element={<AdminRoute><AdminSmsSettings /></AdminRoute>} />

              {/* Cart & Checkout */}
              <Route path="/cart" element={<ProtectedRoute><CartPage /></ProtectedRoute>} />
              <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
              <Route path="/checkout/success" element={<ProtectedRoute><CheckoutSuccess /></ProtectedRoute>} />
              <Route path="/checkout/fail" element={<CheckoutFail />} />

              <Route path="/dashboard" element={<ProtectedRoute><RoleBasedRedirect /></ProtectedRoute>} />

              {/* Student */}
              <Route path="/student" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/courses" element={<ProtectedRoute><StudentCourses /></ProtectedRoute>} />
              <Route path="/dashboard/assignments" element={<ProtectedRoute><StudentAssignments /></ProtectedRoute>} />
              <Route path="/dashboard/achievements" element={<ProtectedRoute><StudentAchievements /></ProtectedRoute>} />
              <Route path="/catalog" element={<ProtectedRoute><CourseCatalog /></ProtectedRoute>} />
              <Route path="/mypage" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
              <Route path="/my/orders" element={<ProtectedRoute><MyPage defaultTab="orders" /></ProtectedRoute>} />
              <Route path="/my/wishlist" element={<ProtectedRoute><MyPage defaultTab="wishlist" /></ProtectedRoute>} />
              <Route path="/student/announcements" element={<ProtectedRoute><StudentAnnouncements /></ProtectedRoute>} />
              <Route path="/student/board" element={<ProtectedRoute><StudentBoard /></ProtectedRoute>} />
              <Route path="/student/community" element={<ProtectedRoute><StudentCommunity /></ProtectedRoute>} />
              <Route path="/community/feed" element={<ProtectedRoute><CommunityMyFeed /></ProtectedRoute>} />
              <Route path="/community/members/:userId" element={<ProtectedRoute><CommunityMemberProfile /></ProtectedRoute>} />
              <Route path="/community/ranking" element={<ProtectedRoute><CommunityRanking /></ProtectedRoute>} />
              <Route path="/community/posts/:postId" element={<ProtectedRoute><CommunityPostDetail /></ProtectedRoute>} />
              <Route path="/student/tracks" element={<Navigate to="/dashboard/courses?tab=tracks" replace />} />
              <Route path="/student/notes" element={<ProtectedRoute><StudentNotes /></ProtectedRoute>} />
              <Route path="/articles" element={<ProtectedRoute><StudentArticles /></ProtectedRoute>} />
              <Route path="/articles/:id" element={<ProtectedRoute><StudentArticleDetail /></ProtectedRoute>} />
              <Route path="/student/programs" element={<ProtectedRoute><StudentPrograms /></ProtectedRoute>} />
              <Route path="/student/certificates" element={<ProtectedRoute><FeatureGate module="certificates_ops"><StudentCertificates /></FeatureGate></ProtectedRoute>} />
              <Route path="/student/evidence" element={<ProtectedRoute><FeatureGate module="evidence"><StudentEvidence /></FeatureGate></ProtectedRoute>} />
              <Route path="/student/surveys" element={<ProtectedRoute><FeatureGate module="surveys_ops"><StudentSurveys /></FeatureGate></ProtectedRoute>} />
              <Route path="/verify/cert/:code" element={<VerifyCertificate />} />

              {/* AI tools (all authenticated users) */}
              <Route path="/tools/english-correction" element={<ProtectedRoute><EnglishCorrection /></ProtectedRoute>} />

              {/* Corrections (essay correction system) */}
              <Route path="/student/corrections" element={<ProtectedRoute><StudentCorrections /></ProtectedRoute>} />
              <Route path="/student/corrections/:id" element={<ProtectedRoute><CorrectionDetail /></ProtectedRoute>} />
              <Route path="/teacher/corrections" element={<TeacherRoute><CorrectionsQueue role="teacher" /></TeacherRoute>} />
              <Route path="/teacher/corrections/:id" element={<TeacherRoute><CorrectionDetail /></TeacherRoute>} />
              <Route path="/admin/corrections" element={<AdminRoute><CorrectionsQueue role="admin" /></AdminRoute>} />
              <Route path="/admin/corrections/:id" element={<AdminRoute><CorrectionDetail /></AdminRoute>} />

              {/* Teacher */}
              <Route path="/teacher" element={<TeacherRoute><TeacherDashboard /></TeacherRoute>} />
              <Route path="/teacher/courses" element={<TeacherRoute><TeacherCourses /></TeacherRoute>} />
              <Route path="/teacher/assignments" element={<TeacherRoute><TeacherAssignments /></TeacherRoute>} />
              <Route path="/teacher/courses/new" element={<TeacherRoute><CreateCourse /></TeacherRoute>} />
              <Route path="/teacher/courses/:courseId/edit" element={<TeacherRoute><CreateCourse /></TeacherRoute>} />
              <Route path="/teacher/students" element={<TeacherRoute><TeacherStudents /></TeacherRoute>} />
              <Route path="/teacher/students/:studentId" element={<TeacherRoute><TeacherStudentDetail /></TeacherRoute>} />
              <Route path="/teacher/notifications" element={<TeacherRoute><TeacherNotifications /></TeacherRoute>} />
              <Route path="/teacher/announcements" element={<TeacherRoute><TeacherAnnouncements /></TeacherRoute>} />
              <Route path="/teacher/board" element={<TeacherRoute><AdminBoard role="teacher" /></TeacherRoute>} />
              <Route path="/teacher/attendance" element={<TeacherRoute><AdminAttendance role="teacher" /></TeacherRoute>} />
              <Route path="/teacher/cms" element={<TeacherRoute><AdminCmsArticles /></TeacherRoute>} />

              {/* Admin */}
              <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
              <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
              <Route path="/admin/users/:userId" element={<AdminRoute><AdminUserDetail /></AdminRoute>} />
              <Route path="/admin/courses" element={<AdminRoute><AdminCourses /></AdminRoute>} />
              <Route path="/admin/sale-status" element={<AdminRoute><AdminSaleStatus /></AdminRoute>} />
              <Route path="/admin/content-library" element={<AdminRoute><AdminContentLibrary /></AdminRoute>} />
              <Route path="/admin/course-options" element={<AdminRoute><AdminCourseOptions /></AdminRoute>} />
              <Route path="/admin/course-ops" element={<AdminRoute><AdminCourseOps /></AdminRoute>} />
              <Route path="/admin/member-groups" element={<AdminRoute><AdminMemberGroups /></AdminRoute>} />
              <Route path="/admin/refunds" element={<AdminRoute><AdminRefunds /></AdminRoute>} />
              <Route path="/admin/messaging" element={<AdminRoute><AdminMessaging /></AdminRoute>} />
              <Route path="/admin/points" element={<AdminRoute><AdminPoints /></AdminRoute>} />
              <Route path="/admin/privacy-audit" element={<AdminRoute><AdminPrivacyAudit /></AdminRoute>} />
              <Route path="/admin/sales-stats" element={<AdminRoute><AdminSalesStats /></AdminRoute>} />
              <Route path="/admin/checkout-fields" element={<AdminRoute><AdminCheckoutFields /></AdminRoute>} />
              <Route path="/admin/subscriptions" element={<AdminRoute><AdminSubscriptions /></AdminRoute>} />
              <Route path="/admin/market" element={<AdminRoute><AdminMarket /></AdminRoute>} />
              <Route path="/admin/micro-learning" element={<AdminRoute><AdminMicroLearning /></AdminRoute>} />
              <Route path="/admin/offline-classes" element={<AdminRoute><AdminOfflineClasses /></AdminRoute>} />
              <Route path="/admin/design-manager" element={<AdminRoute><AdminDesignManager /></AdminRoute>} />
              <Route path="/admin/qualifications" element={<AdminRoute><AdminQualifications /></AdminRoute>} />
              <Route path="/admin/settlements" element={<AdminRoute><AdminSettlements /></AdminRoute>} />

              <Route path="/admin/courses/new" element={<AdminRoute><CreateCourse /></AdminRoute>} />
              <Route path="/admin/courses/:courseId/edit" element={<AdminRoute><CreateCourse /></AdminRoute>} />
              <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
              <Route path="/admin/api-clients" element={<AdminRoute><ApiClients /></AdminRoute>} />
              <Route path="/admin/api-docs" element={<AdminRoute><ApiDocs /></AdminRoute>} />
              <Route path="/oauth/authorize" element={<OAuthAuthorize />} />
              <Route path="/admin/system-info" element={<AdminRoute><AdminSystemInfo /></AdminRoute>} />
              <Route path="/admin/manual" element={<AdminRoute><AdminManual /></AdminRoute>} />
              <Route path="/admin/enrollments" element={<AdminRoute><AdminEnrollments /></AdminRoute>} />
              <Route path="/admin/learning" element={<AdminRoute><AdminLearning /></AdminRoute>} />
              <Route path="/admin/attendance" element={<AdminRoute><AdminAttendance role="admin" /></AdminRoute>} />
              <Route path="/admin/completion" element={<AdminRoute><AdminCompletion /></AdminRoute>} />
              <Route path="/admin/traffic" element={<AdminRoute><AdminTraffic /></AdminRoute>} />
              <Route path="/admin/assessments" element={<AdminRoute><AdminAssessmentsStatus /></AdminRoute>} />
              <Route path="/admin/question-bank" element={<AdminRoute><AdminQuestionBank /></AdminRoute>} />
              <Route path="/admin/ai-question-gen" element={<AdminRoute><AdminAIQuestionGen /></AdminRoute>} />
              <Route path="/admin/ai-progress-prediction" element={<AdminRoute><AdminAIProgressPrediction /></AdminRoute>} />
              <Route path="/admin/ai-feedback" element={<AdminRoute><AdminAIFeedback /></AdminRoute>} />
              <Route path="/admin/cms" element={<AdminRoute><AdminCmsArticles /></AdminRoute>} />
              <Route path="/admin/branches" element={<AdminRoute><AdminBranches /></AdminRoute>} />
              <Route path="/admin/notifications" element={<AdminRoute><AdminNotifications /></AdminRoute>} />
              <Route path="/admin/announcements" element={<AdminRoute><AdminAnnouncements /></AdminRoute>} />
              <Route path="/admin/board" element={<AdminRoute><AdminBoard role="admin" /></AdminRoute>} />
              <Route path="/admin/community" element={<AdminRoute><AdminCommunity /></AdminRoute>} />
              <Route path="/admin/surveys" element={<AdminRoute><AdminSurveys /></AdminRoute>} />
              <Route path="/admin/videos" element={<AdminRoute><AdminVideos /></AdminRoute>} />
              <Route path="/admin/instructors" element={<AdminRoute><AdminInstructors /></AdminRoute>} />
              <Route path="/admin/banners" element={<AdminRoute><AdminBanners /></AdminRoute>} />
              <Route path="/admin/orders" element={<AdminRoute><AdminOrders /></AdminRoute>} />
              <Route path="/admin/coupons" element={<AdminRoute><AdminCoupons /></AdminRoute>} />
              <Route path="/admin/site-settings" element={<AdminRoute><AdminSiteSettings /></AdminRoute>} />
              <Route path="/admin/tracks" element={<AdminRoute><AdminTracks /></AdminRoute>} />
              <Route path="/admin/global-dashboard" element={<AdminRoute><AdminGlobalDashboard /></AdminRoute>} />
              <Route path="/admin/i18n-dashboard" element={<AdminRoute><AdminI18nDashboard /></AdminRoute>} />
              <Route path="/admin/translation-glossary" element={<AdminRoute><AdminTranslationGlossary /></AdminRoute>} />
              <Route path="/admin/branch-admins" element={<AdminRoute><AdminBranchAdmins /></AdminRoute>} />

              {/* Admin · Ops (산학프로젝트) — 기능 모듈로 ON/OFF */}
              <Route path="/admin/settings/modules" element={<AdminRoute><AdminModuleSettings /></AdminRoute>} />
              <Route path="/admin/beneficiaries" element={<AdminRoute><FeatureGate module="beneficiaries"><AdminBeneficiaries /></FeatureGate></AdminRoute>} />
              <Route path="/admin/programs" element={<AdminRoute><FeatureGate module="programs"><AdminPrograms /></FeatureGate></AdminRoute>} />
              <Route path="/admin/programs/:id" element={<AdminRoute><FeatureGate module="programs"><AdminProgramDetail /></FeatureGate></AdminRoute>} />
              <Route path="/admin/ops-projects" element={<AdminRoute><FeatureGate module="projects"><AdminOpsProjects /></FeatureGate></AdminRoute>} />
              <Route path="/admin/ops-projects/:id" element={<AdminRoute><FeatureGate module="projects"><AdminOpsProjectDetail /></FeatureGate></AdminRoute>} />
              <Route path="/admin/evidence" element={<AdminRoute><FeatureGate module="evidence"><AdminEvidence /></FeatureGate></AdminRoute>} />
              <Route path="/admin/ops-surveys" element={<AdminRoute><FeatureGate module="surveys_ops"><AdminOpsSurveys /></FeatureGate></AdminRoute>} />
              <Route path="/admin/ops-certificates" element={<AdminRoute><FeatureGate module="certificates_ops"><AdminOpsCertificates /></FeatureGate></AdminRoute>} />
              <Route path="/admin/ops-stats" element={<AdminRoute><FeatureGate module="stats_ops"><AdminOpsStats /></FeatureGate></AdminRoute>} />

              {/* Video Sessions */}
              <Route path="/admin/video-sessions" element={<AdminRoute><VideoSessionsManage role="admin" /></AdminRoute>} />
              <Route path="/teacher/video-sessions" element={<TeacherRoute><VideoSessionsManage role="teacher" /></TeacherRoute>} />
              <Route path="/student/video-sessions" element={<ProtectedRoute><VideoSessionsStudent /></ProtectedRoute>} />
              <Route path="/video-room/:sessionId" element={<ProtectedRoute><VideoRoom /></ProtectedRoute>} />

              {/* Branch Admin (지점 중간관리자) */}
              <Route path="/branch-admin" element={<BranchAdminRoute><BranchAdminDashboard /></BranchAdminRoute>} />
              <Route path="/branch-admin/tracks" element={<BranchAdminRoute><BranchAdminTracks /></BranchAdminRoute>} />
              <Route path="/branch-admin/staff" element={<BranchAdminRoute><BranchAdminStaff /></BranchAdminRoute>} />
              <Route path="/branch-admin/assignments" element={<BranchAdminRoute><BranchAdminAssignments /></BranchAdminRoute>} />
              <Route path="/branch-admin/stats" element={<BranchAdminRoute><BranchAdminStats /></BranchAdminRoute>} />
              <Route path="/branch-admin/certificates" element={<BranchAdminRoute><BranchAdminCertificates /></BranchAdminRoute>} />

              {/* Dept Admin */}
              <Route path="/dept-admin" element={<ProtectedRoute><DeptAdminDashboard /></ProtectedRoute>} />

              {/* Course Detail & Content Player (role-based) */}
              <Route path="/admin/courses/:courseId" element={<AdminRoute><CourseDetail /></AdminRoute>} />
              <Route path="/teacher/courses/:courseId" element={<TeacherRoute><CourseDetail /></TeacherRoute>} />
              <Route path="/student/courses/:courseId" element={<ProtectedRoute><CourseDetail /></ProtectedRoute>} />
              <Route path="/admin/courses/:courseId/content/:contentId" element={<AdminRoute><ContentPlayer /></AdminRoute>} />
              <Route path="/teacher/courses/:courseId/content/:contentId" element={<TeacherRoute><ContentPlayer /></TeacherRoute>} />
              <Route path="/student/courses/:courseId/content/:contentId" element={<ProtectedRoute><ContentPlayer /></ProtectedRoute>} />
              <Route path="/admin/courses/:courseId/assessment/:assessmentId" element={<AdminRoute><AssessmentPage /></AdminRoute>} />
              <Route path="/teacher/courses/:courseId/assessment/:assessmentId" element={<TeacherRoute><AssessmentPage /></TeacherRoute>} />
              <Route path="/student/courses/:courseId/assessment/:assessmentId" element={<ProtectedRoute><AssessmentPage /></ProtectedRoute>} />

              {/* Legacy generic routes */}
              <Route path="/courses/:courseId" element={<ProtectedRoute><CourseRedirect /></ProtectedRoute>} />
              <Route path="/courses/:courseId/content/:contentId" element={<ProtectedRoute><ContentRedirect /></ProtectedRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
      </DemoPresetProvider>
    </UserProvider>
  </QueryClientProvider>
);

export default App;