import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Megaphone, Plus, Pin, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import TargetScopeSelector, { EMPTY_TARGET, TargetValue, formatTargetLabel } from "@/components/TargetScopeSelector";
import MultilingualPostEditor, { EMPTY_MULTILINGUAL, MultilingualValue } from "@/components/MultilingualPostEditor";
import { autoTranslateInBackground } from "@/lib/translate";

const AdminAnnouncements = () => {
  const { t } = useTranslation();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<{ is_pinned: boolean; is_published: boolean } & TargetValue & MultilingualValue>({
    is_pinned: false, is_published: true, ...EMPTY_TARGET, ...EMPTY_MULTILINGUAL,
  });

  const { data: announcements } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async () => {
      const { data } = await supabase
        .from("announcements")
        .select("*")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: authorProfiles } = useQuery({
    queryKey: ["announcement-authors", announcements?.map((a) => a.author_id)],
    enabled: !!announcements?.length,
    queryFn: async () => {
      const ids = [...new Set(announcements!.map((a) => a.author_id))];
      const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      return Object.fromEntries((data || []).map((p) => [p.user_id, p.full_name]));
    },
  });

  const { data: branchMap } = useQuery({
    queryKey: ["announcement-branches"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("id, name");
      return Object.fromEntries((data || []).map((d) => [d.id, d.name]));
    },
  });

  const { data: courseMap } = useQuery({
    queryKey: ["announcement-courses-map"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, title");
      return Object.fromEntries((data || []).map((c) => [c.id, c.title]));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title_ko,
        content: form.content_ko,
        is_pinned: form.is_pinned,
        is_published: form.is_published,
        target_country_codes: form.target_country_codes,
        target_branch_ids: form.target_branch_ids,
        target_course_ids: form.target_course_ids,
      };
      let savedId: string | null = editId;
      if (editId) {
        const { error } = await supabase
          .from("announcements")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("announcements")
          .insert({ ...payload, author_id: user!.id })
          .select("id")
          .single();
        if (error) throw error;
        savedId = data?.id ?? null;
      }

      // Persist KO + EN i18n rows (EN may be blank → fall back to KO so list never shows empty)
      if (savedId) {
        await supabase.from("announcement_i18n").upsert(
          [
            { announcement_id: savedId, language_code: "ko", title: form.title_ko, content: form.content_ko },
            {
              announcement_id: savedId,
              language_code: "en",
              title: form.title_en || form.title_ko,
              content: form.content_en || form.content_ko,
            },
          ],
          { onConflict: "announcement_id,language_code" },
        );
        // If admin did not enter English manually, kick off background AI translation
        if (!form.title_en?.trim()) {
          autoTranslateInBackground("announcement", [savedId]);
        }
      }
    },
    onSuccess: () => {
      toast({ title: editId ? "수정 완료" : "공지사항 등록 완료" });
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: Error) => toast({ title: "오류", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "삭제 완료" });
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      setDeleteId(null);
    },
  });

  const resetForm = () => {
    setForm({ is_pinned: false, is_published: true, ...EMPTY_TARGET, ...EMPTY_MULTILINGUAL });
    setEditId(null);
  };

  const openEdit = async (ann: any) => {
    setEditId(ann.id);
    // Load existing i18n rows so the user can edit each language independently.
    const { data: i18nRows } = await supabase
      .from("announcement_i18n")
      .select("language_code, title, content")
      .eq("announcement_id", ann.id);
    const ko = i18nRows?.find((r) => r.language_code === "ko");
    const en = i18nRows?.find((r) => r.language_code === "en");
    setForm({
      title_ko: ko?.title ?? ann.title,
      content_ko: ko?.content ?? ann.content,
      title_en: en?.title ?? "",
      content_en: en?.content ?? "",
      is_pinned: ann.is_pinned,
      is_published: ann.is_published,
      target_country_codes: ann.target_country_codes ?? [],
      target_branch_ids: ann.target_branch_ids ?? [],
      target_course_ids: ann.target_course_ids ?? [],
    });
    setDialogOpen(true);
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2">
              <Megaphone className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
              {t("announcements.management", "공지사항 관리")}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t("announcements.managementDesc", "공지사항을 등록하고 관리합니다.")}</p>
          </div>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />{t("announcements.create", "공지 등록")}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5" />{t("announcements.list", "공지사항 목록")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>{t("announcements.titleLabel", "제목")}</TableHead>
                  <TableHead>{t("announcements.author", "작성자")}</TableHead>
                  <TableHead>{t("announcements.target", "대상")}</TableHead>
                  <TableHead>{t("announcements.status", "상태")}</TableHead>
                  <TableHead>{t("announcements.date", "등록일")}</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {announcements?.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{t("common.noData")}</TableCell></TableRow>
                )}
                {announcements?.map((ann) => (
                  <TableRow key={ann.id}>
                    <TableCell>{ann.is_pinned && <Pin className="h-4 w-4 text-primary" />}</TableCell>
                    <TableCell className="font-medium">{ann.title}</TableCell>
                    <TableCell>{authorProfiles?.[ann.author_id] || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatTargetLabel({
                        countries: (ann as any).target_country_codes,
                        branchNames: ((ann as any).target_branch_ids || [])
                          .map((id: string) => branchMap?.[id])
                          .filter(Boolean),
                        courseTitles: ((ann as any).target_course_ids || [])
                          .map((id: string) => courseMap?.[id])
                          .filter(Boolean),
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ann.is_published ? "default" : "secondary"}>
                        {ann.is_published ? t("announcements.published", "게시중") : t("announcements.draft", "비공개")}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(ann.created_at), "yyyy-MM-dd")}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(ann)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteId(ann.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? t("announcements.edit", "공지 수정") : t("announcements.create", "공지 등록")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <MultilingualPostEditor
              value={{
                title_ko: form.title_ko,
                content_ko: form.content_ko,
                title_en: form.title_en,
                content_en: form.content_en,
              }}
              onChange={(v) => setForm((f) => ({ ...f, ...v }))}
            />
            <TargetScopeSelector
              value={{
                target_country_codes: form.target_country_codes,
                target_branch_ids: form.target_branch_ids,
                target_course_ids: form.target_course_ids,
              }}
              onChange={(t) => setForm((f) => ({ ...f, ...t }))}
            />
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_pinned} onCheckedChange={(v) => setForm((f) => ({ ...f, is_pinned: v }))} />
                <Label>{t("announcements.pinned", "상단 고정")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_published} onCheckedChange={(v) => setForm((f) => ({ ...f, is_published: v }))} />
                <Label>{t("announcements.publish", "게시")}</Label>
              </div>
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.title_ko || !form.content_ko || saveMutation.isPending} className="w-full">
              {saveMutation.isPending ? t("common.processing") : t("common.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("announcements.deleteConfirm", "공지사항을 삭제하시겠습니까?")}</AlertDialogTitle>
            <AlertDialogDescription>{t("announcements.deleteDesc", "삭제된 공지사항은 복구할 수 없습니다.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default AdminAnnouncements;
