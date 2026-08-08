import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Video, Plus, Search, Trash2, Copy, Edit, ExternalLink, HardDrive, Clock, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import RichStatCard from "@/components/admin/stats/RichStatCard";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import BunnyUploader from "@/components/admin/BunnyUploader";
import DirectVideoUploader from "@/components/admin/DirectVideoUploader";
import BunnyDurationSyncDialog from "@/components/admin/BunnyDurationSyncDialog";
import BunnyImportDialog from "@/components/admin/BunnyImportDialog";
import BunnyMultiUploadDialog from "@/components/admin/BunnyMultiUploadDialog";
import { formatDurationMs } from "@/lib/duration";
import { useCdnAdminUnlock, maskCdnUrl } from "@/components/admin/CdnAdminUnlock";

interface VideoAsset {
  id: string;
  title: string;
  video_url: string;
  video_provider: string;
  bunny_video_guid: string | null;
  storage_path?: string | null;
  duration_minutes: number | null;
  file_size_mb: number | null;
  description: string | null;
  thumbnail_url: string | null;
  uploaded_by: string;
  created_at: string;
}

const AdminVideos = () => {
  const { t } = useTranslation();
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { unlocked: cdnUnlocked, button: cdnUnlockButton, dialog: cdnUnlockDialog } = useCdnAdminUnlock();
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const providerLabels: Record<string, string> = {
    custom: t("videoMgmt.providerCustom"),
    youtube: t("videoMgmt.providerYoutube"),
    vimeo: t("videoMgmt.providerVimeo"),
    upload: t("videoMgmt.providerUpload"),
    storage: "CDN 직접 업로드",
    bunny: t("videoMgmt.providerBunny"),
    cloudflare: t("videoMgmt.providerCloudflare"),
    kollus: t("videoMgmt.providerKollus"),
  };

  // Provider-aware label/placeholder/hint for the URL field
  const getUrlFieldMeta = (provider: string) => {
    switch (provider) {
      case "youtube":
        return {
          label: "YouTube 링크",
          placeholder: "https://www.youtube.com/watch?v=... 또는 https://youtu.be/...",
          hint: "YouTube 영상 URL을 그대로 붙여넣으세요. 비공개/연령 제한 영상은 재생되지 않을 수 있습니다.",
        };
      case "vimeo":
        return {
          label: "Vimeo 링크",
          placeholder: "https://vimeo.com/123456789",
          hint: "Vimeo 영상 URL을 입력하세요. 비공개 영상의 경우 임베드 권한이 허용되어 있어야 합니다.",
        };
      case "kollus":
        return {
          label: t("videoMgmt.fieldKollusKey"),
          placeholder: t("videoMgmt.fieldKollusPlaceholder"),
          hint: t("videoMgmt.fieldKollusHint"),
        };
      case "cloudflare":
        return {
          label: "Cloudflare Stream URL",
          placeholder: "https://customer-xxxx.cloudflarestream.com/.../manifest/video.m3u8",
          hint: "Cloudflare Stream의 HLS(.m3u8) 또는 iframe URL을 입력하세요.",
        };
      case "storage":
        return {
          label: "CDN 직접 업로드",
          placeholder: "업로드 완료 시 자동으로 입력됩니다.",
          hint: "영상 파일을 우리 CDN 스토리지에 직접 업로드합니다.",
        };
      case "upload":
        return {
          label: "CDN 업로드",
          placeholder: "업로드 완료 시 자동으로 입력됩니다.",
          hint: "아래 업로드 버튼으로 영상 파일을 직접 CDN에 업로드합니다.",
        };
      case "custom":
      default:
        return {
          label: "CDN / 직접 URL",
          placeholder: "https://cdn.example.com/videos/lesson.mp4",
          hint: "MP4·HLS(.m3u8) 등 직접 재생 가능한 영상 URL을 입력하세요.",
        };
    }
  };

  const [form, setForm] = useState({
    title: "",
    video_url: "",
    video_provider: "custom",
    bunny_video_guid: "",
    storage_path: "",
    duration_minutes: "",
    file_size_mb: "",
    description: "",
    thumbnail_url: "",
  });

  const resetForm = () => {
    setForm({ title: "", video_url: "", video_provider: "custom", bunny_video_guid: "", storage_path: "", duration_minutes: "", file_size_mb: "", description: "", thumbnail_url: "" });
    setEditingId(null);
  };

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["video-assets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_assets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as VideoAsset[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        video_url: form.video_url,
        video_provider: form.video_provider,
        bunny_video_guid: form.bunny_video_guid || null,
        storage_path: form.storage_path || null,
        duration_minutes: form.duration_minutes ? parseFloat(form.duration_minutes) : null,
        file_size_mb: form.file_size_mb ? parseFloat(form.file_size_mb) : null,
        description: form.description || null,
        thumbnail_url: form.thumbnail_url || null,
        uploaded_by: user!.id,
      };
      if (editingId) {
        const { error } = await supabase.from("video_assets").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("video_assets").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-assets"] });
      toast({ title: editingId ? t("videoMgmt.updated") : t("videoMgmt.saved") });
      setDialogOpen(false);
      resetForm();
    },
    onError: () => toast({ title: t("videoMgmt.saveFailed"), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("video_assets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-assets"] });
      toast({ title: t("videoMgmt.deleted") });
      setDeleteId(null);
    },
  });

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: t("videoMgmt.urlCopied") });
  };

  const openEdit = (v: VideoAsset) => {
    setForm({
      title: v.title,
      video_url: v.video_url,
      video_provider: v.video_provider,
      bunny_video_guid: v.bunny_video_guid || "",
      storage_path: v.storage_path || "",
      duration_minutes: v.duration_minutes?.toString() || "",
      file_size_mb: v.file_size_mb?.toString() || "",
      description: v.description || "",
      thumbnail_url: v.thumbnail_url || "",
    });
    setEditingId(v.id);
    setDialogOpen(true);
  };

  const filtered = videos.filter((v) => {
    const matchSearch = v.title.toLowerCase().includes(search.toLowerCase()) || v.video_url.toLowerCase().includes(search.toLowerCase());
    const matchProvider = providerFilter === "all" || v.video_provider === providerFilter;
    return matchSearch && matchProvider;
  });

  const urlMeta = getUrlFieldMeta(form.video_provider);
  const isUploadMode = form.video_provider === "upload";
  const isStorageMode = form.video_provider === "storage";

  const totalSizeMb = videos.reduce((sum, v) => sum + (v.file_size_mb || 0), 0);
  const totalDuration = videos.reduce((sum, v) => sum + (v.duration_minutes || 0), 0);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Video className="h-6 w-6" /> {t("videoMgmt.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("videoMgmt.subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {cdnUnlockButton}
            <BunnyImportDialog />
            <BunnyDurationSyncDialog />
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setForm((prev) => ({ ...prev, video_provider: "storage" }));
                setDialogOpen(true);
              }}
            >
              <Upload className="h-4 w-4 mr-1" /> CDN 직접 업로드
            </Button>
            <Button onClick={() => setUploadOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> 동영상 업로드
            </Button>
          </div>
        </div>

        {/* Summary Cards — visualized */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <RichStatCard
            label={t("videoMgmt.totalVideos")}
            value={`${videos.length}${t("common.count", "")}`}
            icon={Video}
            tone="indigo"
            visual="sparkline"
            sparklineValues={[2, 4, 3, 6, 5, 7, 8]}
          />
          <RichStatCard
            label={t("videoMgmt.totalSize")}
            value={totalSizeMb >= 1024 ? `${(totalSizeMb / 1024).toFixed(1)}GB` : `${totalSizeMb.toFixed(0)}MB`}
            icon={HardDrive}
            tone="violet"
            visual="bar"
            barValue={Math.min(100, (totalSizeMb / 1024 / 50) * 100)}
            barCaption={`${(totalSizeMb / 1024).toFixed(2)} GB / 50 GB`}
          />
          <RichStatCard
            label={t("videoMgmt.totalDuration")}
            value={`${Math.floor(totalDuration / 60)}${t("common.hours")} ${totalDuration % 60}${t("common.minutes")}`}
            icon={Clock}
            tone="sky"
            visual="ring"
            ringValue={Math.min(100, Math.round((totalDuration / 600) * 100))}
            sub={`${totalDuration} ${t("common.minutes")}`}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("videoMgmt.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("common.filter")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("videoMgmt.all")}</SelectItem>
              <SelectItem value="custom">{t("videoMgmt.providerCustom")}</SelectItem>
              <SelectItem value="upload">{t("videoMgmt.providerUpload")}</SelectItem>
              <SelectItem value="youtube">{t("videoMgmt.providerYoutube")}</SelectItem>
              <SelectItem value="vimeo">{t("videoMgmt.providerVimeo")}</SelectItem>
              <SelectItem value="cloudflare">{t("videoMgmt.providerCloudflare")}</SelectItem>
              <SelectItem value="kollus">{t("videoMgmt.providerKollus")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("videoMgmt.colTitle")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("videoMgmt.colProvider")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("videoMgmt.colDuration")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("videoMgmt.colSize")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("videoMgmt.colDate")}</TableHead>
                <TableHead className="text-right">{t("videoMgmt.colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("common.loading")}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("videoMgmt.noVideos")}</TableCell></TableRow>
              ) : filtered.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {v.thumbnail_url ? (
                        <img src={v.thumbnail_url} alt="" className="h-10 w-16 rounded object-cover bg-muted" />
                      ) : (
                        <div className="h-10 w-16 rounded bg-muted flex items-center justify-center"><Video className="h-4 w-4 text-muted-foreground" /></div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{v.title}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {cdnUnlocked ? v.video_url : maskCdnUrl(v.video_url)}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="secondary">{providerLabels[v.video_provider] || v.video_provider}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{formatDurationMs(v.duration_minutes)}</TableCell>
                  <TableCell className="hidden lg:table-cell">{v.file_size_mb ? `${v.file_size_mb}MB` : "-"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{new Date(v.created_at).toLocaleDateString("ko")}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {cdnUnlocked && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => copyUrl(v.video_url)} title={t("videoMgmt.copyUrl")}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" asChild title={t("videoMgmt.open")}>
                            <a href={v.video_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => openEdit(v)} title={t("common.edit")}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(v.id)} title={t("common.delete")}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetForm(); setDialogOpen(o); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? t("videoMgmt.editVideo") : t("videoMgmt.addVideo")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("videoMgmt.fieldTitle")}</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("videoMgmt.fieldTitlePlaceholder")} />
            </div>
            {isStorageMode ? (
              <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
                영상 파일을 선택하면 우리 CDN 스토리지에 바로 업로드되고, 재생 URL이 자동으로 채워집니다.
              </div>
            ) : isUploadMode ? (
              <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
                아래 버튼으로 동영상 파일을 선택하면 CDN에 자동으로 업로드됩니다. 업로드가 완료되면 영상이 등록 준비됩니다.
              </div>
            ) : (
              <div>
                <Label>{urlMeta.label}</Label>
                {editingId && !cdnUnlocked && form.video_url ? (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <span className="truncate">{maskCdnUrl(form.video_url)}</span>
                    <span className="shrink-0 text-[10px]">상단 "CDN 주소 보기"로 잠금 해제</span>
                  </div>
                ) : (
                  <>
                    <Input
                      value={form.video_url}
                      onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                      placeholder={urlMeta.placeholder}
                    />
                    <p className="text-xs text-muted-foreground mt-1">{urlMeta.hint}</p>
                  </>
                )}
              </div>
            )}
            {isUploadMode && !editingId && (
              <BunnyUploader
                title={form.title}
                onComplete={({ video_guid, file_size_mb, duration_minutes }) =>
                  setForm((prev) => ({
                    ...prev,
                    bunny_video_guid: video_guid,
                    video_url: `bunny://${video_guid}`,
                    file_size_mb: String(file_size_mb),
                    duration_minutes: duration_minutes != null ? String(duration_minutes) : prev.duration_minutes,
                  }))
                }
              />
            )}
            {isStorageMode && !editingId && (
              <DirectVideoUploader
                title={form.title}
                onComplete={({ video_url, storage_path, file_size_mb, duration_minutes }) =>
                  setForm((prev) => ({
                    ...prev,
                    video_url,
                    storage_path,
                    file_size_mb: String(file_size_mb),
                    duration_minutes: duration_minutes != null ? String(duration_minutes) : prev.duration_minutes,
                  }))
                }
              />
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("videoMgmt.fieldProvider")}</Label>
                <Select
                  value={form.video_provider}
                  onValueChange={(v) =>
                    setForm((prev) => ({
                      ...prev,
                      video_provider: v,
                      // Reset URL & GUID when switching to/from upload mode to prevent leftover values
                      video_url: v === "upload" || v === "storage" ? "" : prev.video_url,
                      bunny_video_guid: v === "upload" ? "" : prev.bunny_video_guid,
                      storage_path: v === "storage" ? "" : prev.storage_path,
                    }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">{t("videoMgmt.providerCustom")}</SelectItem>
                    <SelectItem value="upload">{t("videoMgmt.providerUpload")}</SelectItem>
                    <SelectItem value="storage">CDN 직접 업로드</SelectItem>
                    <SelectItem value="youtube">{t("videoMgmt.providerYoutube")}</SelectItem>
                    <SelectItem value="vimeo">{t("videoMgmt.providerVimeo")}</SelectItem>
                    <SelectItem value="cloudflare">{t("videoMgmt.providerCloudflare")}</SelectItem>
                    <SelectItem value="kollus">{t("videoMgmt.providerKollus")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("videoMgmt.fieldDuration")} (분 / 초)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={(() => {
                      const v = parseFloat(form.duration_minutes || "0");
                      return Number.isFinite(v) ? Math.floor(v) : 0;
                    })()}
                    onChange={(e) => {
                      const m = Math.max(0, parseInt(e.target.value || "0", 10) || 0);
                      const cur = parseFloat(form.duration_minutes || "0") || 0;
                      const s = Math.round((cur - Math.floor(cur)) * 60);
                      setForm({ ...form, duration_minutes: String(Math.round((m + s / 60) * 100) / 100) });
                    }}
                    placeholder="분"
                    className="w-20"
                  />
                  <span className="text-xs text-muted-foreground">분</span>
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    value={(() => {
                      const v = parseFloat(form.duration_minutes || "0");
                      if (!Number.isFinite(v)) return 0;
                      return Math.round((v - Math.floor(v)) * 60);
                    })()}
                    onChange={(e) => {
                      const s = Math.min(59, Math.max(0, parseInt(e.target.value || "0", 10) || 0));
                      const cur = parseFloat(form.duration_minutes || "0") || 0;
                      const m = Math.floor(cur);
                      setForm({ ...form, duration_minutes: String(Math.round((m + s / 60) * 100) / 100) });
                    }}
                    placeholder="초"
                    className="w-20"
                  />
                  <span className="text-xs text-muted-foreground">초</span>
                </div>
                {isUploadMode && (
                  <p className="text-[11px] text-muted-foreground mt-1">CDN 업로드 시 자동 입력됩니다.</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{t("common.cancel")}</Button></DialogClose>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={
                !form.title ||
                !form.video_url ||
                saveMutation.isPending
              }
            >
              {saveMutation.isPending ? t("videoMgmt.saving") : editingId ? t("videoMgmt.update") : t("videoMgmt.register")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("videoMgmt.deleteVideo")}</AlertDialogTitle>
            <AlertDialogDescription>{t("videoMgmt.deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {cdnUnlockDialog}
      <BunnyMultiUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </DashboardLayout>
  );
};

export default AdminVideos;
