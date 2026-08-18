import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings2, Image as ImageIcon, Menu, FileText, Clock, Plus, Trash2, GripVertical, Upload, Save, ExternalLink } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SiteSettings, NavItem } from "@/hooks/useSiteSettings";


const emptySettings: Partial<SiteSettings> = {
  header_logo_url: "",
  sidebar_logo_url: "",
  footer_logo_url: "",
  company_name: "",
  company_name_en: "",
  company_address: "",
  company_phone: "",
  company_email: "",
  business_number: "",
  ceo_name: "",
  hours_weekday: "",
  hours_weekend: "",
  hours_lunch: "",
  hours_holiday: "",
  instagram_url: "",
  youtube_url: "",
  facebook_url: "",
  blog_url: "",
  footer_description: "",
  copyright_text: "",
  privacy_policy: "",
  b2c_enabled: true,
};

interface LogoUploaderProps {
  label: string;
  hint?: string;
  value: string | null | undefined;
  onChange: (url: string) => void;
}

const LogoUploader = ({ label, hint, value, onChange }: LogoUploaderProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "파일이 너무 큽니다", description: "2MB 이하의 이미지를 업로드해주세요.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `logos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("site-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("site-assets").getPublicUrl(path);
      onChange(data.publicUrl);
      toast({ title: "업로드 완료" });
    } catch (e: any) {
      toast({ title: "업로드 실패", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex items-center gap-3">
        <div className="h-16 w-32 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {value ? (
            <img src={value} alt={label} className="max-h-full max-w-full object-contain" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <Input
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="이미지 URL 또는 업로드"
            className="text-xs"
          />
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            />
            <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              {uploading ? "업로드 중..." : "이미지 업로드"}
            </Button>
            {value && (
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")} className="text-destructive hover:text-destructive">
                제거
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface NavItemRowProps {
  item: NavItem;
  onSave: (patch: Partial<NavItem>) => void;
  onDelete: () => void;
}

const NavItemRow = ({ item, onSave, onDelete }: NavItemRowProps) => {
  const [label, setLabel] = useState(item.label);
  const [labelEn, setLabelEn] = useState(item.label_en || "");
  const [url, setUrl] = useState(item.url);

  // Sync local state if server data changes externally
  useEffect(() => { setLabel(item.label); }, [item.label]);
  useEffect(() => { setLabelEn(item.label_en || ""); }, [item.label_en]);
  useEffect(() => { setUrl(item.url); }, [item.url]);

  const commit = (field: "label" | "label_en" | "url", value: string) => {
    const original = field === "label" ? item.label : field === "label_en" ? (item.label_en || "") : item.url;
    if (value === original) return;
    onSave({ [field]: field === "label_en" ? (value || null) : value } as Partial<NavItem>);
  };

  return (
    <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card">
      <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => commit("label", label)}
        onKeyDown={(e) => {
          if ((e as any).nativeEvent?.isComposing) return;
          if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
        }}
        placeholder="라벨 (한글)"
        className="text-xs h-8 flex-1"
      />
      <Input
        value={labelEn}
        onChange={(e) => setLabelEn(e.target.value)}
        onBlur={() => commit("label_en", labelEn)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
        }}
        placeholder="EN"
        className="text-xs h-8 w-24"
      />
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onBlur={() => commit("url", url)}
        onKeyDown={(e) => {
          if ((e as any).nativeEvent?.isComposing) return;
          if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
        }}
        placeholder="/path 또는 https://"
        className="text-xs h-8 flex-1"
      />
      <Switch
        checked={item.is_active}
        onCheckedChange={(v) => onSave({ is_active: v })}
      />
      <Button size="sm" variant="ghost" onClick={onDelete} className="text-destructive hover:text-destructive h-8 w-8 p-0">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

const AdminSiteSettings = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<Partial<SiteSettings>>(emptySettings);

  const { data: settings } = useQuery({
    queryKey: ["site-settings-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as SiteSettings | null;
    },
  });

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      if (settings?.id) {
        const { error } = await supabase.from("site_settings").update(form).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("site_settings").insert(form as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["site-settings-admin"] });
      qc.invalidateQueries({ queryKey: ["site-settings"] });
      toast({ title: "사이트 설정이 저장되었습니다" });
    },
    onError: (e: any) => toast({ title: "저장 실패", description: e.message, variant: "destructive" }),
  });

  // ─── Nav items ────────────────────────────────────────
  const { data: navItems = [] } = useQuery({
    queryKey: ["nav-items-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("nav_items").select("*").order("position").order("sort_order");
      if (error) throw error;
      return (data || []) as NavItem[];
    },
  });

  const upsertNav = useMutation({
    mutationFn: async (item: Partial<NavItem> & { id?: string }) => {
      if (item.id) {
        const { error } = await supabase.from("nav_items").update(item).eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("nav_items").insert(item as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nav-items-admin"] });
      qc.invalidateQueries({ queryKey: ["nav-items"] });
    },
  });

  const deleteNav = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("nav_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nav-items-admin"] });
      qc.invalidateQueries({ queryKey: ["nav-items"] });
      toast({ title: "메뉴 삭제됨" });
    },
  });

  const update = (k: keyof SiteSettings, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const NavSection = ({ position }: { position: "header" | "footer" }) => {
    const items = navItems.filter((i) => i.position === position);
    const [draft, setDraft] = useState<{ label: string; url: string; label_en: string }>({ label: "", url: "", label_en: "" });

    const handleAdd = () => {
      if (!draft.label || !draft.url) return;
      upsertNav.mutate({
        label: draft.label,
        label_en: draft.label_en || null,
        url: draft.url,
        position,
        sort_order: items.length,
        is_active: true,
        open_in_new_tab: false,
      });
      setDraft({ label: "", url: "", label_en: "" });
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {position === "header" ? <Menu className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
            {position === "header" ? "헤더 메뉴" : "풋터 메뉴"}
          </CardTitle>
          <CardDescription className="text-xs">{position === "header" ? "스토어 상단 네비게이션 메뉴" : "풋터 영역 링크"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">등록된 메뉴가 없습니다</p>}
          {items.map((item) => (
            <NavItemRow
              key={item.id}
              item={item}
              onSave={(patch) => upsertNav.mutate({ id: item.id, ...patch })}
              onDelete={() => deleteNav.mutate(item.id)}
            />
          ))}
          <Separator />
          <div className="flex items-center gap-2">
            <Input
              value={draft.label}
              onChange={(e) => setDraft((p) => ({ ...p, label: e.target.value }))}
              onKeyDown={(e) => { if ((e as any).nativeEvent?.isComposing) return; if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
              placeholder="새 메뉴 라벨"
              className="text-xs h-8 flex-1"
            />
            <Input
              value={draft.label_en}
              onChange={(e) => setDraft((p) => ({ ...p, label_en: e.target.value }))}
              placeholder="EN"
              className="text-xs h-8 w-24"
            />
            <Input
              value={draft.url}
              onChange={(e) => setDraft((p) => ({ ...p, url: e.target.value }))}
              onKeyDown={(e) => { if ((e as any).nativeEvent?.isComposing) return; if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
              placeholder="/path"
              className="text-xs h-8 flex-1"
            />
            <Button size="sm" onClick={handleAdd} className="gap-1 h-8">
              <Plus className="h-3.5 w-3.5" /> 추가
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2">
              <Settings2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              사이트 설정
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">로고, 네비게이션, 풋터 정보, 운영 시간을 관리합니다</p>
          </div>
          <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending} className="gap-2">
            <Save className="h-4 w-4" />
            {saveSettings.isPending ? "저장 중..." : "저장"}
          </Button>
        </div>

        <Tabs defaultValue="logos" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="logos" className="gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> 로고</TabsTrigger>
            <TabsTrigger value="nav" className="gap-1.5"><Menu className="h-3.5 w-3.5" /> 네비게이션</TabsTrigger>
            <TabsTrigger value="footer" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> 풋터 정보</TabsTrigger>
            <TabsTrigger value="hours" className="gap-1.5"><Clock className="h-3.5 w-3.5" /> 운영 시간</TabsTrigger>
          </TabsList>

          {/* ─── Logos ───────────────────────── */}
          <TabsContent value="logos" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">로고 이미지</CardTitle>
                <CardDescription className="text-xs">권장: 가로형 PNG/SVG, 2MB 이하 · 투명 배경</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <LogoUploader
                  label="헤더 로고 (스토어 상단)"
                  hint="공개 페이지(스토어, 강의 카탈로그)의 상단 좌측에 표시됩니다"
                  value={form.header_logo_url}
                  onChange={(v) => update("header_logo_url", v)}
                />
                <Separator />
                <LogoUploader
                  label="사이드바 로고 (대시보드)"
                  hint="로그인 후 학습자/관리자 대시보드의 좌측 사이드바 상단에 표시됩니다"
                  value={form.sidebar_logo_url}
                  onChange={(v) => update("sidebar_logo_url", v)}
                />
                <Separator />
                <LogoUploader
                  label="풋터 로고"
                  hint="스토어 풋터 좌측에 표시됩니다 (비워두면 헤더 로고가 사용됩니다)"
                  value={form.footer_logo_url}
                  onChange={(v) => update("footer_logo_url", v)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  히어로 비주얼 배너 <Badge variant="outline" className="text-[10px]">별도 페이지</Badge>
                </CardTitle>
                <CardDescription className="text-xs">메인 페이지 상단의 큰 배너 이미지는 별도 관리됩니다</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" asChild className="gap-1.5">
                  <a href="/admin/banners">
                    배너 관리로 이동 <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Nav ───────────────────────── */}
          <TabsContent value="nav" className="space-y-4 mt-4">
            <NavSection position="header" />
            <NavSection position="footer" />
          </TabsContent>

          {/* ─── Footer ───────────────────────── */}
          <TabsContent value="footer" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">회사 / 사업자 정보</CardTitle>
                <CardDescription className="text-xs">스토어 풋터에 표시되는 정보입니다</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">회사명</Label>
                  <Input value={form.company_name || ""} onChange={(e) => update("company_name", e.target.value)} placeholder="축제운영전문가 자격증 교육원" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">회사명 (영문)</Label>
                  <Input value={form.company_name_en || ""} onChange={(e) => update("company_name_en", e.target.value)} placeholder="Festival Management Certification Institute" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">대표자</Label>
                  <Input value={form.ceo_name || ""} onChange={(e) => update("ceo_name", e.target.value)} placeholder="홍길동" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">사업자 등록번호</Label>
                  <Input value={form.business_number || ""} onChange={(e) => update("business_number", e.target.value)} placeholder="000-00-00000" />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">주소</Label>
                  <Input value={form.company_address || ""} onChange={(e) => update("company_address", e.target.value)} placeholder="서울특별시 강남구 ..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">대표 전화</Label>
                  <Input value={form.company_phone || ""} onChange={(e) => update("company_phone", e.target.value)} placeholder="02-0000-0000" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">이메일</Label>
                  <Input value={form.company_email || ""} onChange={(e) => update("company_email", e.target.value)} placeholder="contact@example.com" />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">풋터 소개 문구</Label>
                  <Textarea value={form.footer_description || ""} onChange={(e) => update("footer_description", e.target.value)} placeholder="WEBHEADS는 ..." rows={2} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">저작권 문구</Label>
                  <Input value={form.copyright_text || ""} onChange={(e) => update("copyright_text", e.target.value)} placeholder="© 2026 WEBHEADS. All rights reserved." />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">소셜 링크</CardTitle>
                <CardDescription className="text-xs">풋터의 SNS 아이콘에 연결됩니다</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Instagram URL</Label>
                  <Input value={form.instagram_url || ""} onChange={(e) => update("instagram_url", e.target.value)} placeholder="https://instagram.com/..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">YouTube URL</Label>
                  <Input value={form.youtube_url || ""} onChange={(e) => update("youtube_url", e.target.value)} placeholder="https://youtube.com/..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Facebook URL</Label>
                  <Input value={form.facebook_url || ""} onChange={(e) => update("facebook_url", e.target.value)} placeholder="https://facebook.com/..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Blog URL</Label>
                  <Input value={form.blog_url || ""} onChange={(e) => update("blog_url", e.target.value)} placeholder="https://blog.naver.com/..." />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">개인정보처리방침</CardTitle>
                <CardDescription className="text-xs">풋터의 "개인정보처리방침" 뱃지 버튼을 클릭하면 모달에 표시됩니다</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  <Label className="text-xs">본문 (마크다운/일반 텍스트)</Label>
                  <Textarea
                    value={form.privacy_policy || ""}
                    onChange={(e) => update("privacy_policy", e.target.value)}
                    placeholder="제1조 (목적)&#10;본 방침은 ..."
                    rows={14}
                    className="text-xs font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">줄바꿈은 그대로 표시됩니다.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Hours ───────────────────────── */}
          <TabsContent value="hours" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">운영 시간 (TIME)</CardTitle>
                <CardDescription className="text-xs">풋터 우측의 TIME 영역에 표시됩니다</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">평일</Label>
                  <Input value={form.hours_weekday || ""} onChange={(e) => update("hours_weekday", e.target.value)} placeholder="평일 09:00 - 18:00" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">점심시간</Label>
                  <Input value={form.hours_lunch || ""} onChange={(e) => update("hours_lunch", e.target.value)} placeholder="점심 12:00 - 13:00" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">주말</Label>
                  <Input value={form.hours_weekend || ""} onChange={(e) => update("hours_weekend", e.target.value)} placeholder="주말 휴무" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">공휴일</Label>
                  <Input value={form.hours_holiday || ""} onChange={(e) => update("hours_holiday", e.target.value)} placeholder="공휴일 휴무" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminSiteSettings;
