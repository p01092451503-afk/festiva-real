import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Download, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface ContentSummary {
  id: string;
  content_id: string;
  summary: string;
  key_points: string[];
  keywords: string[];
  source: string;
  language: string;
  model: string | null;
  updated_at: string;
  transcript?: string | null;
  transcript_lang?: string | null;
  transcript_chars?: number | null;
}

interface Props {
  contentId: string;
}

const SOURCE_LABEL: Record<string, string> = {
  youtube_captions: "YouTube 자막",
  vimeo_captions: "Vimeo 자막",
  bunny_captions: "Bunny 자막",
  captions: "자막 기반",
  metadata: "메타데이터 기반",
};

export const LessonSummaryPanel = ({ contentId }: Props) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const previewRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const { data: meta } = useQuery({
    queryKey: ["content-meta-for-summary", contentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_contents")
        .select("title, courses(title)")
        .eq("id", contentId)
        .maybeSingle();
      if (error) throw error;
      return data as { title: string; courses: { title: string } | null } | null;
    },
    enabled: !!contentId,
    staleTime: 10 * 60 * 1000,
  });
  const contentTitle = meta?.title || "강의 차시";
  const courseTitle = meta?.courses?.title || null;

  const { data: summary, isLoading } = useQuery({
    queryKey: ["content-summary", contentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_summaries")
        .select("*")
        .eq("content_id", contentId)
        .maybeSingle();
      if (error) throw error;
      return data as ContentSummary | null;
    },
    enabled: !!contentId,
    staleTime: 5 * 60 * 1000,
  });

  const generateMutation = useMutation({
    mutationFn: async (force: boolean) => {
      const { data, error } = await supabase.functions.invoke("summarize-content", {
        body: { content_id: contentId, force },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return (data as any).summary as ContentSummary;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-summary", contentId] });
      toast({ title: "요약 생성 완료" });
    },
    onError: (e: any) => {
      toast({
        title: "요약 생성 실패",
        description: e?.message || "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    },
  });

  const handleDownloadPdf = async () => {
    if (!summary || !previewRef.current) return;
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const node = previewRef.current;
      const canvas = await html2canvas(node, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;
      pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;
      while (heightLeft > 0) {
        position = margin - (imgHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - margin * 2;
      }
      const cleanTitle = contentTitle.replace(/[\\/:*?"<>|]/g, "_").slice(0, 60);
      pdf.save(`${cleanTitle}_요약.pdf`);
    } catch (e: any) {
      console.error(e);
      toast({ title: "PDF 다운로드 실패", description: e?.message, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        불러오는 중...
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">AI 강의 요약을 생성해보세요</p>
          <p className="text-xs text-muted-foreground">
            YouTube · Vimeo · Bunny 자막을 자동 추출해 분석합니다. 자막이 없으면 차시 정보 기반으로 요약합니다.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => generateMutation.mutate(false)}
          disabled={generateMutation.isPending}
          className="gap-1.5"
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          요약 생성하기
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Badge variant="outline" className="text-[10px] h-5">
            {SOURCE_LABEL[summary.source] || summary.source}
          </Badge>
          {typeof summary.transcript_chars === "number" && summary.transcript_chars > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5">
              전사문 {summary.transcript_chars.toLocaleString()}자
            </Badge>
          )}
          <span>
            {new Date(summary.updated_at).toLocaleString("ko-KR", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => generateMutation.mutate(true)}
            disabled={generateMutation.isPending}
            className="gap-1 h-7 text-xs"
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            재생성
          </Button>
          <Button
            size="sm"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="gap-1 h-7 text-xs"
          >
            {downloading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            PDF 다운로드
          </Button>
        </div>
      </div>

      {summary.transcript && summary.transcript.trim().length > 30 && (
        <details className="rounded-md border border-border/70 bg-muted/20 text-xs">
          <summary className="cursor-pointer select-none px-3 py-2 font-medium text-muted-foreground hover:text-foreground">
            원본 전사문 보기 ({summary.transcript.length.toLocaleString()}자)
          </summary>
          <div className="max-h-[260px] overflow-y-auto px-3 pb-3 pt-1 leading-relaxed text-foreground/80 whitespace-pre-wrap">
            {summary.transcript}
          </div>
        </details>
      )}

      {/* Visible compact view */}
      <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
        <div>
          <h4 className="text-xs font-semibold text-foreground mb-1.5">요약</h4>
          <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
            {summary.summary}
          </p>
        </div>

        {summary.key_points?.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-foreground mb-1.5">핵심 포인트</h4>
            <ul className="space-y-1 text-sm text-foreground/90">
              {summary.key_points.map((p, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary shrink-0">·</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.keywords?.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-foreground mb-1.5">키워드</h4>
            <div className="flex flex-wrap gap-1.5">
              {summary.keywords.map((k, i) => (
                <Badge key={i} variant="secondary" className="text-[11px]">
                  {k}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Hidden PDF render target — full content, no truncation */}
      <div className="fixed -left-[9999px] top-0" aria-hidden="true">
        <div
          ref={previewRef}
          style={{
            width: "794px",
            padding: "40px",
            background: "#ffffff",
            color: "#1a1a1a",
            fontFamily:
              "'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          <div style={{ borderBottom: "2px solid #1a1a1a", paddingBottom: "16px", marginBottom: "24px" }}>
            <div style={{ fontSize: "11px", color: "#666", marginBottom: "6px" }}>
              AI 강의 요약 노트
            </div>
            <div style={{ fontSize: "20px", fontWeight: 700, lineHeight: 1.3 }}>
              {contentTitle}
            </div>
            {courseTitle && (
              <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                {courseTitle}
              </div>
            )}
            <div style={{ fontSize: "10px", color: "#999", marginTop: "8px" }}>
              생성일: {new Date(summary.updated_at).toLocaleString("ko-KR")} · 출처:{" "}
              {SOURCE_LABEL[summary.source] || summary.source}
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "8px", color: "#1a1a1a" }}>
              요약
            </div>
            <div style={{ fontSize: "12px", lineHeight: 1.7, whiteSpace: "pre-line" }}>
              {summary.summary}
            </div>
          </div>

          {summary.key_points?.length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "8px" }}>
                핵심 포인트
              </div>
              <ul style={{ paddingLeft: "18px", margin: 0 }}>
                {summary.key_points.map((p, i) => (
                  <li key={i} style={{ fontSize: "12px", lineHeight: 1.7, marginBottom: "4px" }}>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.keywords?.length > 0 && (
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "8px" }}>
                키워드
              </div>
              <div style={{ fontSize: "11px", lineHeight: 1.8, color: "#444" }}>
                {summary.keywords.join(" · ")}
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: "32px",
              paddingTop: "12px",
              borderTop: "1px solid #e5e5e5",
              fontSize: "9px",
              color: "#999",
              textAlign: "center",
            }}
          >
            본 자료는 AI가 자동 생성한 학습 보조 자료입니다.
          </div>
        </div>
      </div>
    </div>
  );
};