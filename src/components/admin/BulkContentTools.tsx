import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Layers, Plus, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, RotateCcw, Pencil } from "lucide-react";

export type NewContentDraft = {
  title: string;
  video_provider?: string;
  video_url?: string;
  duration_minutes?: number | null;
  bunny_video_guid?: string | null;
};

interface VideoAssetRow {
  id: string;
  title: string;
  video_url: string | null;
  video_provider: string | null;
  bunny_video_guid: string | null;
  duration_minutes: number | null;
}

interface ProviderOption {
  value: string;
  label: string;
}

interface BulkAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerOptions: ProviderOption[];
  defaultTitlePrefix?: string;
  onAdd: (drafts: NewContentDraft[]) => void;
}

export const BulkAddDialog = ({
  open,
  onOpenChange,
  providerOptions,
  defaultTitlePrefix = "차시",
  onAdd,
}: BulkAddDialogProps) => {
  const [tab, setTab] = useState<"count" | "paste" | "library">("count");

  // Tab 1: count
  const [count, setCount] = useState(5);
  const [titlePrefix, setTitlePrefix] = useState(defaultTitlePrefix);
  const [defaultProvider, setDefaultProvider] = useState<string>("");
  const [startNumber, setStartNumber] = useState(1);
  const [titles, setTitles] = useState<string[]>([]);
  const [titlesEdited, setTitlesEdited] = useState(false);

  // Auto-generate titles from prefix/count/startNumber unless user manually edited
  useEffect(() => {
    if (titlesEdited) return;
    const n = Math.max(1, Math.min(100, count || 0));
    const prefix = titlePrefix.trim() || defaultTitlePrefix;
    setTitles(Array.from({ length: n }).map((_, i) => `${prefix} ${startNumber + i}`));
  }, [count, titlePrefix, startNumber, titlesEdited, defaultTitlePrefix]);

  const regenerateTitles = () => {
    const n = Math.max(1, Math.min(100, count || 0));
    const prefix = titlePrefix.trim() || defaultTitlePrefix;
    setTitles(Array.from({ length: n }).map((_, i) => `${prefix} ${startNumber + i}`));
    setTitlesEdited(false);
  };

  // Tab 2: paste
  const [pasted, setPasted] = useState("");

  // Tab 3: library
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const { data: assets = [] } = useQuery({
    queryKey: ["video-assets-bulk"],
    queryFn: async () => {
      const { data } = await supabase
        .from("video_assets" as any)
        .select("id, title, video_url, video_provider, bunny_video_guid, duration_minutes")
        .order("created_at", { ascending: false });
      return (data as unknown as VideoAssetRow[]) || [];
    },
    enabled: open && tab === "library",
  });

  const filteredAssets = useMemo(() => {
    if (!search.trim()) return assets;
    const q = search.toLowerCase();
    return assets.filter((a) => a.title?.toLowerCase().includes(q));
  }, [assets, search]);

  const reset = () => {
    setCount(5);
    setTitlePrefix(defaultTitlePrefix);
    setDefaultProvider("");
    setStartNumber(1);
    setTitles([]);
    setTitlesEdited(false);
    setPasted("");
    setSelectedAssetIds(new Set());
    setSearch("");
    setTab("count");
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const submit = () => {
    let drafts: NewContentDraft[] = [];

    if (tab === "count") {
      const prefix = titlePrefix.trim() || defaultTitlePrefix;
      drafts = titles
        .map((raw, i) => {
          const title = raw.trim() || `${prefix} ${startNumber + i}`;
          return { title, video_provider: defaultProvider || undefined };
        });
    } else if (tab === "paste") {
      drafts = pasted
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((title) => ({ title }));
    } else {
      const picked = assets.filter((a) => selectedAssetIds.has(a.id));
      drafts = picked.map((a) => {
        const isBunny = a.video_provider === "upload" || !!a.bunny_video_guid;
        return {
          title: a.title,
          video_provider: a.video_provider || (isBunny ? "upload" : "custom"),
          video_url: isBunny && a.bunny_video_guid
            ? `bunny://${a.bunny_video_guid}`
            : a.video_url || "",
          duration_minutes: a.duration_minutes ?? null,
          bunny_video_guid: a.bunny_video_guid,
        };
      });
    }

    if (drafts.length === 0) return;
    onAdd(drafts);
    handleClose(false);
  };

  const submitDisabled =
    (tab === "count" && (!count || count < 1)) ||
    (tab === "paste" && pasted.trim().length === 0) ||
    (tab === "library" && selectedAssetIds.size === 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-primary" />
            차시 일괄 추가
          </DialogTitle>
          <DialogDescription className="text-xs">
            여러 차시를 한 번에 빠르게 생성할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mt-2">
          <TabsList className="grid w-full grid-cols-3 h-9">
            <TabsTrigger value="count" className="text-xs">
              개수로 추가
            </TabsTrigger>
            <TabsTrigger value="paste" className="text-xs">
              제목 붙여넣기
            </TabsTrigger>
            <TabsTrigger value="library" className="text-xs">
              CDN 라이브러리
            </TabsTrigger>
          </TabsList>

          {/* Count */}
          <TabsContent value="count" className="space-y-3 mt-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-muted-foreground uppercase">
                  추가할 개수
                </label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value || "0", 10) || 0)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-muted-foreground uppercase">
                  제목 접두어
                </label>
                <Input
                  value={titlePrefix}
                  onChange={(e) => setTitlePrefix(e.target.value)}
                  placeholder="예: 차시"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-muted-foreground uppercase">
                  시작 번호
                </label>
                <Input
                  type="number"
                  min={1}
                  value={startNumber}
                  onChange={(e) => setStartNumber(parseInt(e.target.value || "1", 10) || 1)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">
                기본 영상 제공자 (선택)
              </label>
              <Select value={defaultProvider} onValueChange={setDefaultProvider}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="설정하지 않음" />
                </SelectTrigger>
                <SelectContent>
                  {providerOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Editable preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-medium text-muted-foreground uppercase flex items-center gap-1">
                  <Pencil className="h-3 w-3" /> 미리보기 · 개별 제목 수정 가능
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                  onClick={regenerateTitles}
                  disabled={titles.length === 0}
                >
                  <RotateCcw className="h-3 w-3" /> 자동 생성으로 되돌리기
                </Button>
              </div>
              <div className="rounded-lg border border-border max-h-56 overflow-y-auto divide-y bg-muted/20">
                {titles.length === 0 ? (
                  <div className="text-center py-6 text-[11px] text-muted-foreground">
                    개수를 입력하면 제목이 자동 생성됩니다.
                  </div>
                ) : (
                  titles.map((title, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                      <span className="text-[10px] text-muted-foreground w-6 text-right tabular-nums">
                        {i + 1}.
                      </span>
                      <Input
                        value={title}
                        onChange={(e) => {
                          const next = [...titles];
                          next[i] = e.target.value;
                          setTitles(next);
                          setTitlesEdited(true);
                        }}
                        className="h-7 text-xs"
                      />
                    </div>
                  ))
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                "{(titlePrefix.trim() || defaultTitlePrefix)} {startNumber}", "
                {(titlePrefix.trim() || defaultTitlePrefix)} {startNumber + 1}" … 형태로
                자동 생성되며, 위 목록에서 개별 제목을 직접 수정할 수 있습니다.
              </p>
            </div>
          </TabsContent>

          {/* Paste */}
          <TabsContent value="paste" className="space-y-2 mt-3">
            <label className="text-[10px] font-medium text-muted-foreground uppercase">
              제목 목록 (한 줄에 한 개)
            </label>
            <Textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder={"1강 - 마케팅 기초\n2강 - 브랜딩\n3강 - 채널 전략"}
              className="min-h-[160px] text-xs resize-y font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              {pasted.split(/\r?\n/).filter((l) => l.trim()).length}개의 차시가 생성됩니다.
            </p>
          </TabsContent>

          {/* Library */}
          <TabsContent value="library" className="space-y-2 mt-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="동영상 제목 검색"
              className="h-9 text-xs"
            />
            <div className="rounded-lg border border-border max-h-72 overflow-y-auto divide-y">
              {filteredAssets.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  {assets.length === 0
                    ? "동영상 관리에 등록된 영상이 없습니다."
                    : "검색 결과가 없습니다."}
                </div>
              ) : (
                filteredAssets.map((a) => {
                  const checked = selectedAssetIds.has(a.id);
                  return (
                    <label
                      key={a.id}
                      className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          setSelectedAssetIds((prev) => {
                            const next = new Set(prev);
                            if (v) next.add(a.id);
                            else next.delete(a.id);
                            return next;
                          });
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{a.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {a.video_provider || "—"}
                          {a.duration_minutes != null ? ` · ${a.duration_minutes}분` : ""}
                        </p>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              선택됨: {selectedAssetIds.size}개
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={() => handleClose(false)}>
            취소
          </Button>
          <Button type="button" onClick={submit} disabled={submitDisabled} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> 추가
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface BulkEditBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: (all: boolean) => void;
  onClear: () => void;
  providerOptions: ProviderOption[];
  onApplyPublished: (value: boolean) => void;
  onApplyPreview: (value: boolean) => void;
  onApplyProvider: (value: string) => void;
  onApplyDuration: (minutes: number) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

export const BulkEditBar = ({
  selectedCount,
  totalCount,
  onSelectAll,
  onClear,
  providerOptions,
  onApplyPublished,
  onApplyPreview,
  onApplyProvider,
  onApplyDuration,
  onMoveUp,
  onMoveDown,
  onDelete,
}: BulkEditBarProps) => {
  const [bulkProvider, setBulkProvider] = useState<string>("");
  const [bulkDuration, setBulkDuration] = useState<string>("");

  const allSelected = selectedCount > 0 && selectedCount === totalCount;

  return (
    <div className="rounded-xl border border-border bg-background p-3 flex flex-wrap items-center gap-2 sticky top-2 z-10 shadow-sm">
      <div className="flex items-center gap-2 mr-1">
        <Checkbox
          checked={allSelected}
          onCheckedChange={(v) => onSelectAll(!!v)}
          aria-label="전체 선택"
        />
        <span className="text-xs font-medium">
          {selectedCount > 0 ? (
            <>
              <span className="text-primary">{selectedCount}</span> / {totalCount}개 선택됨
            </>
          ) : (
            <>전체 선택 ({totalCount})</>
          )}
        </span>
      </div>

      {selectedCount > 0 && (
        <>
          <div className="h-5 w-px bg-border mx-1" />

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => onApplyPublished(true)}
          >
            <Eye className="h-3 w-3" /> 공개
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => onApplyPublished(false)}
          >
            <EyeOff className="h-3 w-3" /> 숨김
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => onApplyPreview(true)}
          >
            미리보기 허용
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => onApplyPreview(false)}
          >
            미리보기 차단
          </Button>

          <div className="h-5 w-px bg-border mx-1" />

          <Select
            value={bulkProvider}
            onValueChange={(v) => {
              setBulkProvider(v);
              onApplyProvider(v);
              setBulkProvider("");
            }}
          >
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue placeholder="제공자 일괄 변경" />
            </SelectTrigger>
            <SelectContent>
              {providerOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              value={bulkDuration}
              onChange={(e) => setBulkDuration(e.target.value)}
              placeholder="분"
              className="h-8 w-16 text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={!bulkDuration}
              onClick={() => {
                const n = parseInt(bulkDuration, 10);
                if (!isNaN(n)) {
                  onApplyDuration(n);
                  setBulkDuration("");
                }
              }}
            >
              소요시간 적용
            </Button>
          </div>

          <div className="h-5 w-px bg-border mx-1" />

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={onMoveUp}
          >
            <ArrowUp className="h-3 w-3" /> 위로
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={onMoveDown}
          >
            <ArrowDown className="h-3 w-3" /> 아래로
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" /> 삭제
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs ml-auto"
            onClick={onClear}
          >
            선택 해제
          </Button>
        </>
      )}
    </div>
  );
};

export default BulkAddDialog;