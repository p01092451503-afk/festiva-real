import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Image as ImageIcon, Plus, Trash2, ArrowUp, ArrowDown, Edit, Loader2, Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BannerForm {
  id?: string; title: string; subtitle: string; cta_text: string; cta_url: string; image_url: string; bg_color: string; is_active: boolean; starts_at: string; ends_at: string; sort_order: number;
}
const emptyForm: BannerForm = { title: "", subtitle: "", cta_text: "", cta_url: "", image_url: "", bg_color: "#1a1a2e", is_active: false, starts_at: "", ends_at: "", sort_order: 0 };

const AdminBanners = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<BannerForm>(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const { data: banners = [] } = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("hero_banners").select("*").order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("hero_banners").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, is_active }) => {
      queryClient.setQueryData(["admin-banners"], (old: any[]) => (old || []).map((b) => (b.id === id ? { ...b, is_active } : b)));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["admin-banners"] }),
  });

  const saveBanner = useMutation({
    mutationFn: async (data: BannerForm) => {
      const payload = { title: data.title, subtitle: data.subtitle || null, cta_text: data.cta_text || null, cta_url: data.cta_url || null, image_url: data.image_url, bg_color: data.bg_color || "#1a1a2e", is_active: data.is_active, starts_at: data.starts_at || null, ends_at: data.ends_at || null, sort_order: data.sort_order };
      if (data.id) {
        const { error } = await supabase.from("hero_banners").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("hero_banners").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-banners"] }); setDialogOpen(false); toast({ title: "배너가 저장되었습니다." }); },
    onError: (e: any) => toast({ title: "저장 실패", description: e.message, variant: "destructive" }),
  });

  const deleteBanner = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("hero_banners").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-banners"] }); toast({ title: "배너가 삭제되었습니다." }); },
  });

  const swapOrder = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= banners.length) return;
    const a = banners[idx], b = banners[target];
    await Promise.all([
      supabase.from("hero_banners").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("hero_banners").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
  };

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true); setUploadProgress(30);
    try {
      const path = `${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("banners").upload(path, file, { upsert: true });
      if (error) throw error;
      setUploadProgress(80);
      const { data } = supabase.storage.from("banners").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: data.publicUrl }));
      setUploadProgress(100);
    } catch (e: any) { toast({ title: "업로드 실패", description: e.message, variant: "destructive" }); }
    finally { setTimeout(() => { setUploading(false); setUploadProgress(0); }, 500); }
  };

  const openEdit = (b: any) => { setForm({ id: b.id, title: b.title, subtitle: b.subtitle || "", cta_text: b.cta_text || "", cta_url: b.cta_url || "", image_url: b.image_url, bg_color: b.bg_color || "#1a1a2e", is_active: b.is_active, starts_at: b.starts_at || "", ends_at: b.ends_at || "", sort_order: b.sort_order }); setDialogOpen(true); };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2"><ImageIcon className="h-6 w-6" /> 배너 관리</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">스토어 홈 히어로 배너를 관리합니다.</p>
          </div>
          <Button className="rounded-xl gap-2 w-full sm:w-auto" onClick={() => { setForm({ ...emptyForm, sort_order: banners.length }); setDialogOpen(true); }}><Plus className="h-4 w-4" /> 배너 추가</Button>
        </div>

        {/* Desktop Table */}
        <div className="stat-card !p-0 overflow-hidden hidden md:block">
          <table className="w-full">
            <thead><tr className="border-b border-border bg-secondary/30">
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">미리보기</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">제목</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">기간</th>
              <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3">활성</th>
              <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3">순서</th>
              <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">관리</th>
            </tr></thead>
            <tbody>
              {banners.map((banner: any, idx: number) => (
                <tr key={banner.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3"><img src={banner.image_url} alt="" className="h-10 w-20 rounded object-cover bg-muted" /></td>
                  <td className="px-4 py-3"><p className="text-sm font-medium text-foreground">{banner.title}</p>{banner.subtitle && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{banner.subtitle}</p>}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">{banner.starts_at ? new Date(banner.starts_at).toLocaleDateString("ko-KR") : "상시"} ~ {banner.ends_at ? new Date(banner.ends_at).toLocaleDateString("ko-KR") : ""}</td>
                  <td className="px-4 py-3 text-center"><Switch checked={banner.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: banner.id, is_active: v })} /></td>
                  <td className="px-4 py-3 text-center"><div className="flex items-center justify-center gap-1">
                    <button onClick={() => swapOrder(idx, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                    <button onClick={() => swapOrder(idx, 1)} disabled={idx === banners.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                  </div></td>
                  <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(banner)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => deleteBanner.mutate(banner.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div></td>
                </tr>
              ))}
              {banners.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-sm text-muted-foreground">등록된 배너가 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-2">
          {banners.map((banner: any, idx: number) => (
            <div key={banner.id} className="stat-card !p-3">
              <div className="flex items-start gap-3">
                <img src={banner.image_url} alt="" className="h-14 w-20 rounded object-cover bg-muted shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{banner.title}</p>
                  {banner.subtitle && <p className="text-xs text-muted-foreground truncate">{banner.subtitle}</p>}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {banner.starts_at ? new Date(banner.starts_at).toLocaleDateString("ko-KR") : "상시"}
                    {(banner.starts_at || banner.ends_at) && " ~ "}
                    {banner.ends_at ? new Date(banner.ends_at).toLocaleDateString("ko-KR") : ""}
                  </p>
                </div>
                <Switch checked={banner.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: banner.id, is_active: v })} />
              </div>
              <div className="flex items-center justify-between gap-1 mt-2">
                <div className="flex items-center gap-1">
                  <button onClick={() => swapOrder(idx, -1)} disabled={idx === 0} className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-accent disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                  <button onClick={() => swapOrder(idx, 1)} disabled={idx === banners.length - 1} className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-accent disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                </div>
                <div className="flex items-center gap-1 -mr-1">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(banner)}><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => deleteBanner.mutate(banner.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          ))}
          {banners.length === 0 && <div className="stat-card !p-8 text-center text-sm text-muted-foreground">등록된 배너가 없습니다.</div>}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{form.id ? "배너 수정" : "배너 추가"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>제목 *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="space-y-2"><Label>부제목</Label><Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>CTA 텍스트</Label><Input value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} placeholder="자세히 보기" /></div>
                <div className="space-y-2"><Label>CTA URL</Label><Input value={form.cta_url} onChange={(e) => setForm({ ...form, cta_url: e.target.value })} placeholder="/store/courses" /></div>
              </div>
              <div className="space-y-2">
                <Label>배너 이미지 *</Label>
                <p className="text-[10px] text-muted-foreground">권장 크기: 1920×600px</p>
                {form.image_url ? (
                  <div className="relative"><img src={form.image_url} alt="" className="w-full h-32 rounded-lg object-cover" /><button type="button" onClick={() => setForm({ ...form, image_url: "" })} className="absolute top-2 right-2 h-6 w-6 rounded bg-background/80 flex items-center justify-center"><Trash2 className="h-3 w-3" /></button></div>
                ) : (
                  <div><input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} className="hidden" id="banner-upload" /><label htmlFor="banner-upload" className="flex items-center justify-center gap-2 h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 text-sm text-muted-foreground">{uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}{uploading ? "업로드 중..." : "이미지 선택"}</label>{uploading && <Progress value={uploadProgress} className="h-1 mt-2" />}</div>
                )}
              </div>
              <div className="space-y-2"><Label>배경 색상</Label><Input value={form.bg_color} onChange={(e) => setForm({ ...form, bg_color: e.target.value })} placeholder="#1a1a2e" /></div>
              <div className="flex items-center gap-3"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><span className="text-sm text-foreground">활성화</span></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
              <Button onClick={() => saveBanner.mutate(form)} disabled={!form.title || !form.image_url || saveBanner.isPending}>{saveBanner.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}저장</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminBanners;
