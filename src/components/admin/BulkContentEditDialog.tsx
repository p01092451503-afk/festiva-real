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
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";

interface ContentRow {
  id: string;
  title: string;
  duration_minutes: number | null;
  is_published: boolean;
  is_preview: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contents: any[];
  courseId: string;
}

/**
 * 차시 전체 정보를 표 형태로 한 번에 수정.
 * 편집 가능 필드: 제목(KR), 재생시간(분), 공개여부, 미리보기 허용.
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
      })),
    [contents],
  );

  const [rows, setRows] = useState<ContentRow[]>(initial);

  // dialog가 다시 열릴 때 / contents 갱신 시 폼 초기화
  useEffect(() => {
    if (open) setRows(initial);
  }, [open, initial]);

  const updateRow = (id: string, patch: Partial<ContentRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

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
          o.is_preview !== r.is_preview
        );
      });
      if (changed.length === 0) return 0;

      // 빈 제목 방지
      const invalid = changed.find((r) => !r.title.trim());
      if (invalid) {
        throw new Error("제목은 비워둘 수 없습니다.");
      }

      // 병렬 업데이트
      const results = await Promise.all(
        changed.map((r) =>
          supabase
            .from("course_contents")
            .update({
              title: r.title.trim(),
              duration_minutes: r.duration_minutes ?? null,
              is_published: r.is_published,
              is_preview: r.is_preview,
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
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>차시 전체 수정</DialogTitle>
          <DialogDescription>
            모든 차시의 제목, 재생시간, 공개 여부, 미리보기 허용을 한 번에 수정할 수 있습니다.
            변경된 항목만 저장됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-secondary/60 text-xs text-muted-foreground">
              <tr>
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
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    등록된 차시가 없습니다.
                  </td>
                </tr>
              )}
              {rows.map((r, idx) => (
                <tr key={r.id} className="hover:bg-accent/30">
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
                          duration_minutes: e.target.value === "" ? null : Number(e.target.value),
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
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saveMutation.isPending}>
            취소
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || rows.length === 0}>
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            전체 저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
