import { useRef, useState } from "react";
import * as tus from "tus-js-client";
import { Upload, X, CheckCircle2, HardDrive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

const BUCKET = "course-videos";
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 5; // 5년

export interface DirectVideoUploadResult {
  video_url: string;
  storage_path: string;
  file_size_mb: number;
  duration_minutes: number | null;
}

interface DirectVideoUploaderProps {
  title: string;
  onComplete: (result: DirectVideoUploadResult) => void;
}

/** 브라우저에서 영상 길이(분)를 읽어온다. 실패하면 null. */
const readDurationMinutes = (file: File) =>
  new Promise<number | null>((resolve) => {
    try {
      const el = document.createElement("video");
      el.preload = "metadata";
      const url = URL.createObjectURL(file);
      const cleanup = () => URL.revokeObjectURL(url);
      el.onloadedmetadata = () => {
        const minutes = Number.isFinite(el.duration) ? Math.round(el.duration / 60) : null;
        cleanup();
        resolve(minutes);
      };
      el.onerror = () => {
        cleanup();
        resolve(null);
      };
      el.src = url;
    } catch {
      resolve(null);
    }
  });

const sanitizeName = (name: string) =>
  name.replace(/[^\w.\-]+/g, "_").replace(/_{2,}/g, "_").slice(-80);

const DirectVideoUploader = ({ title, onComplete }: DirectVideoUploaderProps) => {
  const { toast } = useToast();
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<tus.Upload | null>(null);

  const cancel = () => {
    uploadRef.current?.abort();
    uploadRef.current = null;
    setUploading(false);
    setProgress(0);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!title.trim()) {
      toast({ title: "제목을 먼저 입력하세요", variant: "destructive" });
      return;
    }
    if (!file.type.startsWith("video/")) {
      toast({ title: "영상 파일만 업로드할 수 있습니다", variant: "destructive" });
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      toast({ title: "로그인이 필요합니다", variant: "destructive" });
      return;
    }

    const objectPath = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${sanitizeName(file.name)}`;

    setFileName(file.name);
    setUploading(true);
    setDone(false);
    setProgress(0);

    const durationMinutes = await readDurationMinutes(file);

    const upload = new tus.Upload(file, {
      endpoint: `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      chunkSize: 6 * 1024 * 1024, // Supabase Storage 고정 청크 크기
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      headers: {
        authorization: `Bearer ${accessToken}`,
        "x-upsert": "true",
      },
      metadata: {
        bucketName: BUCKET,
        objectName: objectPath,
        contentType: file.type,
        cacheControl: "3600",
      },
      onError: (err) => {
        console.error("CDN upload error:", err);
        toast({ title: "업로드 실패", description: err.message, variant: "destructive" });
        setUploading(false);
      },
      onProgress: (uploaded, total) => setProgress(Math.round((uploaded / total) * 100)),
      onSuccess: async () => {
        uploadRef.current = null;
        try {
          const { data, error } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(objectPath, SIGNED_URL_TTL);
          if (error || !data?.signedUrl) throw error ?? new Error("서명 URL 생성 실패");

          setUploading(false);
          setDone(true);
          toast({ title: "CDN 업로드 완료" });
          onComplete({
            video_url: data.signedUrl,
            storage_path: objectPath,
            file_size_mb: Math.round((file.size / (1024 * 1024)) * 10) / 10,
            duration_minutes: durationMinutes,
          });
        } catch (err) {
          console.error(err);
          setUploading(false);
          toast({ title: "재생 URL 생성 실패", variant: "destructive" });
        }
      },
    });

    uploadRef.current = upload;
    const previous = await upload.findPreviousUploads();
    if (previous.length > 0) upload.resumeFromPreviousUpload(previous[0]);
    upload.start();
  };

  return (
    <div className="rounded-lg border border-border/80 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <HardDrive className="h-4 w-4" /> CDN 직접 업로드
      </div>
      <p className="text-xs text-muted-foreground">
        MP4·MOV·WebM 파일을 우리 CDN 스토리지에 바로 올립니다. 업로드가 끝나면 재생 URL이 자동으로 입력됩니다.
        네트워크가 끊겨도 같은 파일을 다시 선택하면 이어서 업로드됩니다.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFile}
      />

      {!uploading && (
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4 mr-1" /> 영상 파일 선택
        </Button>
      )}

      {uploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="truncate max-w-[70%]">{fileName}</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} />
          <Button type="button" variant="ghost" size="sm" onClick={cancel}>
            <X className="h-4 w-4 mr-1" /> 업로드 취소
          </Button>
        </div>
      )}

      {done && !uploading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-primary" /> 업로드 완료 — 저장 버튼을 눌러 등록하세요.
        </div>
      )}
    </div>
  );
};

export default DirectVideoUploader;
