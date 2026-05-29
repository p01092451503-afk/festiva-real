import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Props {
  courseId: string;
  courseName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CompletionCriteriaDialog = ({ courseId, courseName, open, onOpenChange }: Props) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [minProgress, setMinProgress] = useState(80);
  const [minScore, setMinScore] = useState<number | null>(null);
  const [certEnabled, setCertEnabled] = useState(false);

  const { data: criteria } = useQuery({
    queryKey: ["completion-criteria", courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("completion_criteria")
        .select("*")
        .eq("course_id", courseId)
        .maybeSingle();
      return data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (criteria) {
      setMinProgress(Number(criteria.min_progress_pct) || 80);
      setMinScore(criteria.min_assessment_score != null ? Number(criteria.min_assessment_score) : null);
      setCertEnabled(criteria.certificate_enabled || false);
    } else {
      setMinProgress(80);
      setMinScore(null);
      setCertEnabled(false);
    }
  }, [criteria]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        course_id: courseId,
        min_progress_pct: minProgress,
        min_assessment_score: minScore,
        certificate_enabled: certEnabled,
        updated_at: new Date().toISOString(),
      };
      if (criteria) {
        const { error } = await supabase.from("completion_criteria").update(payload).eq("id", criteria.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("completion_criteria").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["completion-criteria"] });
      queryClient.invalidateQueries({ queryKey: ["admin-comp"] });
      toast.success(t("common.save") + " ✓");
      onOpenChange(false);
    },
    onError: () => toast.error(t("common.error")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("admin.completionReq")} - {courseName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label>{t("admin.minProgressPct", "최소 진도율 (%)")}</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={minProgress}
              onChange={(e) => setMinProgress(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("admin.minAssessmentScore", "최소 평가 점수")}</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={minScore ?? ""}
              placeholder={t("admin.noAssessmentReq", "미설정 (평가 없음)")}
              onChange={(e) => setMinScore(e.target.value ? Number(e.target.value) : null)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>{t("admin.certificateAutoIssue", "이수증 자동 발급")}</Label>
            <Switch checked={certEnabled} onCheckedChange={setCertEnabled} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CompletionCriteriaDialog;
