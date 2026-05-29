import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Layers, Plus, Trash2, Pencil, Lock } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useBranchAdmin } from "@/hooks/useBranchAdmin";

interface Track {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  is_active: boolean;
  target_scope: string;
  target_branch_ids: string[] | null;
  created_at: string;
}

interface Course {
  id: string;
  title: string;
}

const BranchAdminTracks = () => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { branches, branchIds, hasCapability, isLoading: loadingBA } = useBranchAdmin();

  const canManage = branchIds.some((bid) => hasCapability("track_manage", bid));

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [form, setForm] = useState({
    name: "",
    name_en: "",
    description: "",
    description_en: "",
    branch_ids: [] as string[],
    course_ids: [] as string[],
  });
  const [deleteTarget, setDeleteTarget] = useState<Track | null>(null);

  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ["branch-admin-tracks", branchIds],
    enabled: branchIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_tracks")
        .select("id, name, name_en, description, description_en, is_active, target_scope, target_branch_ids, created_at")
        .eq("target_scope", "targeted")
        .overlaps("target_branch_ids", branchIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Track[];
    },
  });

  // All courses (HQ-uploaded) — branch admin can pick from these
  const { data: courses = [] } = useQuery({
    queryKey: ["branch-admin-courses-pool"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title")
        .order("title");
      if (error) throw error;
      return data as Course[];
    },
  });

  // Track -> course associations (track_steps)
  const trackIds = useMemo(() => tracks.map((t) => t.id), [tracks]);
  const { data: stepsByTrack = {} } = useQuery({
    queryKey: ["branch-admin-track-steps", trackIds],
    enabled: trackIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("track_steps")
        .select("id, track_id, name, name_en, level_order")
        .in("track_id", trackIds)
        .order("level_order");
      if (error) throw error;
      const map: Record<string, typeof data> = {};
      for (const s of data ?? []) {
        (map[s.track_id] ??= [] as any).push(s);
      }
      return map;
    },
  });

  const openCreate = () => {
    setEditingTrack(null);
    setForm({
      name: "",
      name_en: "",
      description: "",
      description_en: "",
      branch_ids: branchIds.length === 1 ? [branchIds[0]] : [],
      course_ids: [],
    });
    setDialogOpen(true);
  };

  const openEdit = (track: Track) => {
    setEditingTrack(track);
    const myBranches = (track.target_branch_ids ?? []).filter((b) => branchIds.includes(b));
    setForm({
      name: track.name || "",
      name_en: track.name_en || "",
      description: track.description || "",
      description_en: track.description_en || "",
      branch_ids: myBranches,
      course_ids: [], // course list edited via separate UX in MVP
    });
    setDialogOpen(true);
  };

  const saveTrack = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error(t("branchAdminTracks.nameRequired", "트랙 이름을 입력해주세요"));
      if (form.branch_ids.length === 0) throw new Error(t("branchAdminTracks.branchRequired", "지점을 1개 이상 선택해주세요"));
      if (editingTrack) {
        const { error } = await supabase
          .from("learning_tracks")
          .update({
            name: form.name,
            name_en: form.name_en || null,
            description: form.description || null,
            description_en: form.description_en || null,
            target_scope: "targeted",
            target_branch_ids: form.branch_ids,
          })
          .eq("id", editingTrack.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("learning_tracks")
          .insert({
            name: form.name,
            name_en: form.name_en || null,
            description: form.description || null,
            description_en: form.description_en || null,
            is_active: true,
            target_scope: "targeted",
            target_branch_ids: form.branch_ids,
            created_by: user?.id,
          })
          .select("id")
          .single();
        if (error) throw error;

        // Add selected courses as track_steps
        if (form.course_ids.length > 0 && data) {
          const stepRows = form.course_ids.map((cid, idx) => ({
            track_id: data.id,
            name: courses.find((c) => c.id === cid)?.title || `Step ${idx + 1}`,
            level_order: idx + 1,
            unlock_previous_required: false,
          }));
          await supabase.from("track_steps").insert(stepRows);
        }
      }
    },
    onSuccess: () => {
      toast({ title: editingTrack ? t("branchAdminTracks.updated", "트랙 수정 완료") : t("branchAdminTracks.created", "트랙 생성 완료") });
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["branch-admin-tracks"] });
      queryClient.invalidateQueries({ queryKey: ["branch-admin-track-steps"] });
    },
    onError: (e: Error) => toast({ title: t("common.error", "오류"), description: e.message, variant: "destructive" }),
  });

  const deleteTrack = useMutation({
    mutationFn: async (track: Track) => {
      const { error } = await supabase.from("learning_tracks").delete().eq("id", track.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("branchAdminTracks.deleted", "트랙 삭제 완료") });
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["branch-admin-tracks"] });
    },
    onError: (e: Error) => toast({ title: t("common.error", "오류"), description: e.message, variant: "destructive" }),
  });

  if (loadingBA) {
    return (
      <DashboardLayout role="branch_admin">
        <div className="p-6 text-muted-foreground">{t("common.loading", "불러오는 중...")}</div>
      </DashboardLayout>
    );
  }

  if (!canManage) {
    return (
      <DashboardLayout role="branch_admin">
        <div className="p-6 text-center text-muted-foreground">
          <Lock className="h-12 w-12 mx-auto mb-3 opacity-50" />
          {t("branchAdmin.noTrackPerm", "트랙 관리 권한이 없습니다. 본사 관리자에게 문의해주세요.")}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="branch_admin">
      <div className="min-w-0 space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-semibold">
              <Layers className="h-6 w-6 text-primary" />
              {t("nav.branchAdminTracks", "지점 트랙 관리")}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t("branchAdminTracks.subtitle", "본사가 등록한 강의를 묶어서 자기 지점용 학습 트랙을 만드세요.")}
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2 whitespace-nowrap">
            <Plus className="h-4 w-4" />
            {t("branchAdminTracks.create", "트랙 생성")}
          </Button>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground">{t("common.loading", "불러오는 중...")}</div>
        ) : tracks.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 border-2 border-dashed border-border/60 rounded-lg">
            {t("branchAdminTracks.empty", "트랙이 없습니다. 새 트랙을 만들어보세요.")}
          </div>
        ) : (
          <div className="space-y-3">
            {tracks.map((tr) => {
              const steps = stepsByTrack[tr.id] ?? [];
              return (
                <div key={tr.id} className="border-2 border-border/80 rounded-lg p-4 bg-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{isEn ? tr.name_en || tr.name : tr.name}</span>
                        {!tr.is_active && <Badge variant="outline" className="text-[10px]">{t("common.inactive", "비활성")}</Badge>}
                      </div>
                      {tr.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {isEn ? tr.description_en || tr.description : tr.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span>{steps.length} {t("branchAdminTracks.stepsCount", "단계")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(tr)} className="gap-1">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(tr)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create / Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTrack ? t("branchAdminTracks.editTitle", "트랙 수정") : t("branchAdminTracks.createTitle", "트랙 생성")}
              </DialogTitle>
              <DialogDescription>
                {t("branchAdminTracks.createDesc", "지점 회원에게 보여줄 학습 트랙을 구성하세요.")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t("branchAdminTracks.nameKo", "이름 (한국어)")}</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t("branchAdminTracks.nameEn", "이름 (English)")}</label>
                  <Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t("branchAdminTracks.descKo", "설명 (한국어)")}</label>
                  <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t("branchAdminTracks.descEn", "설명 (English)")}</label>
                  <Textarea rows={3} value={form.description_en} onChange={(e) => setForm({ ...form, description_en: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("branchAdminTracks.targetBranches", "적용 지점")}</label>
                <div className="border-2 border-border/60 rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                  {branches.map((b) => (
                    <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={form.branch_ids.includes(b.id)}
                        onCheckedChange={(chk) => {
                          setForm((f) => ({
                            ...f,
                            branch_ids: chk
                              ? [...f.branch_ids, b.id]
                              : f.branch_ids.filter((x) => x !== b.id),
                          }));
                        }}
                      />
                      {isEn ? b.name_en || b.name : b.name}
                    </label>
                  ))}
                </div>
              </div>

              {!editingTrack && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    {t("branchAdminTracks.includeCourses", "포함할 강의 (순서대로)")}
                  </label>
                  <div className="border-2 border-border/60 rounded-md p-3 space-y-2 max-h-60 overflow-y-auto">
                    {courses.length === 0 ? (
                      <div className="text-xs text-muted-foreground">{t("branchAdminTracks.noCourses", "등록된 강의가 없습니다")}</div>
                    ) : (
                      courses.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={form.course_ids.includes(c.id)}
                            onCheckedChange={(chk) => {
                              setForm((f) => ({
                                ...f,
                                course_ids: chk
                                  ? [...f.course_ids, c.id]
                                  : f.course_ids.filter((x) => x !== c.id),
                              }));
                            }}
                          />
                          <span className="min-w-0 truncate">{c.title}</span>
                        </label>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("branchAdminTracks.coursesHint", "선택 시 트랙 단계로 자동 추가됩니다.")}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t("common.cancel", "취소")}
              </Button>
              <Button onClick={() => saveTrack.mutate()} disabled={saveTrack.isPending}>
                {saveTrack.isPending ? t("common.processing", "처리 중...") : t("common.save", "저장")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("branchAdminTracks.confirmDelete", "트랙 삭제")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("branchAdminTracks.confirmDeleteDesc", "트랙을 삭제하면 단계와 배정 내역도 함께 삭제됩니다.")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel", "취소")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteTarget && deleteTrack.mutate(deleteTarget)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t("common.delete", "삭제")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default BranchAdminTracks;