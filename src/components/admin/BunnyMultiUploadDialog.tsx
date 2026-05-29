import { useRef, useState, useCallback } from "react";
import * as tus from "tus-js-client";
import { Upload, X, CheckCircle2, AlertCircle, Loader2, FileVideo } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { useQueryClient } from "@tanstack/react-query";

type ItemStatus = "queued" | "uploading" | "processing" | "done" | "error";

interface UploadItem {
  id: string;
  file: File;
  title: string;
  status: ItemStatus;
  progress: number;
  error?: string;
}

const IMAGE_MAX = 50 * 1024 * 1024; // 50MB
const VIDEO_MAX = 5 * 1024 * 1024 * 1024; // 5GB

const stripExt = (name: string) => name.replace(/\.[^/.]+$/, "");

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const BunnyMultiUploadDialog = ({ open, onOpenChange }: Props) => {
  const { toast } = useToast();
  const { user } = useUser();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [running, setRunning] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setItems([]);
    setRunning(false);
  };

  const validateFile = (f: File): string | null => {
    const isImg = f.type.startsWith("image/");
    const isVid = f.type.startsWith("video/");
    if (!isImg && !isVid) return "이미지/영상 파일만 업로드할 수 있습니다.";
    if (isImg && f.size > IMAGE_MAX) return "이미지는 최대 50MB까지 가능합니다.";
    if (isVid && f.size > VIDEO_MAX) return "영상은 최대 5GB까지 가능합니다.";
    return null;
  };

  const addFiles = useCallback((files: FileList | File[]) => {
    const next: UploadItem[] = [];
    Array.from(files).forEach((f) => {
      const err = validateFile(f);
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        title: stripExt(f.name),
        status: err ? "error" : "queued",
        progress: 0,
        error: err ?? undefined,
      });
    });
    setItems((prev) => [...prev, ...next]);
  }, []);

  const handlePick = () => fileRef.current?.click();

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  // 한 파일을 Bunny TUS로 업로드하고 video_assets 행 생성
  const uploadOne = async (item: UploadItem) =>
    new Promise<void>(async (resolve) => {
      try {
        updateItem(item.id, { status: "uploading", progress: 0 });

        const { data, error } = await supabase.functions.invoke("bunny-stream-upload", {
          body: { title: item.title || stripExt(item.file.name) },
        });
        if (error) throw error;
        const { video_guid, library_id, cdn_hostname, tus_endpoint, tus_signature, tus_expiration } = data;

        const upload = new tus.Upload(item.file, {
          endpoint: tus_endpoint,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          chunkSize: 100 * 1024 * 1024,
          headers: {
            AuthorizationSignature: tus_signature,
            AuthorizationExpire: String(tus_expiration),
            VideoId: video_guid,
            LibraryId: library_id,
          },
          metadata: {
            filetype: item.file.type,
            title: item.title || stripExt(item.file.name),
          },
          onError: (err) => {
            console.error("TUS error", err);
            updateItem(item.id, { status: "error", error: err.message });
            resolve();
          },
          onProgress: (b, t) => {
            updateItem(item.id, { progress: Math.round((b / t) * 100) });
          },
          onSuccess: async () => {
            updateItem(item.id, { status: "processing", progress: 100 });
            const file_size_mb = Math.round((item.file.size / (1024 * 1024)) * 10) / 10;

            // 트랜스코딩 후 duration 조회 (최대 ~30초 대기)
            let duration_minutes: number | null = null;
            for (let i = 0; i < 12; i++) {
              try {
                const { data: info, error: infoErr } = await supabase.functions.invoke(
                  "bunny-stream-info",
                  { body: { video_guid } },
                );
                if (!infoErr && info?.length_seconds && info.length_seconds > 0) {
                  duration_minutes = Math.round((info.length_seconds / 60) * 100) / 100;
                  break;
                }
              } catch { /* retry */ }
              await new Promise((r) => setTimeout(r, 2500));
            }

            // video_assets 테이블에 등록
            const { error: insertErr } = await supabase.from("video_assets").insert({
              title: item.title || stripExt(item.file.name),
              video_url: `bunny://${video_guid}`,
              video_provider: "bunny",
              bunny_video_guid: video_guid,
              file_size_mb,
              duration_minutes,
              uploaded_by: user!.id,
            });
            if (insertErr) {
              updateItem(item.id, { status: "error", error: insertErr.message });
            } else {
              updateItem(item.id, { status: "done" });
            }
            resolve();
          },
        });
        upload.start();
      } catch (e: any) {
        console.error(e);
        updateItem(item.id, { status: "error", error: e?.message ?? "업로드 실패" });
        resolve();
      }
    });

  const startAll = async () => {
    const queued = items.filter((i) => i.status === "queued");
    if (!queued.length) return;
    setRunning(true);
    // 동시 2개씩 처리 (CDN 부하 분산)
    const concurrency = 2;
    let idx = 0;
    const workers = Array.from({ length: Math.min(concurrency, queued.length) }, async () => {
      while (idx < queued.length) {
        const item = queued[idx++];
        await uploadOne(item);
      }
    });
    await Promise.all(workers);
    setRunning(false);
    qc.invalidateQueries({ queryKey: ["video-assets"] });
    // 최신 상태 기준으로 완료/실패 카운트
    setItems((prev) => {
      const doneCount = prev.filter((i) => i.status === "done").length;
      const errorCount = prev.filter((i) => i.status === "error").length;
      if (errorCount === 0 && doneCount > 0) {
        toast({
          title: "업로드 완료",
          description: `${doneCount}개 파일이 동영상 관리 목록에 추가되었습니다.`,
        });
        // 모두 성공한 경우 다이얼로그 자동 닫기
        setTimeout(() => {
          onOpenChange(false);
          reset();
        }, 600);
      } else {
        toast({
          title: "업로드 종료",
          description: `완료 ${doneCount}개 · 실패 ${errorCount}개`,
          variant: errorCount > 0 ? "destructive" : "default",
        });
      }
      return prev;
    });
  };

  const handleClose = (o: boolean) => {
    if (running) {
      toast({ title: "업로드 진행 중에는 닫을 수 없습니다.", variant: "destructive" });
      return;
    }
    onOpenChange(o);
    if (!o) reset();
  };

  const queuedCount = items.filter((i) => i.status === "queued").length;
  const hasItems = items.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> 다중 미디어 업로드 (Global CDN)
          </DialogTitle>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept="video/*,image/*"
          multiple
          className="hidden"
          onChange={onFileInput}
        />

        {/* Dropzone */}
        <div
          onClick={handlePick}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`cursor-pointer rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/30 hover:bg-muted/50"
          }`}
        >
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium">이미지/영상을 드래그하거나 클릭하여 선택</p>
          <p className="text-xs text-muted-foreground mt-1">이미지 최대 50MB, 영상 최대 5GB · 여러 파일 동시 선택 가능</p>
        </div>

        {/* File list */}
        {hasItems && (
          <div className="max-h-72 overflow-y-auto space-y-2 mt-2">
            {items.map((it) => (
              <div
                key={it.id}
                className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
              >
                <FileVideo className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium truncate">{it.title}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {(it.file.size / (1024 * 1024)).toFixed(1)}MB
                    </span>
                  </div>
                  {it.status === "uploading" && (
                    <Progress value={it.progress} className="h-1 mt-1.5" />
                  )}
                  {it.status === "error" && (
                    <p className="text-[11px] text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {it.error}
                    </p>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  {it.status === "queued" && (
                    <span className="text-[10px] text-muted-foreground">대기</span>
                  )}
                  {it.status === "uploading" && (
                    <span className="text-[10px] text-primary tabular-nums">{it.progress}%</span>
                  )}
                  {it.status === "processing" && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> 처리중
                    </span>
                  )}
                  {it.status === "done" && (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                  {(it.status === "queued" || it.status === "error") && !running && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeItem(it.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={running}>
            {items.every((i) => i.status === "done") && items.length > 0 ? "닫기" : "취소"}
          </Button>
          <Button onClick={startAll} disabled={running || queuedCount === 0}>
            {running ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" /> 업로드 중...
              </>
            ) : (
              <>업로드 시작 {queuedCount > 0 ? `(${queuedCount})` : ""}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BunnyMultiUploadDialog;
