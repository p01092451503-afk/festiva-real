import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Power, PowerOff, ChevronDown, ChevronRight, Image, Type, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PresetForm {
  name: string;
  industry: string;
  logo_url: string;
  login_bg_image_url: string;
  brand_name: string;
  brand_tagline: string;
  login_top_text: string;
  login_subtitle: string;
  login_form_logo_url: string;
  login_form_brand_name: string;
  sidebar_brand_name: string;
  sidebar_logo_url: string;
  accent_hsl: string;
}

interface CourseOverrideForm {
  course_id: string;
  override_title: string;
  override_thumbnail_url: string;
  sort_order: number;
}

const emptyPresetForm: PresetForm = {
  name: "", industry: "", logo_url: "", login_bg_image_url: "", brand_name: "", brand_tagline: "",
  login_top_text: "", login_subtitle: "Learning Management System",
  login_form_logo_url: "", login_form_brand_name: "",
  sidebar_brand_name: "", sidebar_logo_url: "", accent_hsl: "",
};
const emptyCourseForm: CourseOverrideForm = { course_id: "", override_title: "", override_thumbnail_url: "", sort_order: 0 };

const DemoPresetManager = () => {
  const queryClient = useQueryClient();
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<any>(null);
  const [presetForm, setPresetForm] = useState<PresetForm>(emptyPresetForm);
  const [deletePresetId, setDeletePresetId] = useState<string | null>(null);
  const [expandedPresetId, setExpandedPresetId] = useState<string | null>(null);
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [courseForm, setCourseForm] = useState<CourseOverrideForm>(emptyCourseForm);
  const [currentPresetId, setCurrentPresetId] = useState<string | null>(null);
  const [deleteCourseId, setDeleteCourseId] = useState<string | null>(null);

  // Fetch all presets (admin sees all)
  const { data: presets = [] } = useQuery({
    queryKey: ["admin-demo-presets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demo_presets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch courses for the expanded preset
  const { data: presetCourses = [] } = useQuery({
    queryKey: ["admin-preset-courses", expandedPresetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demo_preset_courses")
        .select("*, courses(title, thumbnail_url)")
        .eq("preset_id", expandedPresetId!)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!expandedPresetId,
  });

  // Fetch all published courses for dropdown
  const { data: allCourses = [] } = useQuery({
    queryKey: ["admin-all-courses-for-preset"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, thumbnail_url")
        .eq("status", "published")
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  // Create/Update preset
  const presetMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: presetForm.name,
        industry: presetForm.industry,
        logo_url: presetForm.logo_url || null,
        login_bg_image_url: presetForm.login_bg_image_url || null,
        brand_name: presetForm.brand_name || null,
        brand_tagline: presetForm.brand_tagline || null,
        login_top_text: presetForm.login_top_text || null,
        login_subtitle: presetForm.login_subtitle || null,
        login_form_logo_url: presetForm.login_form_logo_url || null,
        login_form_brand_name: presetForm.login_form_brand_name || null,
        sidebar_brand_name: presetForm.sidebar_brand_name || null,
        sidebar_logo_url: presetForm.sidebar_logo_url || null,
        accent_hsl: presetForm.accent_hsl || null,
      };
      if (editingPreset) {
        const { error } = await supabase.from("demo_presets").update(payload).eq("id", editingPreset.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("demo_presets").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingPreset ? "프리셋이 수정되었습니다" : "프리셋이 생성되었습니다");
      setPresetDialogOpen(false);
      setEditingPreset(null);
      setPresetForm(emptyPresetForm);
      queryClient.invalidateQueries({ queryKey: ["admin-demo-presets"] });
      queryClient.invalidateQueries({ queryKey: ["demo-preset-active"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Toggle active
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("demo_presets").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { active }) => {
      toast.success(active ? "프리셋이 활성화되었습니다" : "프리셋이 비활성화되었습니다");
      queryClient.invalidateQueries({ queryKey: ["admin-demo-presets"] });
      queryClient.invalidateQueries({ queryKey: ["demo-preset-active"] });
      queryClient.invalidateQueries({ queryKey: ["demo-preset-courses"] });
    },
  });

  // Delete preset
  const deletePresetMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("demo_presets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("프리셋이 삭제되었습니다");
      setDeletePresetId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-demo-presets"] });
      queryClient.invalidateQueries({ queryKey: ["demo-preset-active"] });
    },
  });

  // Create/Update course override
  const courseMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        preset_id: currentPresetId!,
        course_id: courseForm.course_id,
        override_title: courseForm.override_title || null,
        override_thumbnail_url: courseForm.override_thumbnail_url || null,
        sort_order: courseForm.sort_order,
      };
      if (editingCourse) {
        const { error } = await supabase.from("demo_preset_courses").update(payload).eq("id", editingCourse.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("demo_preset_courses").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingCourse ? "강의 오버라이드가 수정되었습니다" : "강의 오버라이드가 추가되었습니다");
      setCourseDialogOpen(false);
      setEditingCourse(null);
      setCourseForm(emptyCourseForm);
      queryClient.invalidateQueries({ queryKey: ["admin-preset-courses", expandedPresetId] });
      queryClient.invalidateQueries({ queryKey: ["demo-preset-courses"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Delete course override
  const deleteCourseMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("demo_preset_courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("강의 오버라이드가 삭제되었습니다");
      setDeleteCourseId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-preset-courses", expandedPresetId] });
      queryClient.invalidateQueries({ queryKey: ["demo-preset-courses"] });
    },
  });

  const openAddPreset = () => {
    setEditingPreset(null);
    setPresetForm(emptyPresetForm);
    setPresetDialogOpen(true);
  };

  const openEditPreset = (preset: any) => {
    setEditingPreset(preset);
    setPresetForm({
      name: preset.name,
      industry: preset.industry || "",
      logo_url: preset.logo_url || "",
      login_bg_image_url: preset.login_bg_image_url || "",
      brand_name: preset.brand_name || "",
      brand_tagline: preset.brand_tagline || "",
      login_top_text: preset.login_top_text || "",
      login_subtitle: preset.login_subtitle ?? "Learning Management System",
      login_form_logo_url: preset.login_form_logo_url || "",
      login_form_brand_name: preset.login_form_brand_name || "",
      sidebar_brand_name: preset.sidebar_brand_name || "",
      sidebar_logo_url: preset.sidebar_logo_url || "",
      accent_hsl: preset.accent_hsl || "",
    });
    setPresetDialogOpen(true);
  };

  const openAddCourse = (presetId: string) => {
    setCurrentPresetId(presetId);
    setEditingCourse(null);
    setCourseForm(emptyCourseForm);
    setCourseDialogOpen(true);
  };

  const openEditCourse = (presetId: string, course: any) => {
    setCurrentPresetId(presetId);
    setEditingCourse(course);
    setCourseForm({
      course_id: course.course_id,
      override_title: course.override_title || "",
      override_thumbnail_url: course.override_thumbnail_url || "",
      sort_order: course.sort_order,
    });
    setCourseDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">데모 프리셋 관리</h2>
          <p className="text-xs text-muted-foreground mt-1">고객사별 강의 제목, 썸네일, 로고를 프리셋으로 관리합니다</p>
        </div>
        <Button className="rounded-xl gap-2" onClick={openAddPreset}>
          <Plus className="h-4 w-4" /> 프리셋 추가
        </Button>
      </div>

      {presets.length === 0 ? (
        <div className="stat-card text-center py-12">
          <p className="text-sm text-muted-foreground">등록된 프리셋이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {presets.map((preset: any) => (
            <div key={preset.id} className="stat-card !p-0 overflow-hidden">
              {/* Preset header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <button
                  className="flex items-center gap-3 flex-1 text-left"
                  onClick={() => setExpandedPresetId(expandedPresetId === preset.id ? null : preset.id)}
                >
                  {expandedPresetId === preset.id ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <div>
                    <span className="text-sm font-semibold text-foreground">{preset.name}</span>
                    {preset.industry && <span className="text-xs text-muted-foreground ml-2">({preset.industry})</span>}
                  </div>
                  {preset.is_active && <Badge variant="default" className="text-[10px] ml-2">활성</Badge>}
                </button>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => toggleActiveMutation.mutate({ id: preset.id, active: !preset.is_active })}
                    title={preset.is_active ? "비활성화" : "활성화"}
                  >
                    {preset.is_active ? <PowerOff className="h-3.5 w-3.5 text-primary" /> : <Power className="h-3.5 w-3.5 text-muted-foreground" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditPreset(preset)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeletePresetId(preset.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Expanded: show branding info + course overrides */}
              {expandedPresetId === preset.id && (
                <div className="p-4 space-y-4">
                  {/* Branding summary */}
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    {preset.brand_name && <span>브랜드: <strong className="text-foreground">{preset.brand_name}</strong></span>}
                    {preset.logo_url && (
                      <span className="flex items-center gap-1">
                        <Image className="h-3 w-3" /> 로고 설정됨
                      </span>
                    )}
                    {preset.login_bg_image_url && (
                      <span className="flex items-center gap-1">
                        <Image className="h-3 w-3" /> 로그인 배경 설정됨
                      </span>
                    )}
                  </div>

                  {/* Course overrides */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-foreground">강의 오버라이드 ({presetCourses.length}개)</h3>
                      <Button variant="outline" size="sm" className="rounded-xl gap-1 text-xs" onClick={() => openAddCourse(preset.id)}>
                        <Plus className="h-3 w-3" /> 강의 추가
                      </Button>
                    </div>
                    {presetCourses.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">등록된 강의 오버라이드가 없습니다</p>
                    ) : (
                      <div className="space-y-2">
                        {presetCourses.map((pc: any) => (
                          <div key={pc.id} className="flex items-center gap-3 px-3 py-2 bg-accent/30 rounded-lg">
                            {/* Thumbnail preview */}
                            <div className="w-16 h-10 rounded overflow-hidden bg-accent shrink-0">
                              {(pc.override_thumbnail_url || pc.courses?.thumbnail_url) && (
                                <img
                                  src={pc.override_thumbnail_url || pc.courses?.thumbnail_url}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">
                                {pc.override_title || pc.courses?.title || "제목 없음"}
                              </p>
                              {pc.override_title && pc.courses?.title && (
                                <p className="text-[10px] text-muted-foreground truncate">원본: {pc.courses.title}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {pc.override_title && <span title="제목 변경됨"><Type className="h-3 w-3 text-primary" /></span>}
                              {pc.override_thumbnail_url && <span title="썸네일 변경됨"><Image className="h-3 w-3 text-primary" /></span>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditCourse(preset.id, pc)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteCourseId(pc.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Preset Dialog */}
      <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPreset ? "프리셋 수정" : "새 프리셋 추가"}</DialogTitle>
            <DialogDescription>
              고객사 PT 데모용 브랜딩을 한곳에서 관리하세요. 활성화하면 로그인 페이지·사이드바·강의 카드까지 즉시 적용됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* 기본 정보 */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">기본 정보</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>프리셋 이름 *</Label>
                <Input value={presetForm.name} onChange={(e) => setPresetForm({ ...presetForm, name: e.target.value })} placeholder="삼성전자 데모" className="mt-1" />
              </div>
              <div>
                <Label>업종</Label>
                <Input value={presetForm.industry} onChange={(e) => setPresetForm({ ...presetForm, industry: e.target.value })} placeholder="전자/반도체" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>브랜드명 (공통 기본값)</Label>
              <Input value={presetForm.brand_name} onChange={(e) => setPresetForm({ ...presetForm, brand_name: e.target.value })} placeholder="SAMSUNG" className="mt-1" />
              <p className="text-[11px] text-muted-foreground mt-1">사이드바·로그인 폼 텍스트 등의 기본값으로 사용됩니다.</p>
            </div>
            </section>

            <Separator />

            {/* 로그인 — 좌측 비주얼 */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">로그인 — 좌측 비주얼</h4>
            <div>
              <Label>좌측 하단 큰 텍스트 (태그라인)</Label>
              <Input value={presetForm.brand_tagline} onChange={(e) => setPresetForm({ ...presetForm, brand_tagline: e.target.value })} placeholder="혁신을 위한 배움" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>좌측 상단 텍스트</Label>
                <Input value={presetForm.login_top_text} onChange={(e) => setPresetForm({ ...presetForm, login_top_text: e.target.value })} placeholder="SAMSUNG (비워두면 브랜드명)" className="mt-1" />
              </div>
              <div>
                <Label>좌측 상단 보조 텍스트</Label>
                <Input value={presetForm.login_subtitle} onChange={(e) => setPresetForm({ ...presetForm, login_subtitle: e.target.value })} placeholder="Learning Management System" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>로그인 배경 이미지 URL</Label>
              <Input value={presetForm.login_bg_image_url} onChange={(e) => setPresetForm({ ...presetForm, login_bg_image_url: e.target.value })} placeholder="https://..." className="mt-1" />
            </div>
            <div>
              <Label>강조 색상 (HSL: H S% L%)</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={presetForm.accent_hsl}
                  onChange={(e) => setPresetForm({ ...presetForm, accent_hsl: e.target.value })}
                  placeholder="262 70% 45% (비워두면 기본값)"
                />
                <div
                  className="h-10 w-10 rounded-md border shrink-0"
                  style={{ backgroundColor: presetForm.accent_hsl ? `hsl(${presetForm.accent_hsl})` : "hsl(262 70% 45%)" }}
                  aria-hidden="true"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">예: 파랑 <code>210 80% 45%</code>, 초록 <code>150 60% 40%</code>, 주황 <code>25 90% 50%</code></p>
            </div>
            </section>

            <Separator />

            {/* 로그인 — 우측 폼 */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">로그인 — 우측 폼 상단</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>폼 상단 로고 URL</Label>
                  <Input value={presetForm.login_form_logo_url} onChange={(e) => setPresetForm({ ...presetForm, login_form_logo_url: e.target.value })} placeholder="https://..." className="mt-1" />
                </div>
                <div>
                  <Label>폼 상단 텍스트</Label>
                  <Input value={presetForm.login_form_brand_name} onChange={(e) => setPresetForm({ ...presetForm, login_form_brand_name: e.target.value })} placeholder="비워두면 브랜드명 사용" className="mt-1" />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">로고가 있으면 로고가 우선, 없으면 텍스트가 표시됩니다.</p>
            </section>

            <Separator />

            {/* 사이드바 — 학습자/관리자 공통 */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">사이드바 — 학습자·관리자 공통</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>사이드바 로고 URL</Label>
                  <Input value={presetForm.sidebar_logo_url} onChange={(e) => setPresetForm({ ...presetForm, sidebar_logo_url: e.target.value })} placeholder="https://... (비워두면 공용 로고)" className="mt-1" />
                </div>
                <div>
                  <Label>사이드바 브랜드명</Label>
                  <Input value={presetForm.sidebar_brand_name} onChange={(e) => setPresetForm({ ...presetForm, sidebar_brand_name: e.target.value })} placeholder="비워두면 브랜드명 사용" className="mt-1" />
                </div>
              </div>
              <div>
                <Label>공용 로고 URL (선택)</Label>
                <Input value={presetForm.logo_url} onChange={(e) => setPresetForm({ ...presetForm, logo_url: e.target.value })} placeholder="https://..." className="mt-1" />
                <p className="text-[11px] text-muted-foreground mt-1">사이드바 로고가 비어 있으면 이 값이 사용됩니다.</p>
              </div>
            </section>

            <Separator />

            {/* 미리보기 */}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" /> 미리보기
              </h4>
              <div
                className="rounded-lg border overflow-hidden flex h-40"
                style={{ backgroundColor: presetForm.accent_hsl ? `hsl(${presetForm.accent_hsl} / 0.12)` : "hsl(262 50% 92%)" }}
              >
                <div className="flex-1 relative p-4 flex flex-col justify-between">
                  {presetForm.login_bg_image_url && (
                    <img src={presetForm.login_bg_image_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-90" />
                  )}
                  <p
                    className="relative tracking-[0.25em] uppercase text-[10px]"
                    style={{ color: presetForm.accent_hsl ? `hsl(${presetForm.accent_hsl})` : "hsl(262 70% 45%)" }}
                  >
                    <span className="font-light">{presetForm.login_top_text || presetForm.brand_name || "BRAND"}</span>
                    {presetForm.login_subtitle && <span className="ml-2">{presetForm.login_subtitle}</span>}
                  </p>
                  <h3
                    className="relative text-sm font-medium leading-snug whitespace-pre-line"
                    style={{ color: presetForm.accent_hsl ? `hsl(${presetForm.accent_hsl})` : "hsl(262 70% 40%)" }}
                  >
                    {presetForm.brand_tagline || "고객사 태그라인이 여기에 표시됩니다"}
                  </h3>
                </div>
                <div className="flex-1 bg-white p-4 flex flex-col gap-3">
                  {presetForm.login_form_logo_url ? (
                    <img src={presetForm.login_form_logo_url} alt="" className="h-7 w-auto object-contain" />
                  ) : (
                    <span className="text-base font-semibold text-foreground">
                      {presetForm.login_form_brand_name || presetForm.brand_name || "Brand"}
                    </span>
                  )}
                  <div className="text-xs font-semibold text-foreground">로그인</div>
                  <div className="h-7 rounded border border-border bg-muted/40" />
                  <div className="h-7 rounded border border-border bg-muted/40" />
                </div>
              </div>
              <div className="rounded-lg border bg-card p-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded bg-muted flex items-center justify-center overflow-hidden">
                  {(presetForm.sidebar_logo_url || presetForm.logo_url) ? (
                    <img src={presetForm.sidebar_logo_url || presetForm.logo_url} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">LOGO</span>
                  )}
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {presetForm.sidebar_brand_name || presetForm.brand_name || "사이드바 브랜드명"}
                </span>
                <span className="ml-auto text-[10px] text-muted-foreground">사이드바 미리보기</span>
              </div>
            </section>

            <Button className="w-full rounded-xl" onClick={() => presetMutation.mutate()} disabled={!presetForm.name || presetMutation.isPending}>
              {presetMutation.isPending ? "저장 중..." : "저장"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Course Override Dialog */}
      <Dialog open={courseDialogOpen} onOpenChange={setCourseDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCourse ? "강의 오버라이드 수정" : "강의 오버라이드 추가"}</DialogTitle>
            <DialogDescription>강의의 제목과 썸네일을 프리셋에 맞게 변경합니다</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>대상 강의 *</Label>
              <Select
                value={courseForm.course_id || "none"}
                onValueChange={(v) => setCourseForm({ ...courseForm, course_id: v === "none" ? "" : v })}
                disabled={!!editingCourse}
              >
                <SelectTrigger className="mt-1"><SelectValue placeholder="강의 선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">강의 선택</SelectItem>
                  {allCourses.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>대체 제목</Label>
              <Input value={courseForm.override_title} onChange={(e) => setCourseForm({ ...courseForm, override_title: e.target.value })} placeholder="프리셋용 강의 제목" className="mt-1" />
            </div>
            <div>
              <Label>대체 썸네일 URL</Label>
              <Input value={courseForm.override_thumbnail_url} onChange={(e) => setCourseForm({ ...courseForm, override_thumbnail_url: e.target.value })} placeholder="https://..." className="mt-1" />
            </div>
            <div>
              <Label>정렬 순서</Label>
              <Input type="number" value={courseForm.sort_order} onChange={(e) => setCourseForm({ ...courseForm, sort_order: parseInt(e.target.value) || 0 })} className="mt-1" />
            </div>
            <Button className="w-full rounded-xl" onClick={() => courseMutation.mutate()} disabled={!courseForm.course_id || courseMutation.isPending}>
              {courseMutation.isPending ? "저장 중..." : "저장"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete preset confirmation */}
      <AlertDialog open={!!deletePresetId} onOpenChange={() => setDeletePresetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>프리셋 삭제</AlertDialogTitle>
            <AlertDialogDescription>이 프리셋과 관련된 모든 강의 오버라이드도 함께 삭제됩니다. 계속하시겠습니까?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletePresetId && deletePresetMutation.mutate(deletePresetId)}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete course override confirmation */}
      <AlertDialog open={!!deleteCourseId} onOpenChange={() => setDeleteCourseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>강의 오버라이드 삭제</AlertDialogTitle>
            <AlertDialogDescription>이 강의의 오버라이드를 삭제하시겠습니까?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteCourseId && deleteCourseMutation.mutate(deleteCourseId)}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DemoPresetManager;
