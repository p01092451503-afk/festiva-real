import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Bell, Send } from "lucide-react";
import { format } from "date-fns";
import TargetScopeSelector, { EMPTY_TARGET, TargetValue, formatTargetLabel } from "@/components/TargetScopeSelector";
import MultilingualPostEditor, { EMPTY_MULTILINGUAL, MultilingualValue } from "@/components/MultilingualPostEditor";
import { resolveTargetStudentIds } from "@/lib/notificationsTargeting";

const TeacherNotifications = () => {
  const { t } = useTranslation();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<TargetValue & MultilingualValue>({
    ...EMPTY_TARGET,
    ...EMPTY_MULTILINGUAL,
  });

  const { data: recentNotifications } = useQuery({
    queryKey: ["teacher-recent-notifications"],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const { data: branchMap } = useQuery({
    queryKey: ["notification-branches"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("id, name");
      return Object.fromEntries((data || []).map((d) => [d.id, d.name]));
    },
  });

  const { data: courseMap } = useQuery({
    queryKey: ["notification-courses-map-teacher"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, title");
      return Object.fromEntries((data || []).map((c) => [c.id, c.title]));
    },
  });

  const resetForm = () => {
    setForm({ ...EMPTY_TARGET, ...EMPTY_MULTILINGUAL });
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("로그인이 필요합니다.");
      const userIds = await resolveTargetStudentIds(
        {
          target_country_codes: form.target_country_codes,
          target_branch_ids: form.target_branch_ids,
          target_course_ids: form.target_course_ids,
        },
        { instructorId: user.id },
      );
      if (userIds.length === 0) throw new Error("발송 대상 수강생이 없습니다.");

      const finalTitle = form.title_ko;
      const finalMessage = form.content_ko;

      const rows = userIds.map((uid) => ({
        user_id: uid,
        title: finalTitle,
        message: finalMessage,
        type: "info",
      }));

      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        const { error } = await supabase.from("notifications").insert(slice);
        if (error) throw error;
      }
      return userIds.length;
    },
    onSuccess: (count) => {
      toast({ title: "알림 발송 완료", description: `${count}명에게 발송되었습니다.` });
      queryClient.invalidateQueries({ queryKey: ["teacher-recent-notifications"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: Error) =>
      toast({ title: "오류", description: err.message, variant: "destructive" }),
  });

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2">
              <Bell className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
              {t("notifications.management", "알림 관리")}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {t("notifications.teacherDesc", "수강생에게 알림을 발송합니다.")}
            </p>
          </div>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Send className="h-4 w-4 mr-2" />
            {t("notifications.send", "알림 발송")}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {t("notifications.recentSent", "최근 발송 내역")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("notifications.title", "제목")}</TableHead>
                  <TableHead>{t("notifications.message", "내용")}</TableHead>
                  <TableHead>{t("notifications.sentAt", "발송일시")}</TableHead>
                  <TableHead>{t("notifications.readStatus", "읽음")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentNotifications?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      {t("common.noData")}
                    </TableCell>
                  </TableRow>
                )}
                {recentNotifications?.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="font-medium">{n.title}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{n.message}</TableCell>
                    <TableCell>{format(new Date(n.created_at!), "yyyy-MM-dd HH:mm")}</TableCell>
                    <TableCell>{n.is_read ? "✓" : "—"}</TableCell>
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
            <DialogTitle>{t("notifications.send", "알림 발송")}</DialogTitle>
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
              contentRows={4}
            />
            <TargetScopeSelector
              value={{
                target_country_codes: form.target_country_codes,
                target_branch_ids: form.target_branch_ids,
                target_course_ids: form.target_course_ids,
              }}
              onChange={(t) => setForm((f) => ({ ...f, ...t }))}
            />
            <p className="text-[11px] text-muted-foreground">
              대상:{" "}
              {formatTargetLabel({
                countries: form.target_country_codes,
                branchNames: form.target_branch_ids
                  .map((id) => branchMap?.[id])
                  .filter(Boolean) as string[],
                courseTitles: form.target_course_ids
                  .map((id) => courseMap?.[id])
                  .filter(Boolean) as string[],
              })}{" "}
              · 내 수강생으로 자동 제한
            </p>
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={!form.title_ko || !form.content_ko || sendMutation.isPending}
              className="w-full"
            >
              {sendMutation.isPending
                ? t("common.processing")
                : t("notifications.send", "알림 발송")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default TeacherNotifications;
