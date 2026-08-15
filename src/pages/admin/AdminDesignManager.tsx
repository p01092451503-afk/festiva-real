import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutTemplate, Plus, Pencil, Trash2, ArrowUp, ArrowDown, Upload, X, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

const POSITIONS: Record<string, string> = {
  center: "화면 중앙",
  "top-left": "좌측 상단",
  "top-right": "우측 상단",
  bottom: "하단",
};

const BLOCK_TYPES: Record<string, string> = {
  hero: "히어로 배너",
  courses: "추천 강의",
  categories: "카테고리",
  reviews: "수강 후기",
  notice: "공지사항",
  instructors: "강사 소개",
  cta: "가입 유도(CTA)",
  custom: "자유 HTML",
};

const IMAGE_FITS: Record<string, string> = {
  cover: "맞춤(잘라서 채움)",
  contain: "가운데(전체 보이기)",
  fill: "늘림(비율 무시)",
};

const IMAGE_POSITIONS: Record<string, string> = {
  center: "가운데",
  top: "위쪽",
  bottom: "아래쪽",
  left: "왼쪽",
  right: "오른쪽",
};

const emptyPopup = {
  id: "",
  title: "",
  content: "",
  image_url: "",
  image_fit: "cover",
  image_position: "center",
  link_url: "",
  position: "center",
  width: 420,
  height: 480,
  start_at: "",
  end_at: "",
  is_active: false,
  display_order: 0,
};

const emptyPage = {
  id: "",
  slug: "",
  title: "",
  content: "",
  meta_description: "",
  is_published: false,
  display_order: 0,
};

const emptyBlock = {
  id: "",
  block_type: "hero",
  title: "",
  subtitle: "",
  cta_text: "",
  cta_url: "",
  html: "",
  is_active: true,
  display_order: 0,
};

const toLocalInput = (v: string | null) => (v ? new Date(v).toISOString().slice(0, 16) : "");

/** http(s)/데이터 URL 형태의 이미지 주소인지 검사 */
const isValidImageUrl = (url: string) => {
  const v = url.trim();
  if (!v) return true;
  if (v.startsWith("data:image/")) return true;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

/** site-assets 버킷에 업로드된 파일이면 스토리지 경로를 돌려준다 */
const storagePathFromUrl = (url: string) => {
  const marker = "/storage/v1/object/public/site-assets/";
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length));
};

/** 디자인 관리 — 팝업 · 정적 페이지 · 메인화면 블록 배치 */
const AdminDesignManager = () => {
  const qc = useQueryClient();
  const [popupForm, setPopupForm] = useState(emptyPopup);
  const [pageForm, setPageForm] = useState(emptyPage);
  const [blockForm, setBlockForm] = useState(emptyBlock);
  const [popupOpen, setPopupOpen] = useState(false);
  const [uploadingPopupImage, setUploadingPopupImage] = useState(false);
  const [popupImageError, setPopupImageError] = useState(false);

  /** 이미지 주소 변경 (업로드/직접 입력 공통) */
  const setPopupImageUrl = (url: string) => {
    setPopupImageError(false);
    setPopupForm((f) => ({ ...f, image_url: url }));
  };


  /** 팝업 이미지 업로드 (site-assets 버킷의 popups/ 경로) */
  const uploadPopupImage = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("이미지 파일만 업로드할 수 있습니다");
    if (file.size > 5 * 1024 * 1024) return toast.error("5MB 이하 이미지를 사용하세요");
    setUploadingPopupImage(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `popups/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("site-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("site-assets").getPublicUrl(path);
      setPopupImageUrl(data.publicUrl);
      toast.success("팝업 이미지가 업로드되었습니다");
    } catch (e: any) {
      toast.error(e.message || "업로드에 실패했습니다");
    } finally {
      setUploadingPopupImage(false);
    }
  };
  const [pageOpen, setPageOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);

  const { data: popups = [] } = useQuery({
    queryKey: ["site-popups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_popups").select("*").order("display_order");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: pages = [] } = useQuery({
    queryKey: ["static-pages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("static_pages").select("*").order("display_order");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: blocks = [] } = useQuery({
    queryKey: ["main-page-blocks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("main_page_blocks").select("*").order("display_order");
      if (error) throw error;
      return data as any[];
    },
  });

  const invalidate = (key: string) => qc.invalidateQueries({ queryKey: [key] });

  const savePopup = async () => {
    if (!popupForm.title.trim()) return toast.error("팝업 제목을 입력하세요");
    const imageUrl = popupForm.image_url.trim();
    if (!isValidImageUrl(imageUrl)) return toast.error("이미지 주소는 http(s):// 로 시작해야 합니다");
    if (imageUrl && popupImageError) return toast.error("이미지를 불러올 수 없는 주소입니다. 주소를 확인하세요");
    const payload = {
      title: popupForm.title.trim(),
      content: popupForm.content || null,
      image_url: imageUrl || null,
      image_fit: popupForm.image_fit || "cover",
      image_position: popupForm.image_position || "center",
      link_url: popupForm.link_url || null,
      position: popupForm.position,
      width: Number(popupForm.width) || 420,
      height: Number(popupForm.height) || 480,
      start_at: popupForm.start_at ? new Date(popupForm.start_at).toISOString() : null,
      end_at: popupForm.end_at ? new Date(popupForm.end_at).toISOString() : null,
      is_active: popupForm.is_active,
      display_order: Number(popupForm.display_order) || 0,
    };
    const { error } = popupForm.id
      ? await supabase.from("site_popups").update(payload).eq("id", popupForm.id)
      : await supabase.from("site_popups").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("저장되었습니다");
    setPopupOpen(false);
    setPopupForm(emptyPopup);
    setPopupImageError(false);
    invalidate("site-popups");
  };

  /** 팝업 삭제 — 업로드된 이미지가 있으면 스토리지 파일도 함께 정리 */
  const removePopup = async (p: any) => {
    if (!window.confirm(`'${p.title}' 팝업을 삭제할까요?`)) return;
    const { error } = await supabase.from("site_popups").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    const path = p.image_url ? storagePathFromUrl(p.image_url) : null;
    if (path) await supabase.storage.from("site-assets").remove([path]);
    toast.success("삭제되었습니다");
    invalidate("site-popups");
  };


  const savePage = async () => {
    if (!pageForm.title.trim() || !pageForm.slug.trim()) return toast.error("제목과 주소(slug)를 입력하세요");
    const payload = {
      slug: pageForm.slug.trim().replace(/^\/+/, ""),
      title: pageForm.title.trim(),
      content: pageForm.content || null,
      meta_description: pageForm.meta_description || null,
      is_published: pageForm.is_published,
      display_order: Number(pageForm.display_order) || 0,
    };
    const { error } = pageForm.id
      ? await supabase.from("static_pages").update(payload).eq("id", pageForm.id)
      : await supabase.from("static_pages").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("저장되었습니다");
    setPageOpen(false);
    setPageForm(emptyPage);
    invalidate("static-pages");
  };

  const saveBlock = async () => {
    const payload = {
      block_type: blockForm.block_type,
      title: blockForm.title || null,
      subtitle: blockForm.subtitle || null,
      config: {
        ...(blockForm.block_type === "cta"
          ? { cta_text: blockForm.cta_text || null, cta_url: blockForm.cta_url || null }
          : {}),
        ...(blockForm.block_type === "custom" ? { html: blockForm.html || null } : {}),
      },
      is_active: blockForm.is_active,
      display_order: Number(blockForm.display_order) || blocks.length,
    };
    const { error } = blockForm.id
      ? await supabase.from("main_page_blocks").update(payload).eq("id", blockForm.id)
      : await supabase.from("main_page_blocks").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("저장되었습니다");
    setBlockOpen(false);
    setBlockForm(emptyBlock);
    invalidate("main-page-blocks");
  };

  const remove = async (table: "site_popups" | "static_pages" | "main_page_blocks", id: string, key: string) => {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("삭제되었습니다");
    invalidate(key);
  };

  const moveBlock = async (index: number, dir: -1 | 1) => {
    const target = blocks[index + dir];
    const current = blocks[index];
    if (!target || !current) return;
    await supabase.from("main_page_blocks").update({ display_order: target.display_order }).eq("id", current.id);
    await supabase.from("main_page_blocks").update({ display_order: current.display_order }).eq("id", target.id);
    invalidate("main-page-blocks");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5" /> 디자인 관리
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            팝업, 정적 페이지, 메인화면 블록 배치를 코드 수정 없이 운영합니다.
          </p>
        </div>

        <Tabs defaultValue="popups">
          <TabsList>
            <TabsTrigger value="popups">팝업</TabsTrigger>
            <TabsTrigger value="pages">정적 페이지</TabsTrigger>
            <TabsTrigger value="blocks">메인화면 블록</TabsTrigger>
          </TabsList>

          {/* 팝업 */}
          <TabsContent value="popups" className="space-y-4 pt-4">
            <div className="flex justify-end">
              <Button size="sm" className="gap-1.5" onClick={() => { setPopupForm(emptyPopup); setPopupOpen(true); }}>
                <Plus className="h-4 w-4" /> 팝업 등록
              </Button>
            </div>
            <div className="rounded-xl border divide-y">
              {popups.length === 0 && <p className="p-6 text-sm text-muted-foreground text-center">등록된 팝업이 없습니다.</p>}
              {popups.map((p) => (
                <div key={p.id} className="p-4 flex flex-wrap items-center justify-between gap-3 min-w-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-12 w-16 shrink-0 rounded-md border bg-muted/40 overflow-hidden flex items-center justify-center">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={`${p.title} 팝업 이미지`}
                          className="h-full w-full"
                          style={{ objectFit: (p.image_fit || "cover") as any, objectPosition: p.image_position || "center" }}
                          loading="lazy"
                        />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{p.title}</span>
                      <Badge variant={p.is_active ? "default" : "secondary"} className="whitespace-nowrap">
                        {p.is_active ? "노출중" : "중지"}
                      </Badge>
                      <Badge variant="outline" className="whitespace-nowrap">{POSITIONS[p.position] || p.position}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {p.width}×{p.height}px
                      {p.start_at && ` · ${new Date(p.start_at).toLocaleDateString("ko-KR")} ~ `}
                      {p.end_at && new Date(p.end_at).toLocaleDateString("ko-KR")}
                    </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={p.is_active}
                      onCheckedChange={async () => {
                        await supabase.from("site_popups").update({ is_active: !p.is_active }).eq("id", p.id);
                        invalidate("site-popups");
                      }}
                    />
                    <Button variant="ghost" size="icon" onClick={() => {
                      setPopupImageError(false);
                      setPopupForm({
                        id: p.id, title: p.title, content: p.content || "", image_url: p.image_url || "",
                        image_fit: p.image_fit || "cover", image_position: p.image_position || "center",
                        link_url: p.link_url || "", position: p.position, width: p.width, height: p.height,
                        start_at: toLocalInput(p.start_at), end_at: toLocalInput(p.end_at),
                        is_active: p.is_active, display_order: p.display_order,
                      });
                      setPopupOpen(true);
                    }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="팝업 삭제" onClick={() => removePopup(p)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* 정적 페이지 */}
          <TabsContent value="pages" className="space-y-4 pt-4">
            <div className="flex justify-end">
              <Button size="sm" className="gap-1.5" onClick={() => { setPageForm(emptyPage); setPageOpen(true); }}>
                <Plus className="h-4 w-4" /> 페이지 등록
              </Button>
            </div>
            <div className="rounded-xl border divide-y">
              {pages.length === 0 && <p className="p-6 text-sm text-muted-foreground text-center">등록된 페이지가 없습니다.</p>}
              {pages.map((p) => (
                <div key={p.id} className="p-4 flex flex-wrap items-center justify-between gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{p.title}</span>
                      <Badge variant={p.is_published ? "default" : "secondary"} className="whitespace-nowrap">
                        {p.is_published ? "공개" : "비공개"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">/p/{p.slug}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={p.is_published}
                      onCheckedChange={async () => {
                        await supabase.from("static_pages").update({ is_published: !p.is_published }).eq("id", p.id);
                        invalidate("static-pages");
                      }}
                    />
                    <Button variant="ghost" size="icon" onClick={() => {
                      setPageForm({
                        id: p.id, slug: p.slug, title: p.title, content: p.content || "",
                        meta_description: p.meta_description || "", is_published: p.is_published,
                        display_order: p.display_order,
                      });
                      setPageOpen(true);
                    }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove("static_pages", p.id, "static-pages")}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* 메인화면 블록 */}
          <TabsContent value="blocks" className="space-y-4 pt-4">
            <div className="flex justify-end">
              <Button size="sm" className="gap-1.5" onClick={() => { setBlockForm({ ...emptyBlock, display_order: blocks.length }); setBlockOpen(true); }}>
                <Plus className="h-4 w-4" /> 블록 추가
              </Button>
            </div>
            <div className="rounded-xl border divide-y">
              {blocks.length === 0 && <p className="p-6 text-sm text-muted-foreground text-center">등록된 블록이 없습니다.</p>}
              {blocks.map((b, i) => (
                <div key={b.id} className="p-4 flex flex-wrap items-center justify-between gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground w-6">{i + 1}</span>
                      <span className="font-medium truncate">{b.title || BLOCK_TYPES[b.block_type] || b.block_type}</span>
                      <Badge variant="outline" className="whitespace-nowrap">{BLOCK_TYPES[b.block_type] || b.block_type}</Badge>
                      <Badge variant={b.is_active ? "default" : "secondary"} className="whitespace-nowrap">
                        {b.is_active ? "표시" : "숨김"}
                      </Badge>
                    </div>
                    {b.subtitle && <p className="text-xs text-muted-foreground mt-1 truncate">{b.subtitle}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => moveBlock(i, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" disabled={i === blocks.length - 1} onClick={() => moveBlock(i, 1)}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Switch
                      checked={b.is_active}
                      onCheckedChange={async () => {
                        await supabase.from("main_page_blocks").update({ is_active: !b.is_active }).eq("id", b.id);
                        invalidate("main-page-blocks");
                      }}
                    />
                    <Button variant="ghost" size="icon" onClick={() => {
                      setBlockForm({
                        id: b.id, block_type: b.block_type, title: b.title || "", subtitle: b.subtitle || "",
                        cta_text: (b.config as any)?.cta_text || "", cta_url: (b.config as any)?.cta_url || "",
                        html: (b.config as any)?.html || "",
                        is_active: b.is_active, display_order: b.display_order,
                      });
                      setBlockOpen(true);
                    }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove("main_page_blocks", b.id, "main-page-blocks")}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* 팝업 다이얼로그 */}
      <Dialog open={popupOpen} onOpenChange={(o) => { setPopupOpen(o); if (!o) { setPopupForm(emptyPopup); setPopupImageError(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{popupForm.id ? "팝업 수정" : "팝업 등록"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>제목</Label><Input value={popupForm.title} onChange={(e) => setPopupForm({ ...popupForm, title: e.target.value })} /></div>
            <div><Label>내용</Label><Textarea rows={3} value={popupForm.content} onChange={(e) => setPopupForm({ ...popupForm, content: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>팝업 이미지</Label>
              <div className="flex items-start gap-3 min-w-0">
                <div className="h-24 w-24 shrink-0 rounded-md border bg-muted/30 overflow-hidden flex items-center justify-center">
                  {popupForm.image_url && !popupImageError ? (
                    <img
                      key={popupForm.image_url}
                      src={popupForm.image_url}
                      alt="팝업 이미지 미리보기"
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={() => setPopupImageError(true)}
                      onLoad={() => setPopupImageError(false)}
                    />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground" aria-hidden />
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <input
                      id="popup-image-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void uploadPopupImage(file);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingPopupImage}
                      onClick={() => document.getElementById("popup-image-input")?.click()}
                    >
                      {uploadingPopupImage ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" aria-hidden />
                      )}
                      {uploadingPopupImage ? "업로드 중…" : "이미지 업로드"}
                    </Button>
                    {popupForm.image_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPopupImageUrl("")}
                      >
                        <X className="h-4 w-4 mr-2" aria-hidden />
                        이미지 제거
                      </Button>
                    )}
                  </div>
                  <Input
                    placeholder="또는 이미지 URL 직접 입력 (https://...)"
                    value={popupForm.image_url}
                    onChange={(e) => setPopupImageUrl(e.target.value)}
                    aria-invalid={!isValidImageUrl(popupForm.image_url) || popupImageError}
                  />
                  {!isValidImageUrl(popupForm.image_url) ? (
                    <p className="text-xs text-destructive">http(s):// 로 시작하는 이미지 주소를 입력하세요.</p>
                  ) : popupForm.image_url && popupImageError ? (
                    <p className="text-xs text-destructive">이미지를 불러올 수 없습니다. 주소를 확인하세요.</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">JPG·PNG·WebP, 5MB 이하 권장</p>
                  )}
                </div>
              </div>
            </div>
            {popupForm.image_url && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>이미지 배치</Label>
                    <Select value={popupForm.image_fit} onValueChange={(v) => setPopupForm({ ...popupForm, image_fit: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(IMAGE_FITS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>기준 위치(잘리는 방향)</Label>
                    <Select
                      value={popupForm.image_position}
                      onValueChange={(v) => setPopupForm({ ...popupForm, image_position: v })}
                      disabled={popupForm.image_fit === "fill"}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(IMAGE_POSITIONS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>팝업 미리보기</Label>
                  <div className="mt-1 flex justify-center rounded-md border bg-muted/20 p-3">
                    <div
                      className="overflow-hidden rounded-md border bg-card"
                      style={{
                        width: Math.min(Number(popupForm.width) || 420, 320),
                        aspectRatio: `${Number(popupForm.width) || 420} / ${Number(popupForm.height) || 480}`,
                      }}
                    >
                      <img
                        src={popupForm.image_url}
                        alt="팝업 미리보기"
                        className="h-full w-full"
                        style={{ objectFit: popupForm.image_fit as any, objectPosition: popupForm.image_position }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">실제 팝업 크기({popupForm.width}×{popupForm.height}px) 비율로 표시됩니다.</p>
                </div>
              </div>
            )}
            <div><Label>클릭 시 이동 URL</Label><Input value={popupForm.link_url} onChange={(e) => setPopupForm({ ...popupForm, link_url: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>노출 위치</Label>
                <Select value={popupForm.position} onValueChange={(v) => setPopupForm({ ...popupForm, position: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(POSITIONS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>가로(px)</Label><Input type="number" value={popupForm.width} onChange={(e) => setPopupForm({ ...popupForm, width: Number(e.target.value) })} /></div>
              <div><Label>세로(px)</Label><Input type="number" value={popupForm.height} onChange={(e) => setPopupForm({ ...popupForm, height: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>노출 시작</Label><Input type="datetime-local" value={popupForm.start_at} onChange={(e) => setPopupForm({ ...popupForm, start_at: e.target.value })} /></div>
              <div><Label>노출 종료</Label><Input type="datetime-local" value={popupForm.end_at} onChange={(e) => setPopupForm({ ...popupForm, end_at: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={popupForm.is_active} onCheckedChange={(v) => setPopupForm({ ...popupForm, is_active: v })} />
              <span className="text-sm">즉시 노출</span>
            </div>
          </div>
          <DialogFooter><Button onClick={savePopup}>저장</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 정적 페이지 다이얼로그 */}
      <Dialog open={pageOpen} onOpenChange={setPageOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{pageForm.id ? "페이지 수정" : "페이지 등록"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>페이지 제목</Label><Input value={pageForm.title} onChange={(e) => setPageForm({ ...pageForm, title: e.target.value })} /></div>
            <div><Label>주소(slug)</Label><Input placeholder="about" value={pageForm.slug} onChange={(e) => setPageForm({ ...pageForm, slug: e.target.value })} /></div>
            <div><Label>본문</Label><Textarea rows={6} value={pageForm.content} onChange={(e) => setPageForm({ ...pageForm, content: e.target.value })} /></div>
            <div><Label>검색 설명(meta)</Label><Input value={pageForm.meta_description} onChange={(e) => setPageForm({ ...pageForm, meta_description: e.target.value })} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={pageForm.is_published} onCheckedChange={(v) => setPageForm({ ...pageForm, is_published: v })} />
              <span className="text-sm">공개</span>
            </div>
          </div>
          <DialogFooter><Button onClick={savePage}>저장</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 블록 다이얼로그 */}
      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{blockForm.id ? "블록 수정" : "블록 추가"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>블록 종류</Label>
              <Select value={blockForm.block_type} onValueChange={(v) => setBlockForm({ ...blockForm, block_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(BLOCK_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>제목</Label><Input value={blockForm.title} onChange={(e) => setBlockForm({ ...blockForm, title: e.target.value })} /></div>
            <div><Label>부제</Label><Input value={blockForm.subtitle} onChange={(e) => setBlockForm({ ...blockForm, subtitle: e.target.value })} /></div>
            {blockForm.block_type === "cta" && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>버튼 문구</Label><Input value={blockForm.cta_text} onChange={(e) => setBlockForm({ ...blockForm, cta_text: e.target.value })} /></div>
                <div><Label>버튼 링크</Label><Input placeholder="/auth" value={blockForm.cta_url} onChange={(e) => setBlockForm({ ...blockForm, cta_url: e.target.value })} /></div>
              </div>
            )}
            {blockForm.block_type === "custom" && (
              <div>
                <Label>HTML 내용</Label>
                <Textarea rows={6} value={blockForm.html} onChange={(e) => setBlockForm({ ...blockForm, html: e.target.value })} />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={blockForm.is_active} onCheckedChange={(v) => setBlockForm({ ...blockForm, is_active: v })} />
              <span className="text-sm">메인에 표시</span>
            </div>
          </div>
          <DialogFooter><Button onClick={saveBlock}>저장</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminDesignManager;
