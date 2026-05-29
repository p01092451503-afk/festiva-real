import { useState, useRef } from "react";
import * as tus from "tus-js-client";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, CheckCircle2 } from "lucide-react";

interface BunnyUploaderProps {
  title: string;
  onComplete: (params: { video_guid: string; library_id: string; cdn_hostname: string; file_size_mb: number; duration_minutes?: number | null }) => void;
}

const BunnyUploader = ({ title, onComplete }: BunnyUploaderProps) => {
  const { toast } = useToast();
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<tus.Upload | null>(null);

  const handlePick = () => fileRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!title.trim()) {
      toast({ title: "제목을 먼저 입력하세요", variant: "destructive" });
      return;
    }

    setUploading(true);
    setProgress(0);
    setDone(false);

    try {
      // 1) Get signed upload params from edge function
      const { data, error } = await supabase.functions.invoke("bunny-stream-upload", {
        body: { title },
      });
      if (error) throw error;

      const { video_guid, library_id, cdn_hostname, tus_endpoint, tus_signature, tus_expiration } = data;

      // 2) Start TUS upload directly to Bunny
      const upload = new tus.Upload(file, {
        endpoint: tus_endpoint,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        chunkSize: 100 * 1024 * 1024, // 100MB chunks
        headers: {
          AuthorizationSignature: tus_signature,
          AuthorizationExpire: String(tus_expiration),
          VideoId: video_guid,
          LibraryId: library_id,
        },
        metadata: {
          filetype: file.type,
          title: title,
        },
        onError: (err) => {
          console.error("Bunny TUS upload error:", err);
          toast({ title: "업로드 실패", description: err.message, variant: "destructive" });
          setUploading(false);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          setProgress(Math.round((bytesUploaded / bytesTotal) * 100));
        },
        onSuccess: async () => {
          setUploading(false);
          setDone(true);
          toast({ title: "CDN 업로드 완료" });
          const file_size_mb = Math.round((file.size / (1024 * 1024)) * 10) / 10;

          // Poll Bunny for processed length (transcoding takes a few seconds)
          let duration_minutes: number | null = null;
          for (let i = 0; i < 12; i++) {
            try {
              const { data: info, error: infoErr } = await supabase.functions.invoke("bunny-stream-info", {
                body: { video_guid },
              });
              if (!infoErr && info?.length_seconds && info.length_seconds > 0) {
                duration_minutes = Math.round((info.length_seconds / 60) * 100) / 100;
                break;
              }
            } catch {
              // ignore, retry
            }
            await new Promise((r) => setTimeout(r, 2500));
          }
          onComplete({ video_guid, library_id, cdn_hostname, file_size_mb, duration_minutes });
        },
      });

      uploadRef.current = upload;
      upload.start();
    } catch (err: any) {
      console.error("Bunny upload start error:", err);
      toast({ title: "업로드 시작 실패", description: err.message, variant: "destructive" });
      setUploading(false);
    }
  };

  const cancel = () => {
    uploadRef.current?.abort();
    setUploading(false);
    setProgress(0);
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFile}
      />
      {!uploading && !done && (
        <Button type="button" variant="outline" onClick={handlePick} className="w-full gap-2">
          <Upload className="h-4 w-4" /> CDN에 동영상 업로드
        </Button>
      )}
      {uploading && (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">업로드 중... {progress}%</span>
            <Button type="button" variant="ghost" size="icon" onClick={cancel} className="h-7 w-7">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}
      {done && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
          <CheckCircle2 className="h-4 w-4" />
          업로드 완료. 저장을 눌러 등록하세요.
        </div>
      )}
    </div>
  );
};

export default BunnyUploader;
