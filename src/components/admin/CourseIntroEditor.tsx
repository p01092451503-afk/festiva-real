import { useState } from "react";
import {
  Plus, Trash2, ArrowUp, ArrowDown, Type, Image as ImageIcon,
  CheckSquare, Loader2, Video, Heading, Pencil, FileText,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DetailBlock {
  id?: string;
  block_type: "text" | "heading" | "image" | "video" | "checklist";
  title: string | null;
  content: string | null;
  image_url: string | null;
  video_url: string | null;
  video_provider: string | null;
  checklist_items: string[] | null;
  sort_order: number;
}

interface Props {
  courseId: string;
}

const BLOCK_LABEL: Record<DetailBlock["block_type"], string> = {
  heading: "제목",
  text: "본문",
  image: "이미지",
  video: "영상",
  checklist: "체크리스트",
};

const detectVideoProvider = (url: string): "youtube" | "vimeo" | "cdn" => {
  if (/youtu\.be|youtube\.com/.test(url)) return "youtube";
  if (/vimeo\.com/.test(url)) return "vimeo";
  return "cdn";
};

const CourseIntroEditor = ({ courseId }: Props) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; type: DetailBlock["block_type"] | "" }>({ open: false, type: "" });
  const [editing, setEditing] = useState<DetailBlock | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [checklist, setChecklist] = useState<string[]>([""]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const { data: blocks = [], refetch } = useQuery({
    queryKey: ["course-intro-blocks", courseId],
    queryFn: async () => {
      if (!courseId) return [];
      const { data, error } = await supabase
        .from("course_detail_blocks")
        .select("*")
        .eq("course_id", courseId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data as any[]) as DetailBlock[];
    },
    enabled: !!courseId,
  });

  const reset = () => {
    setEditing(null);
    setTitle("");
    setContent("");
    setVideoUrl("");
    setChecklist([""]);
  };

  const openAdd = (type: DetailBlock["block_type"]) => {
    reset();
    setDialog({ open: true, type });
  };

  const openEdit = (b: DetailBlock) => {
    setEditing(b);
    setTitle(b.title || "");
    setContent(b.content || "");
    setVideoUrl(b.video_url || "");
    setChecklist(b.checklist_items?.length ? [...b.checklist_items] : [""]);
    setDialog({ open: true, type: b.block_type });
  };

  const save = useMutation({
    mutationFn: async () => {
      const type = (editing?.block_type || dialog.type) as DetailBlock["block_type"];
      const payload: any = {
        block_type: type,
        title: title || null,
        content: content || null,
        checklist_items: type === "checklist" ? checklist.filter(Boolean) : [],
        video_url: type === "video" ? (videoUrl || null) : null,
        video_provider: type === "video" && videoUrl ? detectVideoProvider(videoUrl) : null,
      };
      if (editing?.id) {
        const { error } = await supabase.from("course_detail_blocks").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("course_detail_blocks").insert({
          ...payload,
          course_id: courseId,
          sort_order: blocks.length,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["store-course-blocks", courseId] });
      setDialog({ open: false, type: "" });
      reset();
    },
    onError: (e: any) => toast({ title: "저장 실패", description: e.message, variant: "destructive" }),
  });

  const remove = async (id: string) => {
    await supabase.from("course_detail_blocks").delete().eq("id", id);
    refetch();
    queryClient.invalidateQueries({ queryKey: ["store-course-blocks", courseId] });
  };

  const swap = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= blocks.length) return;
    const a = blocks[idx];
    const b = blocks[target];
    await Promise.all([
      supabase.from("course_detail_blocks").update({ sort_order: target }).eq("id", a.id!),
      supabase.from("course_detail_blocks").update({ sort_order: idx }).eq("id", b.id!),
    ]);
    refetch();
    queryClient.invalidateQueries({ queryKey: ["store-course-blocks", courseId] });
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
    refetch();
    queryClient.invalidateQueries({ queryKey: ["store-course-blocks", courseId] });
    setUploading(false);
    setUploadProgress(0);
  };

  const renderPreview = (b: DetailBlock) => {
    switch (b.block_type) {
      case "heading":
        return <h4 className="text-base font-bold text-foreground">{b.title || "(제목 없음)"}</h4>;
      case "text":
        return (
          <div className="space-y-1">
            {b.title && <p className="text-sm font-semibold">{b.title}</p>}
            <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">{b.content || "(내용 없음)"}</p>
          </div>
        );
      case "image":
        return b.image_url ? (
          <img src={b.image_url} alt="" className="max-h-40 rounded-lg" loading="lazy" />
        ) : <p className="text-xs text-muted-foreground">이미지 없음</p>;
      case "video":
        return (
          <div className="flex items-center gap-2 text-sm">
            <Video className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{b.video_url || "(영상 URL 없음)"}</span>
            {b.video_provider && <Badge variant="outline" className="text-[10px]">{b.video_provider}</Badge>}
          </div>
        );
      case "checklist":
        return (
          <ul className="text-sm text-muted-foreground space-y-0.5">
            {(b.checklist_items || []).slice(0, 4).map((it, i) => <li key={i}>· {it}</li>)}
          </ul>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => openAdd("heading")}>
          <Heading className="h-3.5 w-3.5" /> 제목
        </Button>
        <Button type="button" size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => openAdd("text")}>
          <Type className="h-3.5 w-3.5" /> 본문
        </Button>
        <label className="inline-flex">
          <Button type="button" size="sm" variant="outline" className="rounded-xl gap-1.5" asChild>
            <span>
              <ImageIcon className="h-3.5 w-3.5" /> 이미지
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.currentTarget.value = ""; }}
              />
            </span>
          </Button>
        </label>
        <Button type="button" size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => openAdd("video")}>
          <Video className="h-3.5 w-3.5" /> 영상
        </Button>
        <Button type="button" size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => openAdd("checklist")}>
          <CheckSquare className="h-3.5 w-3.5" /> 체크리스트
        </Button>
        {uploading && (
          <div className="flex items-center gap-2 ml-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            <Progress value={uploadProgress} className="w-24 h-1.5" />
          </div>
        )}
      </div>

      {blocks.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          <FileText className="h-6 w-6 mx-auto mb-2 opacity-40" />
          상단 버튼으로 소개 블록을 추가하세요. 추가한 순서대로 강의 상세 페이지에 표시됩니다.
        </div>
      ) : (
        <div className="space-y-2">
          {blocks.map((b, idx) => (
            <div key={b.id} className="border border-border rounded-xl p-3 flex items-start gap-3 group">
              <div className="flex flex-col gap-1 pt-1">
                <button type="button" onClick={() => swap(idx, -1)} disabled={idx === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => swap(idx, 1)} disabled={idx === blocks.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <Badge variant="outline" className="text-[10px]">{BLOCK_LABEL[b.block_type]}</Badge>
                {renderPreview(b)}
              </div>
              <div className="flex items-center gap-1">
                {b.block_type !== "image" && (
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(b)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => b.id && remove(b.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialog.open} onOpenChange={(o) => { if (!o) { setDialog({ open: false, type: "" }); reset(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "블록 수정" : `${BLOCK_LABEL[(dialog.type || "text") as DetailBlock["block_type"]]} 추가`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {dialog.type === "heading" && (
              <div className="space-y-1.5">
                <Label className="text-xs">제목</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 이런 분께 추천합니다" />
              </div>
            )}
            {dialog.type === "text" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">소제목 (선택)</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">본문</Label>
                  <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[140px]" />
                </div>
              </>
            )}
            {dialog.type === "video" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">영상 제목 (선택)</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">영상 URL (YouTube / Vimeo / 직접 링크)</Label>
                  <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://" />
                </div>
              </>
            )}
            {dialog.type === "checklist" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">제목 (선택)</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">항목</Label>
                  {checklist.map((it, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input value={it} onChange={(e) => setChecklist((prev) => prev.map((v, idx) => idx === i ? e.target.value : v))} />
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8"
                        onClick={() => setChecklist((prev) => prev.filter((_, idx) => idx !== i))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" size="sm" variant="outline" className="rounded-xl gap-1.5"
                    onClick={() => setChecklist((prev) => [...prev, ""])}>
                    <Plus className="h-3 w-3" /> 항목 추가
                  </Button>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setDialog({ open: false, type: "" }); reset(); }}>취소</Button>
            <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CourseIntroEditor;
