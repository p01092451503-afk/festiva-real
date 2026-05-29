import { useState } from "react";
import { User, Lock, Camera, ArrowRight, UserCircle, BookOpen, Trophy, Star, TrendingUp, Award, Download, Heart, Receipt, CreditCard, XCircle, Trash2, Eye, Loader2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import AvatarTab from "@/components/mypage/AvatarTab";
import StorefrontCourseCard from "@/components/storefront/StorefrontCourseCard";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useDepartmentLocalizer } from "@/hooks/useDepartmentLocalizer";
import { downloadCertificatePDF, generateCertificatePreviewUrl } from "@/lib/certificateGenerator";
import { translateLabelCached } from "@/lib/translate";
import { useTranslatedLabel } from "@/hooks/useTranslatedLabel";

const MyPage = ({ defaultTab = "profile" }: { defaultTab?: string }) => {
  const { user, profile, refreshProfile } = useUser();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: siteSettings } = useSiteSettings();
  const b2cEnabled = siteSettings?.b2c_enabled !== false;
  const { localizeById, localizeByName } = useDepartmentLocalizer();

  // Force-translate free-text profile labels (position, team) to English when
  // the active language is EN and the value isn't already mapped via the DB.
  const positionLabel = useTranslatedLabel(profile?.position || "");
  const teamLabel = useTranslatedLabel(localizeByName(profile?.team_name || "") || profile?.team_name || "");

  // Profile fields
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone_number || "");
  const [position, setPosition] = useState(profile?.position || "");
  const [teamName, setTeamName] = useState(profile?.team_name || "");
  const [departmentId, setDepartmentId] = useState<string>((profile as any)?.department_id || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Translated mirrors of the editable form fields. We keep the underlying
  // stored value in Korean (`position`, `teamName`) and only swap the *displayed*
  // value while the input is not focused, so the saved data stays consistent
  // across languages.
  const positionInputLabel = useTranslatedLabel(position);
  const teamInputLabel = useTranslatedLabel(teamName);
  const [positionFocused, setPositionFocused] = useState(false);
  const [teamFocused, setTeamFocused] = useState(false);

  // Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPw, setIsChangingPw] = useState(false);

  // Bulk selection for cancelled/refunded orders
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const handleBulkDelete = async () => {
    if (selectedOrderIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const { error: itemsErr } = await supabase.from("order_items").delete().in("order_id", selectedOrderIds);
      if (itemsErr) throw itemsErr;
      const { error } = await supabase.from("orders").delete().in("id", selectedOrderIds);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      toast({ title: t("mypage.orderDeleted", "내역이 삭제되었습니다"), description: `${selectedOrderIds.length}건` });
      setSelectedOrderIds([]);
    } catch (e: any) {
      toast({ title: t("common.error"), description: e.message, variant: "destructive" });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone_number: phone, position, team_name: teamName, department_id: departmentId || null })
        .eq("user_id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast({ title: t("mypage.profileSaved") });
    } catch (e: any) {
      toast({ title: t("common.error"), description: e.message, variant: "destructive" });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: t("common.error"), description: t("mypage.passwordMinLength"), variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: t("common.error"), description: t("mypage.passwordMismatch"), variant: "destructive" });
      return;
    }
    setIsChangingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: t("mypage.passwordChanged") });
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      toast({ title: t("common.error"), description: e.message, variant: "destructive" });
    } finally {
      setIsChangingPw(false);
    }
  };

  // Certificates
  const { data: certificates = [] } = useQuery({
    queryKey: ["my-certificates", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certificates")
        .select("*, courses(title, course_i18n(language_code, title))")
        .eq("user_id", user!.id)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: certTemplates = [] } = useQuery({
    queryKey: ["cert-templates-for-my-certs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("certificate_templates").select("*");
      if (error) throw error;
      return data;
    },
    enabled: certificates.length > 0,
  });

  const [downloadingCertId, setDownloadingCertId] = useState<string | null>(null);
  const [previewCertId, setPreviewCertId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTitle, setPreviewTitle] = useState<string>("");

  const buildCertData = async (cert: any) => {
    const course = cert.courses;
    const template = certTemplates.find((t: any) => t.course_id === cert.course_id);
    const enTitle = (course?.course_i18n || []).find((c: any) => c.language_code === "en")?.title;
    const localizedTitle = isEn ? (enTitle || course?.title) : course?.title;
    // Resolve branch / team labels. When EN is active, fall back to AI translation
    // (cached) so that free-text values without departments.name_en still render
    // in English on the certificate.
    const branchRaw = localizeById((profile as any)?.department_id, profile?.department) || profile?.department || null;
    const teamRaw = localizeByName(profile?.team_name) || profile?.team_name || null;
    const branchName = isEn && branchRaw ? await translateLabelCached(branchRaw) : branchRaw;
    const teamName = isEn && teamRaw ? await translateLabelCached(teamRaw) : teamRaw;
    return {
      studentName: profile?.full_name || "-",
      studentEmail: user?.email || "-",
      courseName: localizedTitle || "-",
      issuedDate: new Date(cert.issued_at).toLocaleDateString(isEn ? "en-US" : "ko-KR"),
      certificateNumber: cert.certificate_number,
      titleText: template?.title_text || (isEn ? "Certificate" : "수료증"),
      descText: template?.description_text || (isEn
        ? "This is to certify that the recipient has diligently completed the above course and is hereby awarded this certificate."
        : "위 사람은 본 교육과정을 성실히 이수하였기에 이 증서를 수여합니다."),
      issuerName: template?.issuer_name || (isEn ? "Director of Education" : "클래시스 글로벌교육센터장"),
      backgroundImageUrl: template?.background_image_url || null,
      branchName,
      teamName,
      language: (isEn ? "en" : "ko") as "en" | "ko",
    };
  };

  const handleDownloadCert = async (cert: any) => {
    setDownloadingCertId(cert.id);
    try {
      const data = await buildCertData(cert);
      await downloadCertificatePDF(data, `certificate_${cert.certificate_number}.pdf`);
    } catch (e: any) {
      toast({ title: t("common.error"), description: e.message, variant: "destructive" });
    } finally {
      setDownloadingCertId(null);
    }
  };

  const handlePreviewCert = async (cert: any) => {
    // Open dialog immediately so the user gets instant feedback
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    const enT = ((cert.courses as any)?.course_i18n || []).find((c: any) => c.language_code === "en")?.title;
    setPreviewTitle((isEn ? (enT || (cert.courses as any)?.title) : (cert.courses as any)?.title) || t("mypage.certificate", "이수증"));
    setPreviewOpen(true);
    setPreviewCertId(cert.id);
    try {
      const data = await buildCertData(cert);
      const url = await generateCertificatePreviewUrl(data);
      setPreviewUrl(url);
    } catch (e: any) {
      console.error("[certificate preview] failed:", e);
      toast({
        title: t("common.error"),
        description: e?.message || "미리보기를 생성하지 못했습니다",
        variant: "destructive",
      });
      setPreviewOpen(false);
    } finally {
      setPreviewCertId(null);
    }
  };

  const { data: enrollmentStats } = useQuery({
    queryKey: ["mypage-enrollment-stats", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("status, completed_at")
        .eq("user_id", user!.id)
        .eq("status", "approved");
      if (error) throw error;
      const inProgress = data.filter((e: any) => !e.completed_at).length;
      const completed = data.filter((e: any) => e.completed_at).length;
      return { inProgress, completed, total: data.length };
    },
    enabled: !!user?.id,
  });

  const { data: gamification } = useQuery({
    queryKey: ["mypage-gamification", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_gamification").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Branches (departments) for selection
  const { data: branches = [] } = useQuery({
    queryKey: ["mypage-branches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, name_en")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: badgeCount = 0 } = useQuery({
    queryKey: ["mypage-badges", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase.from("user_badges").select("*", { count: "exact", head: true }).eq("user_id", user!.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
  });

  // Wishlist
  const { data: wishlistItems = [] } = useQuery({
    queryKey: ["my-wishlist", user?.id, isEn ? "en" : "ko"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wishlists")
        .select("id, course_id, courses(id, title, thumbnail_url, price, sale_price, rating_avg, rating_count, enrolled_count, instructor_id, category_id, status, is_b2c, categories(name, name_en))")
        .eq("user_id", user!.id);
      if (error) throw error;
      // 숨김 과정(미공개) 및 B2C 미노출 과정 제외
      const visible = (data || []).filter((w: any) => {
        const c = w.courses;
        if (!c) return false;
        if (c.status !== "published") return false;
        if (!c.is_b2c) return false;
        return true;
      });
      // get instructor names
      const instrIds = [...new Set(visible.map((w: any) => w.courses?.instructor_id).filter(Boolean))];
      const { data: profiles } = instrIds.length > 0
        ? await supabase.from("profiles").select("user_id, full_name").in("user_id", instrIds)
        : { data: [] };
      const pMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));

      return visible.map((w: any) => ({
        ...w.courses,
        instructor_name: pMap.get(w.courses?.instructor_id) || null,
        category_name: (isEn && w.courses?.categories?.name_en) ? w.courses.categories.name_en : (w.courses?.categories?.name || null),
      }));
    },
    enabled: !!user?.id,
  });

  const handleWishlistToggle = async (courseId: string) => {
    if (!user) return;
    await supabase.from("wishlists").delete().eq("user_id", user.id).eq("course_id", courseId);
    queryClient.invalidateQueries({ queryKey: ["my-wishlist"] });
  };

  // Orders
  const { data: orders = [] } = useQuery({
    queryKey: ["my-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(id, course_id, price_at_purchase, courses(id, title, thumbnail_url))")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const orderStatusLabel: Record<string, string> = {
    pending: t("mypage.statusPending"),
    paid: t("mypage.statusPaid"),
    cancelled: t("mypage.statusCancelled"),
    refunded: t("mypage.statusRefunded"),
  };
  const orderStatusColor: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    paid: "bg-emerald-500 text-white dark:bg-emerald-500 dark:text-white",
    cancelled: "bg-destructive/10 text-destructive",
    refunded: "bg-amber-500 text-white dark:bg-amber-500 dark:text-white",
  };

  const streakDays = gamification?.streak_days || 0;
  const totalPoints = gamification?.total_points || 0;
  const level = gamification?.level || 1;
  const xp = gamification?.experience_points || 0;
  const xpToNext = (level) * 100;
  const xpProgress = Math.min(100, (xp / xpToNext) * 100);

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <UserCircle className="h-6 w-6" aria-hidden="true" />{t("nav.myPage")}
          </h1>
        </div>

        {/* Profile Header */}
        <div className="border border-border rounded-xl p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10">
            <div className="flex items-center gap-5 lg:min-w-[320px]">
              <Avatar className="h-20 w-20 border-2 border-border shadow-sm">
                <AvatarImage src={profile?.avatar_url || ""} alt={profile?.full_name || ""} />
                <AvatarFallback className="bg-card text-foreground text-xl font-semibold">
                  {profile?.full_name?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 space-y-1">
                <h2 className="text-xl font-bold text-foreground">{profile?.full_name || t("common.user")}</h2>
                <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {(() => {
                    const branch = branches.find((b: any) => b.id === ((profile as any)?.department_id));
                    const fallbackName = branch?.name
                      || (typeof profile?.department === "string" ? profile.department : null);
                    const branchName = (profile as any)?.department_id
                      ? localizeById((profile as any)?.department_id, fallbackName) || fallbackName
                      : localizeByName(fallbackName);
                    return branchName ? (
                      <span className="text-[11px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-md">{branchName}</span>
                    ) : null;
                  })()}
                  {profile?.position && <span className="text-[11px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-md">{positionLabel || profile.position}</span>}
                  {profile?.team_name && <span className="text-[11px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-md">{teamLabel || localizeByName(profile.team_name)}</span>}
                </div>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="border border-border rounded-xl p-3 sm:p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{t("dashboard.inProgress")}</span>
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold text-foreground leading-none">{enrollmentStats?.inProgress || 0}</p>
                <p className="text-[10px] text-muted-foreground">{t("dashboard.totalCourses", { count: enrollmentStats?.total || 0 })}</p>
              </div>
              <div className="border border-border rounded-xl p-3 sm:p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{t("dashboard.coursesCompleted")}</span>
                  <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold text-foreground leading-none">{enrollmentStats?.completed || 0}</p>
                <div className="h-1 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${enrollmentStats?.total ? ((enrollmentStats.completed || 0) / enrollmentStats.total) * 100 : 0}%` }} />
                </div>
              </div>
              <div className="border border-border rounded-xl p-3 sm:p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{t("dashboard.level")}</span>
                  <Star className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold text-foreground leading-none">Lv.{level}</p>
                <div className="flex items-center gap-1.5">
                  <div className="h-1 flex-1 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${xpProgress}%` }} />
                  </div>
                  <span className="text-[9px] text-muted-foreground shrink-0">{xp}/{xpToNext} XP</span>
                </div>
              </div>
              <div className="border border-border rounded-xl p-3 sm:p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{t("dashboard.earnedBadges")}</span>
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold text-foreground leading-none">{badgeCount}</p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{streakDays}{t("common.days")}</span>
                  <span className="text-foreground/20">·</span>
                  <span>{totalPoints} P</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="bg-secondary/50 rounded-xl p-1">
            <TabsTrigger value="profile" className="rounded-lg gap-1.5 text-sm">
              <User className="h-4 w-4" /> {t("mypage.profileTab")}
            </TabsTrigger>
            <TabsTrigger value="avatar" className="rounded-lg gap-1.5 text-sm">
              <Camera className="h-4 w-4" /> {t("mypage.avatarTab")}
            </TabsTrigger>
            <TabsTrigger value="certificates" className="rounded-lg gap-1.5 text-sm">
              <Award className="h-4 w-4" /> {t("mypage.certificatesTab")}
            </TabsTrigger>
            {b2cEnabled && (
              <>
                <TabsTrigger value="wishlist" className="rounded-lg gap-1.5 text-sm">
                  <Heart className="h-4 w-4" /> {t("mypage.wishlistTab")}
                </TabsTrigger>
                <TabsTrigger value="orders" className="rounded-lg gap-1.5 text-sm">
                  <Receipt className="h-4 w-4" /> {t("mypage.ordersTab")}
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="password" className="rounded-lg gap-1.5 text-sm">
              <Lock className="h-4 w-4" /> {t("mypage.passwordTab")}
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <div className="max-w-lg space-y-6">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">{t("mypage.profileInfo")}</h2>
                <p className="text-sm text-muted-foreground">{t("mypage.profileInfoDesc")}</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("mypage.email")}</label>
                  <Input value={user?.email || ""} disabled className="h-11 rounded-xl bg-secondary/30 border-border" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("mypage.name")}</label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11 rounded-xl border-border" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("mypage.phone")}</label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" className="h-11 rounded-xl border-border" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("mypage.branch", "소속 지점")}</label>
                  <Select value={departmentId || "none"} onValueChange={(v) => setDepartmentId(v === "none" ? "" : v)}>
                    <SelectTrigger className="h-11 rounded-xl border-border">
                      <SelectValue placeholder={t("auth.selectBranch", "소속 지점을 선택하세요")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("common.noData", "선택 안 함")}</SelectItem>
                      {branches.map((b: any) => (
                        <SelectItem key={b.id} value={b.id}>{localizeById(b.id, b.name) || b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("mypage.position")}</label>
                    <Input
                      value={isEn && !positionFocused ? (positionInputLabel || position) : position}
                      onChange={(e) => setPosition(e.target.value)}
                      onFocus={() => setPositionFocused(true)}
                      onBlur={() => setPositionFocused(false)}
                      className="h-11 rounded-xl border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("mypage.team")}</label>
                    <Input
                      value={isEn && !teamFocused ? (teamInputLabel || teamName) : teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      onFocus={() => setTeamFocused(true)}
                      onBlur={() => setTeamFocused(false)}
                      className="h-11 rounded-xl border-border"
                    />
                  </div>
                </div>
              </div>
              <Button onClick={handleSaveProfile} disabled={isSavingProfile} className="rounded-xl gap-1.5">
                {isSavingProfile ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="avatar"><AvatarTab /></TabsContent>

          {/* Certificates Tab */}
          <TabsContent value="certificates">
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">{t("mypage.certificateManagement")}</h2>
                <p className="text-sm text-muted-foreground">{t("mypage.certificateManagementDesc")}</p>
              </div>
              {certificates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <div className="h-14 w-14 rounded-full bg-accent flex items-center justify-center">
                    <Award className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">{t("mypage.noCertificates")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {certificates.map((cert: any) => (
                    <div key={cert.id} className="flex items-center justify-between gap-4 border border-border rounded-xl p-4">
                      <div className="min-w-0 space-y-1">
                        <h3 className="text-sm font-semibold text-foreground truncate">{(() => {
                          const c: any = cert.courses;
                          const en = (c?.course_i18n || []).find((x: any) => x.language_code === "en")?.title;
                          return (isEn ? (en || c?.title) : c?.title) || "-";
                        })()}</h3>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>No. {cert.certificate_number}</span>
                          <span>·</span>
                          <span>{new Date(cert.issued_at).toLocaleDateString(isEn ? "en-US" : "ko-KR")}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg gap-1.5"
                          onClick={() => handlePreviewCert(cert)}
                          disabled={previewCertId === cert.id}
                        >
                          {previewCertId === cert.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                          {t("common.preview", "미리보기")}
                        </Button>
                        <Button
                          size="sm"
                          className="rounded-lg gap-1.5"
                          onClick={() => handleDownloadCert(cert)}
                          disabled={downloadingCertId === cert.id}
                        >
                          {downloadingCertId === cert.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          {downloadingCertId === cert.id ? t("mypage.generating") : t("mypage.issuePdf", "PDF 발급")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Wishlist Tab */}
          <TabsContent value="wishlist">
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">{t("mypage.wishlistTitle")}</h2>
                <p className="text-sm text-muted-foreground">{t("mypage.wishlistDesc")}</p>
              </div>
              {wishlistItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <div className="h-14 w-14 rounded-full bg-accent flex items-center justify-center">
                    <Heart className="h-6 w-6 text-muted-foreground" />
                  </div>
                   <p className="text-sm text-muted-foreground">{t("mypage.noWishlist")}</p>
                   <Button variant="outline" size="sm" onClick={() => navigate("/store/courses")}>{t("common.browseCourses")}</Button>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {wishlistItems.map((course: any) => (
                    <StorefrontCourseCard
                      key={course.id}
                      course={course}
                      isInWishlist={true}
                      onWishlistToggle={() => handleWishlistToggle(course.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">{t("mypage.ordersTitle")}</h2>
                <p className="text-sm text-muted-foreground">{t("mypage.ordersDesc")}</p>
              </div>
              {orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <div className="h-14 w-14 rounded-full bg-accent flex items-center justify-center">
                    <Receipt className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">{t("mypage.noOrders")}</p>
                  <Button variant="outline" size="sm" onClick={() => navigate("/store/courses")}>{t("common.browseCourses")}</Button>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Pending Orders */}
                  {orders.filter((o: any) => o.status === "pending").length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        {t("mypage.pendingPayment")}
                        <Badge variant="secondary" className="text-xs">{orders.filter((o: any) => o.status === "pending").length}</Badge>
                      </h3>
                      <div className="space-y-3">
                        {orders.filter((o: any) => o.status === "pending").map((order: any) => (
                          <Card key={order.id} className="p-5 space-y-3 border-dashed">
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <p className="text-sm font-semibold text-foreground">{order.order_number}</p>
                                <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString("ko-KR")}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg ${orderStatusColor[order.status] || "bg-muted text-muted-foreground"}`}>
                                  {orderStatusLabel[order.status] || order.status}
                                </span>
                                <span className="text-sm font-bold text-foreground">{order.final_amount?.toLocaleString()}원</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              {(order.order_items || []).map((item: any) => (
                                <div key={item.id} className="flex items-center gap-3">
                                  <div className="w-12 h-8 rounded bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                                    {item.courses?.thumbnail_url ? (
                                      <img src={item.courses.thumbnail_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <BookOpen className="h-3 w-3 text-muted-foreground" />
                                    )}
                                  </div>
                                  <p className="text-sm text-foreground flex-1 truncate">{item.courses?.title || "-"}</p>
                                  <p className="text-xs text-muted-foreground shrink-0">{item.price_at_purchase?.toLocaleString()}원</p>
                                </div>
                              ))}
                            </div>
                            <div className="pt-2 border-t border-border flex gap-2">
                              <Button size="sm" className="rounded-lg gap-1.5" onClick={() => {
                                // Build checkout data from this pending order and navigate to checkout
                                const items = (order.order_items || []).map((item: any) => ({
                                  course_id: item.course_id,
                                  title: item.courses?.title || "",
                                  thumbnail_url: item.courses?.thumbnail_url || null,
                                  price: item.price_at_purchase,
                                  sale_price: null,
                                }));
                                localStorage.setItem("checkout_data", JSON.stringify({
                                  items,
                                  couponId: order.coupon_id || null,
                                  discountAmount: order.discount_amount || 0,
                                  totalAmount: order.total_amount,
                                  finalAmount: order.final_amount,
                                  existingOrderId: order.id,
                                  existingTossOrderId: order.toss_order_id,
                                }));
                                navigate("/checkout");
                              }}>
                                <CreditCard className="h-3.5 w-3.5" /> {t("mypage.payNow")}
                              </Button>
                              <Button size="sm" variant="ghost" className="rounded-lg text-muted-foreground" onClick={async () => {
                                const { error } = await supabase.from("orders").update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: "사용자 취소" }).eq("id", order.id);
                                if (!error) {
                                  queryClient.invalidateQueries({ queryKey: ["my-orders"] });
                                  toast({ title: t("mypage.orderCancelled") });
                                }
                              }}>
                                {t("mypage.cancelOrder")}
                              </Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Completed (paid) Orders */}
                  {orders.filter((o: any) => o.status === "paid").length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-muted-foreground" />
                        {t("mypage.completedOrders")}
                        <Badge variant="secondary" className="text-xs">{orders.filter((o: any) => o.status === "paid").length}</Badge>
                      </h3>
                      <div className="space-y-3">
                        {orders.filter((o: any) => o.status === "paid").map((order: any) => (
                          <Card key={order.id} className="p-5 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <p className="text-sm font-semibold text-foreground">{order.order_number}</p>
                                <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString("ko-KR")}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg ${orderStatusColor[order.status] || "bg-muted text-muted-foreground"}`}>
                                  {orderStatusLabel[order.status] || order.status}
                                </span>
                                <span className="text-sm font-bold text-foreground">{order.final_amount?.toLocaleString()}원</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              {(order.order_items || []).map((item: any) => (
                                <div key={item.id} className="flex items-center gap-3">
                                  <div className="w-12 h-8 rounded bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                                    {item.courses?.thumbnail_url ? (
                                      <img src={item.courses.thumbnail_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <BookOpen className="h-3 w-3 text-muted-foreground" />
                                    )}
                                  </div>
                                  <p className="text-sm text-foreground flex-1 truncate">{item.courses?.title || "-"}</p>
                                  <p className="text-xs text-muted-foreground shrink-0">{item.price_at_purchase?.toLocaleString()}원</p>
                                </div>
                              ))}
                            </div>
                            {order.order_items?.length > 0 && (
                              <div className="pt-2 border-t border-border">
                                <Button size="sm" variant="outline" className="rounded-lg gap-1.5" onClick={() => navigate(`/student/courses/${order.order_items[0].course_id}`)}>
                                  <BookOpen className="h-3.5 w-3.5" /> {t("mypage.goToLearn")}
                                </Button>
                              </div>
                            )}
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cancelled / Refunded Orders */}
                  {(() => {
                    const cancelledOrders = orders.filter((o: any) => o.status === "cancelled" || o.status === "refunded");
                    if (cancelledOrders.length === 0) return null;
                    const allIds = cancelledOrders.map((o: any) => o.id);
                    const allSelected = allIds.length > 0 && allIds.every((id) => selectedOrderIds.includes(id));
                    const someSelected = selectedOrderIds.length > 0 && !allSelected;
                    return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                          {t("mypage.cancelledOrders", "취소/환불 내역")}
                          <Badge variant="secondary" className="text-xs">{cancelledOrders.length}</Badge>
                        </h3>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                            <Checkbox
                              checked={allSelected ? true : someSelected ? "indeterminate" : false}
                              onCheckedChange={(checked) => {
                                if (checked) setSelectedOrderIds(allIds);
                                else setSelectedOrderIds([]);
                              }}
                            />
                            {t("mypage.selectAll", "전체 선택")}
                            {selectedOrderIds.length > 0 && (
                              <span className="text-foreground font-medium">({selectedOrderIds.length})</span>
                            )}
                          </label>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                                disabled={selectedOrderIds.length === 0 || isBulkDeleting}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                {t("mypage.deleteSelected", "선택 삭제")}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t("mypage.deleteSelectedTitle", "선택한 내역을 삭제하시겠습니까?")}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t("mypage.deleteSelectedDesc", "선택한 {{count}}건의 주문 내역이 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.", { count: selectedOrderIds.length })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t("common.cancel", "취소")}</AlertDialogCancel>
                                <AlertDialogAction onClick={handleBulkDelete}>
                                  {t("common.delete", "삭제")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {cancelledOrders.map((order: any) => {
                          const isChecked = selectedOrderIds.includes(order.id);
                          return (
                          <Card key={order.id} className="p-5 space-y-3 opacity-70">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={(checked) => {
                                    setSelectedOrderIds((prev) =>
                                      checked ? [...prev, order.id] : prev.filter((id) => id !== order.id)
                                    );
                                  }}
                                />
                                <div className="space-y-0.5 min-w-0">
                                  <p className="text-sm font-semibold text-foreground truncate">{order.order_number}</p>
                                  <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString("ko-KR")}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg ${orderStatusColor[order.status] || "bg-muted text-muted-foreground"}`}>
                                  {orderStatusLabel[order.status] || order.status}
                                </span>
                                <span className="text-sm font-bold text-foreground line-through">{order.final_amount?.toLocaleString()}원</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              {(order.order_items || []).map((item: any) => (
                                <div key={item.id} className="flex items-center gap-3">
                                  <div className="w-12 h-8 rounded bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                                    {item.courses?.thumbnail_url ? (
                                      <img src={item.courses.thumbnail_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <BookOpen className="h-3 w-3 text-muted-foreground" />
                                    )}
                                  </div>
                                  <p className="text-sm text-foreground flex-1 truncate">{item.courses?.title || "-"}</p>
                                  <p className="text-xs text-muted-foreground shrink-0">{item.price_at_purchase?.toLocaleString()}원</p>
                                </div>
                              ))}
                            </div>
                            {order.cancel_reason && (
                              <p className="text-xs text-muted-foreground pt-1">사유: {order.cancel_reason}</p>
                            )}
                            <div className="flex justify-end pt-1">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="rounded-lg text-muted-foreground hover:text-destructive gap-1.5">
                                    <Trash2 className="h-3.5 w-3.5" />
                                    {t("common.delete", "삭제")}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>{t("mypage.deleteOrderTitle", "내역을 삭제하시겠습니까?")}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {t("mypage.deleteOrderDesc", "이 주문 내역이 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.")}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>{t("common.cancel", "취소")}</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={async () => {
                                        const { error: itemsErr } = await supabase.from("order_items").delete().eq("order_id", order.id);
                                        if (itemsErr) {
                                          toast({ title: t("common.error"), description: itemsErr.message, variant: "destructive" });
                                          return;
                                        }
                                        const { error } = await supabase.from("orders").delete().eq("id", order.id);
                                        if (error) {
                                          toast({ title: t("common.error"), description: error.message, variant: "destructive" });
                                          return;
                                        }
                                        queryClient.invalidateQueries({ queryKey: ["my-orders"] });
                                        setSelectedOrderIds((prev) => prev.filter((id) => id !== order.id));
                                        toast({ title: t("mypage.orderDeleted", "내역이 삭제되었습니다") });
                                      }}
                                    >
                                      {t("common.delete", "삭제")}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </Card>
                          );
                        })}
                      </div>
                    </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="password">
            <div className="max-w-lg space-y-6">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">{t("mypage.changePassword")}</h2>
                <p className="text-sm text-muted-foreground">{t("mypage.changePasswordDesc")}</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("mypage.newPassword")}</label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t("mypage.newPasswordPlaceholder")} className="h-11 rounded-xl border-border" minLength={6} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("mypage.confirmPassword")}</label>
                  <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t("mypage.confirmPasswordPlaceholder")} className="h-11 rounded-xl border-border" />
                </div>
              </div>
              <Button onClick={handleChangePassword} disabled={isChangingPw || !newPassword} className="rounded-xl gap-1.5">
                {isChangingPw ? t("common.processing") : t("mypage.changePassword")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open && previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-base font-semibold truncate">
              {previewTitle} · {t("mypage.certificatePreview", "이수증 미리보기")}
            </DialogTitle>
          </DialogHeader>
          <div className="bg-muted/40 px-6 pb-6 pt-2 max-h-[75vh] overflow-auto">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Certificate preview"
                className="w-full h-auto rounded-md shadow-sm border border-border bg-white"
              />
            ) : (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default MyPage;
