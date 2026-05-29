import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Megaphone, Pin, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useUserTargetContext, filterByTarget } from "@/hooks/useTargetFilter";

const StudentAnnouncements = () => {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || "ko").startsWith("en") ? "en" : "ko";
  const [selectedAnn, setSelectedAnn] = useState<any>(null);
  const { data: targetCtx } = useUserTargetContext();

  const { data: rawAnnouncements, isLoading } = useQuery({
    queryKey: ["student-announcements"],
    queryFn: async () => {
      const { data } = await supabase
        .from("announcements")
        .select("*")
        .eq("is_published", true)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const filtered = targetCtx
    ? filterByTarget(rawAnnouncements, targetCtx)
    : rawAnnouncements;

  const { data: i18nMap } = useQuery({
    queryKey: ["announcement-i18n", lang, filtered?.map((a) => a.id)],
    enabled: !!filtered?.length,
    queryFn: async () => {
      const ids = filtered!.map((a) => a.id);
      const { data } = await supabase
        .from("announcement_i18n")
        .select("announcement_id, title, content")
        .eq("language_code", lang)
        .in("announcement_id", ids);
      return Object.fromEntries((data || []).map((r) => [r.announcement_id, r]));
    },
  });

  const announcements = filtered?.map((a) => {
    const tr = i18nMap?.[a.id];
    return tr ? { ...a, title: tr.title, content: tr.content } : a;
  });

  const { data: authorProfiles } = useQuery({
    queryKey: ["announcement-authors-student", announcements?.map((a) => a.author_id)],
    enabled: !!announcements?.length,
    queryFn: async () => {
      const ids = [...new Set(announcements!.map((a) => a.author_id))];
      const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      return Object.fromEntries((data || []).map((p) => [p.user_id, p.full_name]));
    },
  });

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6" />
            {t("announcements.title", "공지사항")}
          </h1>
          <p className="text-muted-foreground">{t("announcements.studentDesc", "중요한 공지 및 안내사항을 확인하세요.")}</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
          </div>
        ) : announcements?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {t("announcements.noAnnouncements", "등록된 공지사항이 없습니다.")}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {announcements?.map((ann) => (
              <Card
                key={ann.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedAnn(ann)}
              >
                <CardContent className="flex items-center gap-4 py-4">
                  {ann.is_pinned && <Pin className="h-4 w-4 text-primary shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {ann.is_pinned && (
                        <Badge variant="outline" className="text-xs shrink-0">{t("announcements.pinned", "고정")}</Badge>
                      )}
                      <h3 className="font-medium truncate">{ann.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">{ann.content}</p>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(ann.created_at), "yyyy-MM-dd")}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedAnn} onOpenChange={() => setSelectedAnn(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedAnn?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{authorProfiles?.[selectedAnn?.author_id] || "—"}</span>
              <span>·</span>
              <span>{selectedAnn && format(new Date(selectedAnn.created_at), "yyyy-MM-dd HH:mm")}</span>
            </div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed border-t pt-4">
              {selectedAnn?.content}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default StudentAnnouncements;
