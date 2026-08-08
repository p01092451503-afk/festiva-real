import { useEffect, useRef, useState, useCallback } from "react";
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  Heading2, Quote, Link2, Image as ImageIcon, AlignLeft, AlignCenter,
  AlignRight, Undo2, Redo2, Eraser, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  /** Storage bucket used for inline image uploads */
  bucket?: string;
  className?: string;
}

const exec = (command: string, arg?: string) => {
  document.execCommand(command, false, arg);
};

const RichTextEditor = ({
  value,
  onChange,
  placeholder = "내용을 입력하세요",
  minHeight = 220,
  bucket = "community-images",
  className,
}: RichTextEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [isEmpty, setIsEmpty] = useState(!value);

  // Sync external value only when it differs (avoids caret jumps)
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value || "";
    }
    setIsEmpty(!el.textContent?.trim() && !el.querySelector("img"));
  }, [value]);

  const emit = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    setIsEmpty(!el.textContent?.trim() && !el.querySelector("img"));
    onChange(el.innerHTML);
  }, [onChange]);

  const run = (command: string, arg?: string) => {
    editorRef.current?.focus();
    exec(command, arg);
    emit();
  };

  const insertLink = () => {
    const url = window.prompt("링크 주소를 입력하세요 (https://...)");
    if (!url) return;
    run("createLink", url);
  };

  const handleImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 5)) {
        if (file.size > 10 * 1024 * 1024) {
          toast({ title: "이미지 용량 초과", description: "10MB 이하 이미지만 첨부할 수 있습니다.", variant: "destructive" });
          continue;
        }
        const path = `editor/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
        const { error } = await supabase.storage.from(bucket).upload(path, file);
        if (error) throw error;
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        run("insertHTML", `<img src="${data.publicUrl}" alt="첨부 이미지" style="max-width:100%;border-radius:8px;" />`);
      }
    } catch (e: any) {
      toast({ title: "이미지 업로드 실패", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const ToolButton = ({
    icon: Icon, label, onClick,
  }: { icon: any; label: string; onClick: () => void }) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );

  return (
    <div className={cn("rounded-md border border-input bg-background", className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border/80 p-1">
        <ToolButton icon={Bold} label="굵게" onClick={() => run("bold")} />
        <ToolButton icon={Italic} label="기울임" onClick={() => run("italic")} />
        <ToolButton icon={Underline} label="밑줄" onClick={() => run("underline")} />
        <ToolButton icon={Strikethrough} label="취소선" onClick={() => run("strikeThrough")} />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ToolButton icon={Heading2} label="제목" onClick={() => run("formatBlock", "<h3>")} />
        <ToolButton icon={Quote} label="인용" onClick={() => run("formatBlock", "<blockquote>")} />
        <ToolButton icon={List} label="글머리 목록" onClick={() => run("insertUnorderedList")} />
        <ToolButton icon={ListOrdered} label="번호 목록" onClick={() => run("insertOrderedList")} />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ToolButton icon={AlignLeft} label="왼쪽 정렬" onClick={() => run("justifyLeft")} />
        <ToolButton icon={AlignCenter} label="가운데 정렬" onClick={() => run("justifyCenter")} />
        <ToolButton icon={AlignRight} label="오른쪽 정렬" onClick={() => run("justifyRight")} />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ToolButton icon={Link2} label="링크" onClick={insertLink} />
        <ToolButton
          icon={uploading ? Loader2 : ImageIcon}
          label="이미지 삽입"
          onClick={() => fileRef.current?.click()}
        />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ToolButton icon={Undo2} label="실행 취소" onClick={() => run("undo")} />
        <ToolButton icon={Redo2} label="다시 실행" onClick={() => run("redo")} />
        <ToolButton icon={Eraser} label="서식 지우기" onClick={() => run("removeFormat")} />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleImages(e.target.files)}
        />
      </div>

      <div className="relative">
        {isEmpty && (
          <span className="pointer-events-none absolute left-3 top-3 text-sm text-muted-foreground">
            {placeholder}
          </span>
        )}
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          aria-label={placeholder}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          onPaste={(e) => {
            e.preventDefault();
            const text = e.clipboardData.getData("text/plain");
            exec("insertText", text);
            emit();
          }}
          style={{ minHeight }}
          className="prose-editor w-full overflow-y-auto p-3 text-sm leading-relaxed outline-none focus-visible:ring-0"
        />
      </div>
    </div>
  );
};

export default RichTextEditor;
