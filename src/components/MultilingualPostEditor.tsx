import { useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { translateKoToEn } from "@/lib/translate";
import { toast } from "@/hooks/use-toast";

export interface MultilingualValue {
  title_ko: string;
  content_ko: string;
  title_en: string;
  content_en: string;
}

export const EMPTY_MULTILINGUAL: MultilingualValue = {
  title_ko: "",
  content_ko: "",
  title_en: "",
  content_en: "",
};

interface Props {
  value: MultilingualValue;
  onChange: (next: MultilingualValue) => void;
  contentRows?: number;
}

/**
 * Bilingual (KO/EN) title + content editor with optional auto-translation.
 *
 * - Tab toggle between Korean and English fields
 * - Auto-translate switch (default OFF). When ON, edits to Korean fields
 *   are mirrored to English via the translate edge function on demand.
 * - When OFF, users edit each language independently and can hit the
 *   "한→영 자동 번역" button to translate KO -> EN once.
 */
const MultilingualPostEditor = ({ value, onChange, contentRows = 6 }: Props) => {
  const [tab, setTab] = useState<"ko" | "en">("ko");
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [translating, setTranslating] = useState(false);

  const update = (patch: Partial<MultilingualValue>) => onChange({ ...value, ...patch });

  const runTranslate = async () => {
    if (!value.title_ko.trim() && !value.content_ko.trim()) {
      toast({ title: "한국어 내용을 먼저 입력해주세요", variant: "destructive" });
      return;
    }
    setTranslating(true);
    try {
      const [titleEn, contentEn] = await translateKoToEn([value.title_ko, value.content_ko]);
      update({ title_en: titleEn || value.title_ko, content_en: contentEn || value.content_ko });
      toast({ title: "영문 번역 완료" });
      setTab("en");
    } catch {
      toast({ title: "번역 실패", variant: "destructive" });
    } finally {
      setTranslating(false);
    }
  };

  const onKoTitleChange = async (v: string) => {
    update({ title_ko: v });
  };
  const onKoContentChange = async (v: string) => {
    update({ content_ko: v });
  };

  return (
    <div className="space-y-3">
      {/* Header: language tabs + auto-translate controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="inline-flex items-center rounded-full bg-muted p-1 text-sm">
          <button
            type="button"
            onClick={() => setTab("ko")}
            className={cn(
              "px-4 py-1.5 rounded-full transition-colors",
              tab === "ko" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            한국어
          </button>
          <button
            type="button"
            onClick={() => setTab("en")}
            className={cn(
              "px-4 py-1.5 rounded-full transition-colors",
              tab === "en" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            English
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="auto-translate"
              checked={autoTranslate}
              onCheckedChange={(v) => {
                setAutoTranslate(v);
                if (v) runTranslate();
              }}
            />
            <Label htmlFor="auto-translate" className="text-xs text-muted-foreground cursor-pointer">
              자동 번역
            </Label>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-full text-xs"
            onClick={runTranslate}
            disabled={translating}
          >
            {translating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
            한→영 자동 번역
          </Button>
        </div>
      </div>

      {/* KO fields */}
      {tab === "ko" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">제목 (KO) *</Label>
            <Input value={value.title_ko} onChange={(e) => onKoTitleChange(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">내용 (KO) *</Label>
            <Textarea
              value={value.content_ko}
              onChange={(e) => onKoContentChange(e.target.value)}
              rows={contentRows}
              className="text-sm"
            />
          </div>
        </div>
      )}

      {/* EN fields */}
      {tab === "en" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Title (EN)</Label>
            <Input
              value={value.title_en}
              onChange={(e) => update({ title_en: e.target.value })}
              placeholder="Enter English title or use auto-translate"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Content (EN)</Label>
            <Textarea
              value={value.content_en}
              onChange={(e) => update({ content_en: e.target.value })}
              rows={contentRows}
              placeholder="Enter English content or use auto-translate"
              className="text-sm"
            />
          </div>
          {autoTranslate && (
            <p className="text-[11px] text-muted-foreground">
              자동 번역이 켜져 있습니다. 영문을 직접 수정하면 그대로 저장됩니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default MultilingualPostEditor;