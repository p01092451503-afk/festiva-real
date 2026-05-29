import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Download, Upload, FileSpreadsheet, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  departments: any[];
  onCompleted: () => void;
  teacherRoleEnabled: boolean;
  isEn: boolean;
}

interface ParsedRow {
  rowIndex: number;
  name: string;
  email: string;
  password: string;
  role: string;
  branchName: string;
  departmentName: string;
  position: string;
  // resolved
  departmentId?: string;
  // result
  status: "pending" | "success" | "error" | "duplicate";
  errorMessage?: string;
}

const ROLE_MAP: Record<string, string> = {
  admin: "admin", 관리자: "admin",
  teacher: "teacher", 강사: "teacher",
  student: "student", 학습자: "student", 학생: "student",
};

const BulkStaffUploadDialog = ({ open, onOpenChange, departments, onCompleted, teacherRoleEnabled, isEn }: Props) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [scanning, setScanning] = useState(false);

  const branchByName = useMemo(() => {
    const m = new Map<string, any>();
    departments.filter((d: any) => !d.parent_department_id).forEach((d: any) => {
      m.set((d.name || "").trim().toLowerCase(), d);
      if (d.name_en) m.set(d.name_en.trim().toLowerCase(), d);
    });
    return m;
  }, [departments]);

  const teamByBranchAndName = useMemo(() => {
    const m = new Map<string, any>();
    departments.filter((d: any) => d.parent_department_id).forEach((d: any) => {
      m.set(`${d.parent_department_id}::${(d.name || "").trim().toLowerCase()}`, d);
      if (d.name_en) m.set(`${d.parent_department_id}::${d.name_en.trim().toLowerCase()}`, d);
    });
    return m;
  }, [departments]);

  const downloadTemplate = () => {
    const sample = [
      {
        이름: "홍길동",
        이메일: "hong@webheads.co.kr",
        비밀번호: "Temp1234!",
        역할: "학습자",
        지점: "서울 강남점",
        팀: "",
        직급: "Practitioner",
      },
      {
        이름: "Jane Doe",
        이메일: "jane@webheads.co.kr",
        비밀번호: "Temp1234!",
        역할: "teacher",
        지점: "Manhattan Medspa",
        팀: "",
        직급: "Trainer",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    ws["!cols"] = [{ wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 22 }, { wch: 18 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Staff");
    XLSX.writeFile(wb, "bulk-staff-template.xlsx");
  };

  const handleFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

    const parsed: ParsedRow[] = json.map((r, i) => {
      const name = String(r["이름"] ?? r["Name"] ?? r["name"] ?? "").trim();
      const email = String(r["이메일"] ?? r["Email"] ?? r["email"] ?? "").trim();
      const password = String(r["비밀번호"] ?? r["Password"] ?? r["password"] ?? "").trim();
      const roleRaw = String(r["역할"] ?? r["Role"] ?? r["role"] ?? "student").trim().toLowerCase();
      const branchName = String(r["지점"] ?? r["Branch"] ?? r["branch"] ?? "").trim();
      const departmentName = String(r["팀"] ?? r["부서"] ?? r["Team"] ?? r["Department"] ?? "").trim();
      const position = String(r["직급"] ?? r["Position"] ?? r["position"] ?? "").trim();

      const role = ROLE_MAP[roleRaw] || "student";
      let errorMessage: string | undefined;
      let departmentId: string | undefined;

      if (!name || !email || !password) {
        errorMessage = "이름/이메일/비밀번호는 필수입니다";
      } else if (password.length < 8) {
        errorMessage = "비밀번호는 8자 이상이어야 합니다";
      } else if (!teacherRoleEnabled && role === "teacher") {
        errorMessage = "강사 역할이 비활성화되어 있습니다";
      } else if (branchName) {
        const branch = branchByName.get(branchName.toLowerCase());
        if (!branch) {
          errorMessage = `지점을 찾을 수 없음: ${branchName}`;
        } else {
          departmentId = branch.id;
          if (departmentName) {
            const team = teamByBranchAndName.get(`${branch.id}::${departmentName.toLowerCase()}`);
            if (!team) errorMessage = `팀을 찾을 수 없음: ${departmentName}`;
            else departmentId = team.id;
          }
        }
      }

      return {
        rowIndex: i + 2, // +1 header, +1 1-based
        name, email, password, role, branchName, departmentName, position,
        departmentId,
        status: errorMessage ? "error" : "pending",
        errorMessage,
      };
    });

    // 파일 내 중복 이메일 체크
    const seen = new Map<string, number>();
    parsed.forEach((r) => {
      const key = r.email.toLowerCase();
      if (!key) return;
      if (seen.has(key)) {
        r.status = "duplicate";
        r.errorMessage = `파일 내 중복 이메일 (행 ${seen.get(key)})`;
      } else {
        seen.set(key, r.rowIndex);
      }
    });

    // DB에 이미 존재하는 이메일 일괄 조회
    setScanning(true);
    try {
      const emails = Array.from(
        new Set(parsed.filter((r) => r.email).map((r) => r.email.toLowerCase()))
      );
      if (emails.length > 0) {
        const { data: existing, error } = await supabase
          .from("profiles")
          .select("email")
          .in("email", emails);
        if (error) {
          toast.error("기존 이메일 조회 실패: " + error.message);
        } else {
          const existSet = new Set((existing || []).map((p: any) => (p.email || "").toLowerCase()));
          parsed.forEach((r) => {
            if (r.status === "pending" && existSet.has(r.email.toLowerCase())) {
              r.status = "duplicate";
              r.errorMessage = "이미 존재하는 이메일";
            }
          });
        }
      }
    } finally {
      setScanning(false);
    }

    setRows(parsed);
    const dupCount = parsed.filter((r) => r.status === "duplicate").length;
    if (dupCount > 0) toast.message(`중복 이메일 ${dupCount}건은 업로드에서 제외됩니다`);
  };

  const startUpload = async () => {
    const queue = rows.filter((r) => r.status === "pending");
    if (queue.length === 0) {
      toast.error("업로드할 유효한 행이 없습니다");
      return;
    }
    setUploading(true);
    setProgress({ done: 0, total: queue.length });

    let success = 0, fail = 0;
    const updated = [...rows];

    for (const row of queue) {
      const idx = updated.findIndex((r) => r.rowIndex === row.rowIndex);
      try {
        const { data, error } = await supabase.functions.invoke("create-user", {
          body: {
            email: row.email,
            password: row.password,
            fullName: row.name,
            role: row.role,
            departmentId: row.departmentId,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        // Update position separately if provided
        if (row.position && data?.user?.id) {
          await supabase.from("profiles").update({ position: row.position }).eq("user_id", data.user.id);
        }

        updated[idx] = { ...row, status: "success" };
        success++;
      } catch (e: any) {
        updated[idx] = { ...row, status: "error", errorMessage: e?.message || "오류" };
        fail++;
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
      setRows([...updated]);
    }

    setUploading(false);
    toast.success(`완료: 성공 ${success}건, 실패 ${fail}건`);
    if (success > 0) onCompleted();
  };

  const reset = () => {
    setRows([]);
    setProgress({ done: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validCount = rows.filter((r) => r.status === "pending" || r.status === "success").length;
  const errorCount = rows.filter((r) => r.status === "error").length;
  const successCount = rows.filter((r) => r.status === "success").length;
  const duplicateCount = rows.filter((r) => r.status === "duplicate").length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> 회원 대량 추가 (엑셀)
          </DialogTitle>
          <DialogDescription>
            템플릿을 다운로드하여 작성한 후 업로드하세요. 컬럼: 이름, 이메일, 비밀번호, 역할(학습자/강사/관리자), 지점, 팀(선택), 직급(선택)
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
            <Download className="h-4 w-4" /> 템플릿 다운로드
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2" disabled={uploading}>
            <Upload className="h-4 w-4" /> 파일 선택
          </Button>
          {rows.length > 0 && (
            <Button variant="ghost" size="sm" onClick={reset} disabled={uploading}>초기화</Button>
          )}
        </div>

        {rows.length > 0 && (
          <>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>총 {rows.length}건</span>
              <span className="text-emerald-600">유효 {validCount - successCount + (uploading ? 0 : 0)}건</span>
              {successCount > 0 && <span className="text-primary">성공 {successCount}건</span>}
              {errorCount > 0 && <span className="text-destructive">오류 {errorCount}건</span>}
              {duplicateCount > 0 && <span className="text-amber-600">중복 {duplicateCount}건 (제외)</span>}
              {uploading && <span>· 진행 {progress.done}/{progress.total}</span>}
              {scanning && <span>· 기존 이메일 확인 중...</span>}
            </div>

            <div className="flex-1 overflow-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-2 w-10">#</th>
                    <th className="text-left px-2 py-2 w-10">상태</th>
                    <th className="text-left px-2 py-2">이름</th>
                    <th className="text-left px-2 py-2">이메일</th>
                    <th className="text-left px-2 py-2">역할</th>
                    <th className="text-left px-2 py-2">지점/팀</th>
                    <th className="text-left px-2 py-2">메시지</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.rowIndex}>
                      <td className="px-2 py-1.5 text-muted-foreground">{r.rowIndex}</td>
                      <td className="px-2 py-1.5">
                        {r.status === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                        {r.status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
                        {r.status === "duplicate" && <XCircle className="h-4 w-4 text-amber-600" />}
                        {r.status === "pending" && <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" />}
                      </td>
                      <td className="px-2 py-1.5">{r.name}</td>
                      <td className="px-2 py-1.5">{r.email}</td>
                      <td className="px-2 py-1.5">{r.role}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {r.branchName}{r.departmentName ? ` / ${r.departmentName}` : ""}
                      </td>
                      <td className="px-2 py-1.5 text-destructive">{r.errorMessage || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>닫기</Button>
              <Button onClick={startUpload} disabled={uploading || rows.every((r) => r.status !== "pending")} className="gap-2">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? `업로드 중... (${progress.done}/${progress.total})` : `${rows.filter((r) => r.status === "pending").length}건 업로드`}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BulkStaffUploadDialog;
