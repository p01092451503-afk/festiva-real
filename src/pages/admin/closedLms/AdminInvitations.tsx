import { useMemo, useState } from "react";
import { Users, Upload, Send, FileDown, Info } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useFeatureModules } from "@/hooks/useFeatureModules";
import { Navigate } from "react-router-dom";

interface Row {
  recipient_name: string;
  phone: string;
  email?: string;
  affiliation?: string;
  error?: string;
}

const CSV_TEMPLATE = "이름,휴대폰,이메일,소속\n홍길동,01012345678,hong@example.com,영업1팀\n";

function parseCsv(text: string): Row[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const header = lines[0].split(",").map((h) => h.trim());
  const idxName = header.findIndex((h) => /이름|name/i.test(h));
  const idxPhone = header.findIndex((h) => /휴대폰|phone|연락처/i.test(h));
  const idxEmail = header.findIndex((h) => /이메일|email/i.test(h));
  const idxAff = header.findIndex((h) => /소속|부서|affiliation|department/i.test(h));
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const phone = (cells[idxPhone] ?? "").replace(/[^0-9]/g, "");
    const r: Row = {
      recipient_name: cells[idxName] ?? "",
      phone,
      email: idxEmail >= 0 ? cells[idxEmail] : undefined,
      affiliation: idxAff >= 0 ? cells[idxAff] : undefined,
    };
    if (!r.recipient_name) r.error = "이름 누락";
    else if (!/^010\d{8}$/.test(phone)) r.error = "휴대폰 형식 오류";
    return r;
  });
}

export default function AdminInvitations() {
  const { isEnabled, isLoading: modulesLoading } = useFeatureModules();
  const [courseId, setCourseId] = useState<string>("");
  const [delivery, setDelivery] = useState<"magic_link" | "credentials" | "both">("magic_link");
  const [rows, setRows] = useState<Row[]>([]);
  const [sending, setSending] = useState(false);

  const { data: courses = [] } = useQuery({
    queryKey: ["closed-lms-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const validCount = useMemo(() => rows.filter((r) => !r.error).length, [rows]);
  const errorCount = rows.length - validCount;

  if (!modulesLoading && !isEnabled("closed_lms")) return <Navigate to="/admin" replace />;

  const handleFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseCsv(text);
    setRows(parsed);
    toast.success(`${parsed.length}건 불러왔습니다 (유효 ${parsed.filter((r) => !r.error).length}, 오류 ${parsed.filter((r) => r.error).length})`);
  };

  const downloadTemplate = () => {
    const blob = new Blob(["\uFEFF" + CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "수강자_초대_템플릿.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const send = async () => {
    if (!courseId) return toast.error("강의를 선택하세요");
    const valid = rows.filter((r) => !r.error);
    if (valid.length === 0) return toast.error("유효한 수강자가 없습니다");
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-course-invite", {
        body: { course_id: courseId, delivery_method: delivery, recipients: valid },
      });
      if (error) throw error;
      toast.success(`초대 발송 완료: 성공 ${data?.success_count ?? 0}건 / 실패 ${data?.fail_count ?? 0}건`);
      setRows([]);
    } catch (e: any) {
      toast.error(e?.message || "발송 실패");
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 min-w-0">
        <header className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-muted-foreground" />
            <h1 className="text-xl sm:text-2xl font-semibold">수강자 일괄 초대</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            CSV로 수강자를 등록하고 SMS로 강의 안내 + 자동 로그인 링크를 발송합니다. (링크 유효기간 14일)
          </p>
        </header>

        <section className="stat-card space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>강의 선택</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger><SelectValue placeholder="강의를 선택하세요" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>발송 방식</Label>
              <RadioGroup value={delivery} onValueChange={(v) => setDelivery(v as any)} className="flex flex-col gap-2 pt-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="magic_link" /> 1회용 로그인 링크만
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="credentials" /> ID / 임시 비밀번호만
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="both" /> 둘 다 발송
                </label>
              </RadioGroup>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/60">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <FileDown className="w-4 h-4 mr-1" /> CSV 템플릿 다운로드
            </Button>
            <Label htmlFor="csv-upload" className="cursor-pointer">
              <span className="inline-flex items-center gap-1 h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent">
                <Upload className="w-4 h-4" /> CSV 업로드
              </span>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </Label>
            {rows.length > 0 && (
              <span className="text-sm text-muted-foreground">
                전체 {rows.length}건 · 유효 <strong className="text-foreground">{validCount}</strong> · 오류 <strong className="text-destructive">{errorCount}</strong>
              </span>
            )}
          </div>
        </section>

        {rows.length > 0 && (
          <section className="stat-card !p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead>휴대폰</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>소속</TableHead>
                  <TableHead className="w-24">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 200).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>{r.recipient_name || <span className="text-destructive">—</span>}</TableCell>
                    <TableCell className="font-mono text-xs">{r.phone || "—"}</TableCell>
                    <TableCell className="text-xs">{r.email || "—"}</TableCell>
                    <TableCell className="text-xs">{r.affiliation || "—"}</TableCell>
                    <TableCell>
                      {r.error
                        ? <Badge variant="destructive">{r.error}</Badge>
                        : <Badge variant="secondary">대기</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {rows.length > 200 && (
              <p className="text-xs text-muted-foreground p-3 border-t">최대 200건만 미리보기로 표시됩니다. 전송 시에는 모두 처리됩니다.</p>
            )}
          </section>
        )}

        <div className="flex items-center justify-between gap-3 p-4 rounded-md bg-muted/30 border border-border/60">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              알리고 API 연동은 준비 단계입니다. 현재는 발송 요청이 시스템에 정상 기록되며, 실제 SMS는 API 키 설정 후 자동 전송됩니다.
            </span>
          </div>
          <Button disabled={sending || rows.length === 0 || !courseId} onClick={send} className="shrink-0">
            <Send className="w-4 h-4 mr-1" /> {sending ? "발송 중…" : `${validCount}건 초대 발송`}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}