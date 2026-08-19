import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface MultilingualValue {
  title_ko: string;
  content_ko: string;
  /** Kept for backward compatibility with existing save handlers (unused). */
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
 * Korean-only title + content editor.
 * Multilingual tabs and auto-translation were removed — the service is KO only.
 */
const MultilingualPostEditor = ({ value, onChange, contentRows = 6 }: Props) => {
  const update = (patch: Partial<MultilingualValue>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">제목 *</Label>
        <Input
          value={value.title_ko}
          onChange={(e) => update({ title_ko: e.target.value })}
          className="h-9 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">내용 *</Label>
        <Textarea
          value={value.content_ko}
          onChange={(e) => update({ content_ko: e.target.value })}
          rows={contentRows}
          className="text-sm"
        />
      </div>
    </div>
  );
};

export default MultilingualPostEditor;
