import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

interface ContentRow {
  id: string;
  title: string;
  duration_minutes: number | null;
  is_published: boolean;
  is_preview: boolean;
  video_provider: string;
  video_url: string;
  description: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contents: any[];
  courseId: string;
}

const PROVIDERS = [
  { value: "youtube", label: "유튜브" },
  { value: "bunny", label: "동영상 (CDN)" },
  { value: "kollus", label: "콜러스 (Kollus)" },
];

const urlPlaceholder = (provider: string) => {
  if (provider === "bunny") return "bunny://<GUID>";
  if (provider === "kollus") return "Kollus 미디어 콘텐츠 키";
  return "https://www.youtube.com/watch?v=... 또는 https://youtu.be/...";
};

/**
 * 차시 전체 정보를 한 번에 수정.
 * 기본 필드(제목/시간/공개/미리보기)는 항상 표시.
 * 행을 펼치면 유형(provider), 경로(URL), 설명까지 편집 가능.
 * 변경된 행만 supabase update 수행.
 */
export const BulkContentEditDialog = ({ open, onOpenChange, contents, courseId }: Props) => {
  const qc = useQueryClient();
  const { toast } = useToast();

  const initial = useMemo<ContentRow[]>(
    () =>
      contents.map((c) => ({
        id: c.id,
        title: c.title ?? "",
        duration_minutes: c.duration_minutes ?? null,
        is_published: !!c.is_published,
        is_preview: !!c.is_preview,
        video_provider: c.video_provider ?? "youtube",
        video_url: c.video_url ?? "",
        description: c.description ?? "",
      })),
    [contents],
  );

  const [rows, setRows] = useState<ContentRow[]>(initial);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      setRows(initial);
      setExpanded({});
    }
  }, [open, initial]);

  const updateRow = (id: string, patch: Partial<ContentRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    rows.forEach((r) => (all[r.id] = true));
    setExpanded(all);
  };
  const collapseAll = () => setExpanded({});

  const saveMutation = useMutation({
    mutationFn: async () => {
      const initialMap = new Map(initial.map((r) => [r.id, r]));
      const changed = rows.filter((r) => {
        const o = initialMap.get(r.id);
        if (!o) return false;
        return (
          o.title !== r.title.trim() ||
          (o.duration_minutes ?? null) !== (r.duration_minutes ?? null) ||
          o.is_published !== r.is_published ||
          o.is_preview !== r.is_preview ||
          o.video_provider !== r.video_provider ||
          (o.video_url ?? "") !== (r.video_url ?? "").trim() ||
          (o.description ?? "") !== r.description
        );
      });
      if (changed.length === 0) return 0;

      const invalid = changed.find((r) => !r.title.trim());
      if (invalid) {
        throw new Error("제목은 비워둘 수 없습니다.");
      }

      const results = await Promise.all(
        changed.map((r) =>
          supabase
            .from("course_contents")
            .update({
              title: r.title.trim(),
              duration_minutes: r.duration_minutes ?? null,
              is_published: r.is_published,
              is_preview: r.is_preview,
              video_provider: (r.video_provider || null) as any,
              video_url: r.video_url?.trim() || null,
              description: r.description || null,
            })
            .eq("id", r.id),
        ),
      );
      const firstErr = results.find((res) => res.error)?.error;
      if (firstErr) throw firstErr;
      return changed.length;
    },
    onSuccess: (count) => {
      if (count === 0) {
        toast({ title: "변경 사항이 없습니다." });
      } else {
        toast({ title: `${count}개 차시를 수정했습니다.` });
      }
      qc.invalidateQueries({ queryKey: ["course-contents", courseId] });
      qc.invalidateQueries({ queryKey: ["content-i18n", courseId] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({
        title: "저장 실패",
        description: err?.message ?? "다시 시도해 주세요.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>차시 전체 수정</DialogTitle>
          <DialogDescription>
            제목·시간·공개·미리보기뿐 아니라, 행을 펼치면 유형·경로(URL)·설명도 함께 수정할 수 있습니다.
            변경된 항목만 저장됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={expandAll} disabled={rows.length === 0}>
            모두 펼치기
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={collapseAll} disabled={rows.length === 0}>
            모두 접기
          </Button>
        </div>

        <div className="max-h-[65vh] overflow-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-secondary/60 text-xs text-muted-foreground">
              <tr>
                <th className="w-8 px-1 py-2"></th>
                <th className="w-10 px-2 py-2 text-left font-medium">#</th>
                <th className="px-2 py-2 text-left font-medium">제목</th>
                <th className="w-24 px-2 py-2 text-left font-medium">시간(분)</th>
                <th className="w-20 px-2 py-2 text-center font-medium">공개</th>
                <th className="w-24 px-2 py-2 text-center font-medium">미리보기</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    등록된 차시가 없습니다.
                  </td>
                </tr>
              )}
              {rows.map((r, idx) => {
                const isOpen = !!expanded[r.id];
                return (
                  <>
                    <tr key={r.id} className="hover:bg-accent/30">
                      <td className="px-1 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => toggleExpand(r.id)}
                          className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-accent"
                          aria-label={isOpen ? "접기" : "펼치기"}
                        >
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
                        {String(idx + 1).padStart(2, "0")}
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          value={r.title}
                          onChange={(e) => updateRow(r.id, { title: e.target.value })}
                          className="h-8 text-sm"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          min={0}
                          value={r.duration_minutes ?? ""}
                          onChange={(e) =>
                            updateRow(r.id, {
                              duration_minutes:
                                e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          className="h-8 text-sm"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex justify-center">
                          <Switch
                            checked={r.is_published}
                            onCheckedChange={(v) => updateRow(r.id, { is_published: v })}
                          />
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex justify-center">
                          <Switch
                            checked={r.is_preview}
                            onCheckedChange={(v) => updateRow(r.id, { is_preview: v })}
                          />
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${r.id}-expanded`} className="bg-muted/30">
                        <td></td>
                        <td colSpan={5} className="px-3 py-3">
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div className="space-y-1">
                              <Label className="text-xs">유형</Label>
                              <Select
                                value={r.video_provider || "youtube"}
                                onValueChange={(v) =>
                                  updateRow(r.id, {
                                    video_provider: v,
                                    video_url: v !== r.video_provider ? "" : r.video_url,
                                  })
                                }
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {PROVIDERS.map((p) => (
                                    <SelectItem key={p.value} value={p.value}>
                                      {p.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1 md:col-span-2">
                              <Label className="text-xs">
                                {r.video_provider === "kollus"
                                  ? "Kollus 미디어 콘텐츠 키"
                                  : r.video_provider === "bunny"
                                    ? "CDN 경로 (bunny://GUID)"
                                    : "YouTube 영상 URL"}
                              </Label>
                              <Input
                                value={r.video_url}
                                onChange={(e) => updateRow(r.id, { video_url: e.target.value })}
                                placeholder={urlPlaceholder(r.video_provider)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1 md:col-span-3">
                              <Label className="text-xs">설명</Label>
                              <Textarea
                                value={r.description}
                                onChange={(e) => updateRow(r.id, { description: e.target.value })}
                                rows={2}
                                className="text-sm"
                                placeholder="차시에 대한 짧은 설명"
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saveMutation.isPending}
          >
            취소
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || rows.length === 0}
          >
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            전체 저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
