import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Upload } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseIds: string[];
}

const BulkCompletionSettingsDialog = ({ open, onOpenChange, courseIds }: Props) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Criteria state
  const [minProgress, setMinProgress] = useState(80);
  const [minScore, setMinScore] = useState<number | null>(null);
  const [certEnabled, setCertEnabled] = useState(false);

  // Template state
  const [titleText, setTitleText] = useState("수료증");
  const [descText, setDescText] = useState("위 사람은 본 교육과정을 성실히 이수하였기에 이 증서를 수여합니다.");
  const [issuerName, setIssuerName] = useState("");
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `_bulk/bg.${ext}`;
    const { error } = await supabase.storage.from("certificate-templates").upload(path, file, { upsert: true });
    if (error) {
      toast.error(t("common.error"));
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("certificate-templates").getPublicUrl(path);
    setBgUrl(urlData.publicUrl);
    setUploading(false);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      // Fetch existing criteria and templates
      const [{ data: existingCriteria }, { data: existingTemplates }] = await Promise.all([
        supabase.from("completion_criteria").select("id, course_id").in("course_id", courseIds),
        supabase.from("certificate_templates").select("id, course_id").in("course_id", courseIds),
      ]);

      const existingCriteriaMap = new Map((existingCriteria || []).map((c: any) => [c.course_id, c.id]));
      const existingTemplateMap = new Map((existingTemplates || []).map((t: any) => [t.course_id, t.id]));

      const now = new Date().toISOString();

      // Upsert criteria for all courses
      for (const courseId of courseIds) {
        const criteriaPayload = {
          course_id: courseId,
          min_progress_pct: minProgress,
          min_assessment_score: minScore,
          certificate_enabled: certEnabled,
          updated_at: now,
        };

        if (existingCriteriaMap.has(courseId)) {
          await supabase.from("completion_criteria").update(criteriaPayload).eq("id", existingCriteriaMap.get(courseId));
        } else {
          await supabase.from("completion_criteria").insert(criteriaPayload);
        }

        // Template
        const templatePayload = {
          course_id: courseId,
          title_text: titleText,
          description_text: descText,
          issuer_name: issuerName,
          background_image_url: bgUrl,
          updated_at: now,
        };

        if (existingTemplateMap.has(courseId)) {
          await supabase.from("certificate_templates").update(templatePayload).eq("id", existingTemplateMap.get(courseId));
        } else {
          await supabase.from("certificate_templates").insert(templatePayload);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-comp-criteria"] });
      queryClient.invalidateQueries({ queryKey: ["admin-comp-templates"] });
      queryClient.invalidateQueries({ queryKey: ["completion-criteria"] });
      queryClient.invalidateQueries({ queryKey: ["cert-template"] });
      toast.success(`${courseIds.length}개 강좌에 일괄 적용되었습니다 ✓`);
      onOpenChange(false);
    },
    onError: () => toast.error(t("common.error")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>전체 강좌 일괄 설정</DialogTitle>
          <DialogDescription>
            {courseIds.length}개 강좌에 동일한 수료요건과 이수증 템플릿을 일괄 적용합니다.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="criteria" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="criteria" className="flex-1">수료요건</TabsTrigger>
            <TabsTrigger value="template" className="flex-1">이수증 템플릿</TabsTrigger>
          </TabsList>

          <TabsContent value="criteria" className="space-y-5 pt-2">
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
          </TabsContent>

          <TabsContent value="template" className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>{t("admin.certBgImage", "배경 이미지")}</Label>
              {bgUrl && (
                <div className="relative rounded-lg border overflow-hidden aspect-[1.414] max-h-40">
                  <img src={bgUrl} alt="Certificate background" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild className="gap-2">
                  <label>
                    {uploading ? t("common.processing") : <><Upload className="h-4 w-4" />{t("admin.uploadBg", "배경 업로드")}</>}
                    <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
                  </label>
                </Button>
                {bgUrl && (
                  <Button variant="ghost" size="sm" onClick={() => setBgUrl(null)}>
                    {t("common.delete")}
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("admin.certTitleText", "제목 텍스트")}</Label>
              <Input value={titleText} onChange={(e) => setTitleText(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.certDescText", "본문 텍스트")}</Label>
              <Textarea value={descText} onChange={(e) => setDescText(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.certIssuer", "발급자명")}</Label>
              <Input value={issuerName} onChange={(e) => setIssuerName(e.target.value)} placeholder="교육센터장" />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "적용 중..." : `전체 ${courseIds.length}개 강좌에 적용`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkCompletionSettingsDialog;
