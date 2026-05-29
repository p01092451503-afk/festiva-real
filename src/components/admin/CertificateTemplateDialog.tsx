import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, Image as ImageIcon } from "lucide-react";

interface Props {
  courseId: string;
  courseName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CertificateTemplateDialog = ({ courseId, courseName, open, onOpenChange }: Props) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [titleText, setTitleText] = useState("수료증");
  const [descText, setDescText] = useState("위 사람은 본 교육과정을 성실히 이수하였기에 이 증서를 수여합니다.");
  const [issuerName, setIssuerName] = useState("클래시스 글로벌교육센터장");
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: template } = useQuery({
    queryKey: ["cert-template", courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("certificate_templates")
        .select("*")
        .eq("course_id", courseId)
        .maybeSingle();
      return data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (template) {
      setTitleText(template.title_text || "수료증");
      setDescText(template.description_text || "");
      setIssuerName(template.issuer_name || "클래시스 글로벌교육센터장");
      setBgUrl(template.background_image_url || null);
    }
  }, [template]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${courseId}/bg.${ext}`;
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
      const payload = {
        course_id: courseId,
        title_text: titleText,
        description_text: descText,
        issuer_name: issuerName,
        background_image_url: bgUrl,
        updated_at: new Date().toISOString(),
      };
      if (template) {
        const { error } = await supabase.from("certificate_templates").update(payload).eq("id", template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("certificate_templates").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cert-template"] });
      toast.success(t("common.save") + " ✓");
      onOpenChange(false);
    },
    onError: () => toast.error(t("common.error")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("admin.certTemplateTitle", "이수증 템플릿")} - {courseName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
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

export default CertificateTemplateDialog;
