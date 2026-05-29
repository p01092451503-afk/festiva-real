import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, CheckCircle2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

type ContentType = "course" | "content" | "assessment" | "announcement" | "board";

interface PreviewData {
  ko_title: string | null;
  ko_body: string | null;
  en_title: string | null;
  en_body: string | null;
  status: string;
  updated_at: string | null;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft: { label: "초안", cls: "bg-muted text-muted-foreground" },
  ai_generated: { label: "AI 번역", cls: "bg-secondary text-secondary-foreground" },
  reviewed: { label: "검수 완료", cls: "bg-primary/10 text-primary border-primary/30" },
  published: { label: "게시됨", cls: "bg-primary text-primary-foreground" },
  sync_required: { label: "동기화 필요", cls: "bg-destructive/10 text-destructive border-destructive/30" },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: ContentType;
  itemId: string | null;
}

export const I18nPreviewDialog = ({ open, onOpenChange, contentType, itemId }: Props) => {
  const qc = useQueryClient();
  const [enTitle, setEnTitle] = useState("");
  const [enBody, setEnBody] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["i18n-preview", contentType, itemId],
    queryFn: async () => {
      if (!itemId) return null;
      const { data, error } = await supabase.rpc("get_i18n_preview", {
        p_content_type: contentType,
        p_item_id: itemId,
      });
      if (error) throw error;
      return data as unknown as PreviewData;
    },
    enabled: open && !!itemId,
    staleTime: 0,
  });

  useEffect(() => {
    if (data) {
      setEnTitle(data.en_title ?? "");
      setEnBody(data.en_body ?? "");
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (markReviewed: boolean) => {
      if (!itemId) throw new Error("no item");
      const { data, error } = await supabase.rpc("save_i18n_translation", {
        p_content_type: contentType,
        p_item_id: itemId,
        p_en_title: enTitle,
        p_en_body: enBody,
        p_mark_reviewed: markReviewed,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, markReviewed) => {
      toast({
        title: markReviewed ? "검수 완료로 저장됨" : "초안으로 저장됨",
        description: "번역이 업데이트되었습니다.",
      });
      qc.invalidateQueries({ queryKey: ["i18n-dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["i18n-missing"] });
      qc.invalidateQueries({ queryKey: ["i18n-preview", contentType, itemId] });
    },
    onError: (e: Error) => toast({ title: "저장 실패", description: e.message, variant: "destructive" }),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!itemId) throw new Error("no item");
      const { error } = await supabase.rpc("set_i18n_status", {
        p_content_type: contentType,
        p_item_ids: [itemId],
        p_to_status: "published",
        p_note: "published from preview",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "게시 완료", description: "다국어 사용자에게 노출됩니다." });
      qc.invalidateQueries({ queryKey: ["i18n-dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["i18n-missing"] });
      qc.invalidateQueries({ queryKey: ["i18n-preview", contentType, itemId] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "게시 실패", description: e.message, variant: "destructive" }),
  });

  const meta = STATUS_BADGE[data?.status ?? "draft"] ?? STATUS_BADGE.draft;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            번역 검수 (KO ↔ EN)
            <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>
          </DialogTitle>
          <DialogDescription>
            왼쪽 한국어 원본을 참고하여 오른쪽 영어 번역을 직접 수정한 뒤 검수 완료 또는 게시할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="py-12 text-center text-sm text-muted-foreground">불러오는 중...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* KO source (read-only) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground">한국어 원본 (읽기 전용)</Label>
              </div>
              <Input value={data.ko_title ?? ""} readOnly className="bg-muted/40" />
              <Textarea value={data.ko_body ?? ""} readOnly rows={14} className="bg-muted/40 resize-none" />
            </div>
            {/* EN editable */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-foreground">English (편집 가능)</Label>
              <Input
                value={enTitle}
                onChange={(e) => setEnTitle(e.target.value)}
                placeholder="English title"
              />
              <Textarea
                value={enBody}
                onChange={(e) => setEnBody(e.target.value)}
                placeholder="English body"
                rows={14}
                className="resize-none"
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
          <div className="text-xs text-muted-foreground self-center">
            {data?.updated_at ? `최근 수정: ${new Date(data.updated_at).toLocaleString("ko-KR")}` : ""}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => saveMutation.mutate(false)}
              disabled={saveMutation.isPending || !itemId}
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              초안 저장
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => saveMutation.mutate(true)}
              disabled={saveMutation.isPending || !itemId}
            >
              <CheckCircle2 className="h-4 w-4" />
              검수 완료로 저장
            </Button>
            <Button
              size="sm"
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending || !itemId || data?.status !== "reviewed"}
              title={data?.status !== "reviewed" ? "검수 완료 상태에서만 게시할 수 있습니다." : undefined}
            >
              {publishMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              게시
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default I18nPreviewDialog;