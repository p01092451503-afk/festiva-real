import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudDownload, Loader2, Search, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { formatDurationMs } from "@/lib/duration";

interface BunnyVideo {
  guid: string;
  title: string;
  length_seconds: number;
  storage_size_bytes: number;
  status: number;
  thumbnail_url: string | null;
  date_uploaded: string | null;
}

const minutesFromSeconds = (s: number) => Math.round((s / 60) * 100) / 100;
const mbFromBytes = (b: number) => Math.round((b / (1024 * 1024)) * 10) / 10;

/**
 * Lets admins browse the Bunny Stream library and import selected videos
 * into the local `video_assets` table. Existing entries with the same
 * `bunny_video_guid` are overwritten with fresh Bunny metadata.
 */
const BunnyImportDialog = () => {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["bunny-library-videos", open],
    enabled: open,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "bunny-stream-list",
        { body: {} },
      );
      if (error) throw new Error(error.message || "Bunny 목록을 불러오지 못했습니다");
      return (data?.videos || []) as BunnyVideo[];
    },
  });

  // Look up which GUIDs already exist locally to render the "이미 등록" badge.
  const { data: existingGuids = new Set<string>() } = useQuery({
    queryKey: ["video-assets-bunny-guids", open],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_assets")
        .select("bunny_video_guid")
        .not("bunny_video_guid", "is", null);
      if (error) throw error;
      return new Set((data || []).map((r) => r.bunny_video_guid as string));
    },
  });

  useEffect(() => {
    if (!open) {
      setSelected({});
      setSearch("");
    }
  }, [open]);

  const filtered = useMemo(() => {
    const list = data || [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        v.guid.toLowerCase().includes(q),
    );
  }, [data, search]);

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((v) => selected[v.guid]);

  const toggleAll = (checked: boolean) => {
    setSelected((prev) => {
      const next = { ...prev };
      filtered.forEach((v) => {
        if (checked) next[v.guid] = true;
        else delete next[v.guid];
      });
      return next;
    });
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("로그인이 필요합니다");
      const list = (data || []).filter((v) => selected[v.guid]);
      let inserted = 0;
      let updated = 0;

      for (const v of list) {
        const payload = {
          title: v.title,
          video_url: `bunny://${v.guid}`,
          video_provider: "bunny",
          bunny_video_guid: v.guid,
          duration_minutes: v.length_seconds
            ? minutesFromSeconds(v.length_seconds)
            : null,
          file_size_mb: v.storage_size_bytes
            ? mbFromBytes(v.storage_size_bytes)
            : null,
          thumbnail_url: v.thumbnail_url,
          uploaded_by: user.id,
        };

        // Overwrite if a row with the same guid already exists.
        const { data: existing, error: lookupErr } = await supabase
          .from("video_assets")
          .select("id")
          .eq("bunny_video_guid", v.guid)
          .maybeSingle();
        if (lookupErr) throw lookupErr;

        if (existing?.id) {
          const { error: upErr } = await supabase
            .from("video_assets")
            .update(payload)
            .eq("id", existing.id);
          if (upErr) throw upErr;
          updated += 1;
        } else {
          const { error: insErr } = await supabase
            .from("video_assets")
            .insert(payload);
          if (insErr) throw insErr;
          inserted += 1;
        }
      }

      return { inserted, updated };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["video-assets"] });
      queryClient.invalidateQueries({ queryKey: ["video-assets-bunny-guids"] });
      toast({
        title: "CDN 영상 가져오기 완료",
        description: `신규 ${result.inserted}건 · 업데이트 ${result.updated}건`,
      });
      setOpen(false);
    },
    onError: (err: Error) => {
      toast({
        title: "가져오기 실패",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <CloudDownload className="h-4 w-4" />
          CDN에서 가져오기
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:w-full sm:max-w-3xl p-4 sm:p-6 max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>CDN 영상 가져오기</DialogTitle>
          <DialogDescription className="text-sm">
            CDN 라이브러리에 직접 업로드된 영상을 선택해 동영상 관리 목록에
            등록합니다. 이미 등록된 영상은 CDN의 최신 정보로 덮어씁니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 min-w-0 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="제목 또는 GUID로 검색"
                className="pl-9"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "새로고침"}
            </Button>
          </div>

          {error && (
            <p className="text-sm text-destructive">
              CDN 영상 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
            </p>
          )}

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-muted-foreground">
              <Checkbox
                checked={allFilteredSelected}
                onCheckedChange={(c) => toggleAll(Boolean(c))}
                disabled={filtered.length === 0}
              />
              현재 보이는 {filtered.length}개 모두 선택
            </label>
            <span className="text-muted-foreground">
              선택됨{" "}
              <span className="font-semibold text-foreground">{selectedCount}</span>개
            </span>
          </div>

          <ScrollArea className="h-72 sm:h-80 rounded-md border flex-1 min-h-0">
            {isLoading ? (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> CDN 라이브러리 불러오는 중...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                {search ? "검색 결과가 없습니다" : "CDN 라이브러리에 영상이 없습니다"}
              </div>
            ) : (
              <div className="divide-y">
                {filtered.map((v) => {
                  const checked = !!selected[v.guid];
                  const exists = existingGuids.has(v.guid);
                  return (
                    <label
                      key={v.guid}
                      className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 cursor-pointer hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) =>
                          setSelected((prev) => {
                            const next = { ...prev };
                            if (c) next[v.guid] = true;
                            else delete next[v.guid];
                            return next;
                          })
                        }
                      />
                      {v.thumbnail_url ? (
                        <img
                          src={v.thumbnail_url}
                          alt=""
                          className="h-10 w-14 sm:w-16 rounded object-cover bg-muted shrink-0"
                        />
                      ) : (
                        <div className="h-10 w-14 sm:w-16 rounded bg-muted shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{v.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {v.guid}
                        </p>
                      </div>
                      <div className="hidden sm:block text-xs text-muted-foreground tabular-nums shrink-0 text-right">
                        <div>
                          {formatDurationMs(
                            v.length_seconds ? minutesFromSeconds(v.length_seconds) : null,
                          )}
                        </div>
                        {v.storage_size_bytes > 0 && (
                          <div>
                            {mbFromBytes(v.storage_size_bytes) >= 1024
                              ? `${(mbFromBytes(v.storage_size_bytes) / 1024).toFixed(1)}GB`
                              : `${mbFromBytes(v.storage_size_bytes).toFixed(0)}MB`}
                          </div>
                        )}
                      </div>
                      {exists && (
                        <Badge
                          variant="outline"
                          className="gap-1 text-[10px] shrink-0"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          <span className="hidden sm:inline">등록됨</span>
                        </Badge>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="gap-2 flex-row sm:flex-row">
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={importMutation.isPending}
            className="flex-1 sm:flex-none"
          >
            취소
          </Button>
          <Button
            onClick={() => importMutation.mutate()}
            disabled={selectedCount === 0 || importMutation.isPending}
            className="flex-1 sm:flex-none"
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> 가져오는 중...
              </>
            ) : (
              <>
                <CloudDownload className="h-4 w-4 mr-2" />
                <span className="truncate">선택한 {selectedCount}개 가져오기</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BunnyImportDialog;