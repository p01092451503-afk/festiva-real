import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isEn: boolean;
  courses: { id: string; title: string }[];
  categories: { id: string; name: string; name_en?: string | null }[];
}

type ParsedRow = {
  rowNum: number;
  data: any;
  errors: string[];
};

const DIFF_MAP: Record<string, string> = {
  "쉬움": "easy", easy: "easy", "보통": "medium", medium: "medium", "어려움": "hard", hard: "hard",
};
const LEVEL_MAP: Record<string, string> = {
  "입문": "beginner", beginner: "beginner", "중급": "intermediate", intermediate: "intermediate",
  "고급": "advanced", advanced: "advanced",
};
const TYPE_MAP: Record<string, string> = {
  "4지선다": "multiple_choice_4", multiple_choice_4: "multiple_choice_4",
  "5지선다": "multiple_choice_5", multiple_choice_5: "multiple_choice_5",
  "OX": "ox", ox: "ox", "단답형": "short_answer", short_answer: "short_answer",
  "서술형": "essay", essay: "essay",
};

export default function QuestionBankBulkUpload({ open, onOpenChange, isEn, courses, categories }: Props) {
  const { user } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string>("");

  const reset = () => {
    setRows([]);
    setFileName("");
    if (fileInput.current) fileInput.current.value = "";
  };

  const downloadTemplate = () => {
    const headers = isEn
      ? ["scope (global or course title)", "category (name, optional)", "difficulty (easy/medium/hard)", "learner_level (beginner/intermediate/advanced)", "question_type (multiple_choice_4/5/ox/short_answer/essay)", "question_text", "option_A", "option_B", "option_C", "option_D", "option_E", "correct_answer", "points", "tags (comma-sep)", "hint", "explanation", "is_active (TRUE/FALSE)"]
      : ["범위 (전역 또는 강의명)", "카테고리 (선택)", "난이도 (쉬움/보통/어려움)", "학습자수준 (입문/중급/고급)", "유형 (4지선다/5지선다/OX/단답형/서술형)", "문항", "보기A", "보기B", "보기C", "보기D", "보기E", "정답", "배점", "태그 (쉼표구분)", "힌트", "해설", "활성 (TRUE/FALSE)"];
    const sample = isEn
      ? ["global", "Safety", "medium", "intermediate", "multiple_choice_4", "What is the first step in CPR?", "Check responsiveness", "Call for help", "Start compressions", "Open airway", "", "Check responsiveness", "10", "safety,cpr", "Think ABC", "Always assess scene first.", "TRUE"]
      : ["전역", "안전", "보통", "중급", "4지선다", "심폐소생술의 첫 단계는?", "반응 확인", "도움 요청", "가슴 압박", "기도 확보", "", "반응 확인", "10", "안전,응급", "ABC를 떠올리세요", "현장 안전 확인이 우선입니다.", "TRUE"];
    const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
    ws["!cols"] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isEn ? "Questions" : "문항");
    XLSX.writeFile(wb, isEn ? "question_bank_template.xlsx" : "문제은행_템플릿.xlsx");
  };

  const validateRow = (raw: any[], rowNum: number): ParsedRow => {
    const errors: string[] = [];
    const [scope, categoryName, diffRaw, levelRaw, typeRaw, qtext, oA, oB, oC, oD, oE, correct, pointsRaw, tagsRaw, hint, explanation, activeRaw] = raw;

    const difficulty = DIFF_MAP[String(diffRaw || "").trim().toLowerCase()] || DIFF_MAP[String(diffRaw || "").trim()];
    const learner_level = LEVEL_MAP[String(levelRaw || "").trim().toLowerCase()] || LEVEL_MAP[String(levelRaw || "").trim()];
    const question_type = TYPE_MAP[String(typeRaw || "").trim().toLowerCase()] || TYPE_MAP[String(typeRaw || "").trim()];

    if (!difficulty) errors.push(isEn ? `Invalid difficulty: ${diffRaw}` : `난이도 오류: ${diffRaw}`);
    if (!learner_level) errors.push(isEn ? `Invalid level: ${levelRaw}` : `수준 오류: ${levelRaw}`);
    if (!question_type) errors.push(isEn ? `Invalid type: ${typeRaw}` : `유형 오류: ${typeRaw}`);
    if (!qtext || !String(qtext).trim()) errors.push(isEn ? "Question text required" : "문항 내용 필수");

    // Scope -> course_id
    let course_id: string | null = null;
    const scopeStr = String(scope || "").trim();
    if (scopeStr && !["전역", "global", "공용"].includes(scopeStr.toLowerCase()) && !["전역", "공용"].includes(scopeStr)) {
      const found = courses.find((c) => c.title.trim().toLowerCase() === scopeStr.toLowerCase());
      if (!found) errors.push(isEn ? `Course not found: ${scopeStr}` : `강의를 찾을 수 없음: ${scopeStr}`);
      else course_id = found.id;
    }

    // Category
    let category_id: string | null = null;
    const catStr = String(categoryName || "").trim();
    if (catStr) {
      const found = categories.find((c) => c.name?.trim().toLowerCase() === catStr.toLowerCase() || c.name_en?.trim().toLowerCase() === catStr.toLowerCase());
      if (found) category_id = found.id;
    }

    // Options
    let options: string[] | null = null;
    if (question_type === "multiple_choice_4") options = [oA, oB, oC, oD].map((x) => String(x || "").trim());
    else if (question_type === "multiple_choice_5") options = [oA, oB, oC, oD, oE].map((x) => String(x || "").trim());
    else if (question_type === "ox") options = ["O", "X"];
    if (options && options.some((o) => !o)) errors.push(isEn ? "All options required" : "보기를 모두 입력하세요");

    const correctStr = String(correct || "").trim();
    if (!correctStr && question_type !== "essay") errors.push(isEn ? "Correct answer required" : "정답 필수");
    if (options && correctStr && !options.includes(correctStr)) {
      errors.push(isEn ? `Correct must match one option: ${correctStr}` : `정답이 보기와 일치하지 않음: ${correctStr}`);
    }

    const points = parseInt(String(pointsRaw)) || 10;
    const tags = String(tagsRaw || "").split(",").map((t) => t.trim()).filter(Boolean);
    const is_active = !["false", "0", "비활성", "no"].includes(String(activeRaw || "true").trim().toLowerCase());

    return {
      rowNum,
      errors,
      data: {
        course_id, category_id, difficulty, learner_level, question_type,
        question_text: String(qtext || "").trim(), options, correct_answer: correctStr,
        points, tags, hint: String(hint || "").trim() || null,
        explanation: String(explanation || "").trim() || null, is_active,
      },
    };
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    // Skip header row
    const dataRows = data.slice(1).filter((r) => r.some((c) => String(c || "").trim() !== ""));
    const parsed = dataRows.map((r, i) => validateRow(r, i + 2));
    setRows(parsed);
  };

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidRows = rows.filter((r) => r.errors.length > 0);

  const handleUpload = async () => {
    if (validRows.length === 0 || !user) return;
    setUploading(true);
    try {
      const payload = validRows.map((r) => ({ ...r.data, created_by: user.id }));
      const { error } = await supabase.from("question_bank" as any).insert(payload);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["question-bank"] });
      toast({ title: isEn ? `${validRows.length} questions uploaded` : `${validRows.length}개 문항 업로드 완료` });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: isEn ? "Upload failed" : "업로드 실패", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEn ? "Bulk Upload from Excel" : "엑셀로 일괄 업로드"}</DialogTitle>
          <DialogDescription>
            {isEn
              ? "Download the template, fill in your questions, then upload. Each row = one question."
              : "템플릿을 다운로드해 문항을 입력한 뒤 업로드하세요. 한 행에 한 문항씩 작성합니다."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadTemplate} className="gap-2">
              <Download className="h-4 w-4" />
              {isEn ? "Download Template" : "템플릿 다운로드"}
            </Button>
            <Button variant="outline" onClick={() => fileInput.current?.click()} className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              {isEn ? "Choose File" : "파일 선택"}
            </Button>
            <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            {fileName && <span className="text-sm text-muted-foreground self-center">{fileName}</span>}
          </div>

          {rows.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <AlertDescription>
                    <strong>{validRows.length}</strong> {isEn ? "valid rows" : "정상 행"}
                  </AlertDescription>
                </Alert>
                <Alert className={invalidRows.length > 0 ? "border-rose-200 bg-rose-50 dark:bg-rose-950/30" : ""}>
                  <AlertCircle className={`h-4 w-4 ${invalidRows.length > 0 ? "text-rose-600" : ""}`} />
                  <AlertDescription>
                    <strong>{invalidRows.length}</strong> {isEn ? "rows with errors" : "오류 행"}
                  </AlertDescription>
                </Alert>
              </div>

              {invalidRows.length > 0 && (
                <ScrollArea className="h-48 border-2 border-border/80 rounded-md p-3">
                  <div className="space-y-2 text-sm">
                    {invalidRows.map((r) => (
                      <div key={r.rowNum} className="border-b border-border/40 pb-2">
                        <div className="font-medium">{isEn ? "Row" : "행"} {r.rowNum}</div>
                        <ul className="list-disc list-inside text-rose-600 dark:text-rose-400 text-xs">
                          {r.errors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{isEn ? "Cancel" : "취소"}</Button>
          <Button onClick={handleUpload} disabled={validRows.length === 0 || uploading} className="gap-2">
            {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            <Upload className="h-4 w-4" />
            {isEn ? `Upload ${validRows.length} questions` : `${validRows.length}개 문항 업로드`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}