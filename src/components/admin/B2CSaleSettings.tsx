import { useState, useEffect } from "react";
import {
  ShoppingBag, Plus, Trash2, ArrowUp, ArrowDown, Type, Image as ImageIcon,
  CheckSquare, AlertCircle, Loader2, CalendarIcon,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, parse } from "date-fns";
import { ko } from "date-fns/locale";

interface DetailBlock {
  id?: string;
  block_type: string;
  title: string;
  content: string;
  image_url: string;
  checklist_items: string[];
  sort_order: number;
}

interface B2CSaleSettingsProps {
  courseId: string;
  isB2c: boolean;
  setIsB2c: (v: boolean) => void;
  price: number;
  setPrice: (v: number) => void;
  salePrice: number | null;
  setSalePrice: (v: number | null) => void;
  saleEndsAt: string;
  setSaleEndsAt: (v: string) => void;
  thumbnailUrl: string | null;
  contentCount: number;
  status: string;
  onStatusChange: (v: string) => void;
}

const B2CSaleSettings = ({
  courseId, isB2c, setIsB2c, price, setPrice, salePrice, setSalePrice,
  saleEndsAt, setSaleEndsAt, thumbnailUrl, contentCount, status, onStatusChange,
}: B2CSaleSettingsProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFree, setIsFree] = useState(price === 0);
  const [blockDialog, setBlockDialog] = useState<{ open: boolean; type: string }>({ open: false, type: "" });
  const [blockTitle, setBlockTitle] = useState("");
  const [blockContent, setBlockContent] = useState("");
  const [blockChecklist, setBlockChecklist] = useState<string[]>([""]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingBlock, setEditingBlock] = useState<DetailBlock | null>(null);

  const { data: blocks = [], refetch: refetchBlocks } = useQuery({
    queryKey: ["course-detail-blocks", courseId],
    queryFn: async () => {
      if (!courseId) return [];
      const { data, error } = await supabase
        .from("course_detail_blocks")
        .select("*")
        .eq("course_id", courseId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as DetailBlock[];
    },
    enabled: !!courseId,
  });

  useEffect(() => {
    if (isFree) { setPrice(0); setSalePrice(null); }
  }, [isFree]);

  const saveBlock = useMutation({
    mutationFn: async (block: DetailBlock) => {
      if (block.id) {
        const { error } = await supabase.from("course_detail_blocks").update({
          title: block.title || null,
          content: block.content || null,
          image_url: block.image_url || null,
          checklist_items: block.checklist_items?.length ? block.checklist_items : [],
          sort_order: block.sort_order,
        }).eq("id", block.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("course_detail_blocks").insert({
          course_id: courseId,
          block_type: block.block_type,
          title: block.title || null,
          content: block.content || null,
          image_url: block.image_url || null,
          checklist_items: block.checklist_items?.length ? block.checklist_items : [],
          sort_order: blocks.length,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      refetchBlocks();
      setBlockDialog({ open: false, type: "" });
      resetBlockForm();
    },
  });

  const deleteBlock = async (id: string) => {
    await supabase.from("course_detail_blocks").delete().eq("id", id);
    refetchBlocks();
  };

  const swapBlocks = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= blocks.length) return;
    const a = blocks[idx];
    const b = blocks[target];
    await Promise.all([
      supabase.from("course_detail_blocks").update({ sort_order: target }).eq("id", a.id!),
      supabase.from("course_detail_blocks").update({ sort_order: idx }).eq("id", b.id!),
    ]);
    refetchBlocks();
  };

  const resetBlockForm = () => {
    setBlockTitle("");
    setBlockContent("");
    setBlockChecklist([""]);
    setEditingBlock(null);
  };

  const openAddBlock = (type: string) => {
    resetBlockForm();
    setBlockDialog({ open: true, type });
  };

  const openEditBlock = (block: DetailBlock) => {
    setEditingBlock(block);
    setBlockTitle(block.title || "");
    setBlockContent(block.content || "");
    setBlockChecklist(block.checklist_items?.length ? [...block.checklist_items] : [""]);
    setBlockDialog({ open: true, type: block.block_type });
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    setUploadProgress(30);
    const path = `${courseId}/${crypto.randomUUID()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("course-blocks").upload(path, file);
    setUploadProgress(80);
    if (error) {
      toast({ title: "업로드 실패", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("course-blocks").getPublicUrl(path);
    setUploadProgress(100);

    await supabase.from("course_detail_blocks").insert({
      course_id: courseId,
      block_type: "image",
      image_url: urlData.publicUrl,
      sort_order: blocks.length,
    });
    refetchBlocks();
    setUploading(false);
    setUploadProgress(0);
  };

  const handleSaveBlockDialog = () => {
    const type = blockDialog.type;
    const block: DetailBlock = editingBlock
      ? { ...editingBlock, title: blockTitle, content: blockContent, checklist_items: blockChecklist.filter(Boolean) }
      : {
          block_type: type,
          title: blockTitle,
          content: blockContent,
          image_url: "",
          checklist_items: type === "checklist" ? blockChecklist.filter(Boolean) : [],
          sort_order: blocks.length,
        };
    saveBlock.mutate(block);
  };

  // Publish checklist
  const checks = [
    { ok: !!thumbnailUrl, label: "썸네일 이미지 설정" },
    { ok: !isB2c || price > 0 || isFree, label: "가격 설정 완료" },
    { ok: contentCount > 0, label: "차시 1개 이상 등록" },
  ];
  const allPassed = checks.every((c) => c.ok);

  const formatPrice = (v: number) => v.toLocaleString("ko-KR") + "원";

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold text-foreground border-b border-border pb-3 flex items-center gap-2">
        <ShoppingBag className="h-4 w-4" /> 외부 공개 설정
      </h2>

      {/* B2C Toggle */}
      <div className="flex items-center justify-between py-2">
        <div>
          <p className="text-sm font-medium text-foreground">외부 공개 활성화</p>
          <p className="text-xs text-muted-foreground">활성화하면 공개 스토어에 노출되며 외부 사용자도 수강할 수 있습니다</p>
        </div>
        <Switch checked={isB2c} onCheckedChange={setIsB2c} />
      </div>

      {isB2c && (
        <>
          {/* Pricing */}
          <div className="stat-card space-y-4">
            <h3 className="text-sm font-semibold text-foreground">가격 설정</h3>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground">무료 강의</p>
                <p className="text-xs text-muted-foreground">무료로 제공하면 가격이 0원으로 설정됩니다</p>
              </div>
              <Switch checked={isFree} onCheckedChange={setIsFree} />
            </div>

            {!isFree && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>정가 (원)</Label>
                  <Input
                    type="number"
                    value={price || ""}
                    onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
                    placeholder="49000"
                    className="h-10 rounded-xl"
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>할인가 (원)</Label>
                  <Input
                    type="number"
                    value={salePrice ?? ""}
                    onChange={(e) => setSalePrice(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="비워두면 할인 없음"
                    className="h-10 rounded-xl"
                    min="0"
                  />
                </div>
              </div>
            )}

            {!isFree && (
              <div className="space-y-2">
                <Label>할인 종료일</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-10 w-full rounded-xl justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {saleEndsAt ? format(new Date(saleEndsAt), "yyyy년 M월 d일") : "선택 안함 (상시 할인)"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-2xl" align="start">
                    <Calendar
                      mode="single"
                      locale={ko}
                      selected={saleEndsAt ? new Date(saleEndsAt) : undefined}
                      onSelect={(date) => setSaleEndsAt(date ? date.toISOString() : "")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Price Preview */}
            <div className="p-4 rounded-xl border border-border bg-secondary/30">
              <p className="text-xs text-muted-foreground mb-2">가격 미리보기</p>
              {isFree ? (
                <Badge className="bg-primary/10 text-primary">무료</Badge>
              ) : salePrice && salePrice < price ? (
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-foreground">{formatPrice(salePrice)}</span>
                  <span className="text-sm text-muted-foreground line-through">{formatPrice(price)}</span>
                  <Badge variant="destructive" className="text-xs">
                    {Math.round((1 - salePrice / price) * 100)}% OFF
                  </Badge>
                </div>
              ) : (
                <span className="text-lg font-bold text-foreground">{formatPrice(price)}</span>
              )}
            </div>
          </div>

          {/* Detail Blocks Builder */}
          {courseId && (
            <div className="stat-card space-y-4">
              <h3 className="text-sm font-semibold text-foreground">과정 상세 소개 블록</h3>
              <div className="flex gap-2 flex-wrap">
                <Button type="button" variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => openAddBlock("text")}>
                  <Type className="h-3.5 w-3.5" /> 텍스트 블록
                </Button>
                <label className="cursor-pointer">
                  <Button type="button" variant="outline" size="sm" className="rounded-xl gap-1.5 pointer-events-none" tabIndex={-1}>
                    <ImageIcon className="h-3.5 w-3.5" /> 이미지 블록
                  </Button>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
                </label>
                <Button type="button" variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => openAddBlock("checklist")}>
                  <CheckSquare className="h-3.5 w-3.5" /> 체크리스트 블록
                </Button>
              </div>

              {uploading && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">이미지 업로드 중...</p>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              {blocks.length > 0 && (
                <div className="space-y-2">
                  {blocks.map((block, idx) => (
                    <div key={block.id} className="flex items-center gap-2 p-3 rounded-xl border border-border bg-background">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {block.block_type === "text" && <Type className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                          {block.block_type === "image" && <ImageIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                          {block.block_type === "checklist" && <CheckSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                          <span className="text-sm text-foreground truncate">
                            {block.title || (block.block_type === "image" ? "이미지" : block.block_type)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {block.block_type !== "image" && (
                          <button type="button" onClick={() => openEditBlock(block)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground">
                            <Type className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button type="button" onClick={() => swapBlocks(idx, -1)} disabled={idx === 0} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground disabled:opacity-30">
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => swapBlocks(idx, 1)} disabled={idx === blocks.length - 1} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground disabled:opacity-30">
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => deleteBlock(block.id!)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Publish Checklist */}
          <div className="stat-card space-y-3">
            <h3 className="text-sm font-semibold text-foreground">공개 전 체크리스트</h3>
            {checks.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {c.ok ? (
                  <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckSquare className="h-3 w-3 text-primary" />
                  </div>
                ) : (
                  <div className="h-5 w-5 rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertCircle className="h-3 w-3 text-destructive" />
                  </div>
                )}
                <span className={c.ok ? "text-foreground" : "text-destructive"}>{c.label}</span>
              </div>
            ))}
            {status !== "published" && (
              <Button
                type="button"
                disabled={!allPassed}
                className="rounded-xl gap-2 mt-2"
                onClick={() => onStatusChange("published")}
              >
                공개로 전환
              </Button>
            )}
          </div>
        </>
      )}

      {/* Block Dialog */}
      <Dialog open={blockDialog.open} onOpenChange={(v) => { if (!v) { setBlockDialog({ open: false, type: "" }); resetBlockForm(); } }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingBlock ? "블록 수정" : blockDialog.type === "text" ? "텍스트 블록 추가" : "체크리스트 블록 추가"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>제목</Label>
              <Input value={blockTitle} onChange={(e) => setBlockTitle(e.target.value)} placeholder="블록 제목" className="h-10 rounded-xl" />
            </div>
            {blockDialog.type === "text" && (
              <div className="space-y-2">
                <Label>본문</Label>
                <Textarea value={blockContent} onChange={(e) => setBlockContent(e.target.value)} placeholder="내용을 입력하세요" className="min-h-[120px] rounded-xl resize-none" />
              </div>
            )}
            {blockDialog.type === "checklist" && (
              <div className="space-y-2">
                <Label>항목</Label>
                {blockChecklist.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={item}
                      onChange={(e) => {
                        const next = [...blockChecklist];
                        next[i] = e.target.value;
                        setBlockChecklist(next);
                      }}
                      placeholder={`항목 ${i + 1}`}
                      className="h-9 rounded-xl flex-1"
                    />
                    <button type="button" onClick={() => setBlockChecklist(blockChecklist.filter((_, j) => j !== i))} className="p-2 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => setBlockChecklist([...blockChecklist, ""])} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                  <Plus className="h-3.5 w-3.5" /> 항목 추가
                </button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => { setBlockDialog({ open: false, type: "" }); resetBlockForm(); }}>
              취소
            </Button>
            <Button type="button" className="rounded-xl" onClick={handleSaveBlockDialog} disabled={saveBlock.isPending}>
              {saveBlock.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default B2CSaleSettings;
