import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, FileDown } from "lucide-react";

export interface RosterRow {
  affiliation: string; // 소속
  employeeId: string;  // 사번
  name: string;        // 성명
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseTitle: string;
  rows: RosterRow[];
}

const TOTAL_ROWS = 60;

const CompletionRosterPrint = ({ open, onOpenChange, courseTitle, rows }: Props) => {
  const [title, setTitle] = useState(courseTitle);
  const [orgSuffix, setOrgSuffix] = useState("FII");
  const [period, setPeriod] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [issuer, setIssuer] = useState("㈜메타엠");

  useEffect(() => {
    if (open) {
      setTitle(courseTitle);
      setConfirmText(`위 훈련생은 ${courseTitle}을 수료 하였음을 확인 합니다.`);
    }
  }, [open, courseTitle]);

  const padded: (RosterRow | null)[] = useMemo(() => {
    const arr: (RosterRow | null)[] = [];
    for (let i = 0; i < TOTAL_ROWS; i++) arr.push(rows[i] ?? null);
    return arr;
  }, [rows]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto print:max-w-none print:max-h-none print:shadow-none print:p-0">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" /> 교육 수료자 명단 인쇄
          </DialogTitle>
        </DialogHeader>

        {/* Editable fields (hidden in print) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 print:hidden">
          <div className="space-y-1.5">
            <Label className="text-xs">훈련 과정명</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">소속 회사 (제목 우측 접미사)</Label>
            <Input value={orgSuffix} onChange={(e) => setOrgSuffix(e.target.value)} placeholder="예: FII" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">훈련 기간</Label>
            <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="예: 2025-10-15~2025-12-19" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">발행 기관</Label>
            <Input value={issuer} onChange={(e) => setIssuer(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">확인 문구</Label>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          </div>
        </div>

        {/* Printable area */}
        <div
          id="roster-print-area"
          className="bg-white text-black p-8 print:p-0 border border-border print:border-0 rounded print:rounded-none"
          style={{ fontFamily: "'Malgun Gothic','맑은 고딕','Noto Sans KR',sans-serif" }}
        >
          {/* Title bar */}
          <div className="bg-[#3d5d8f] text-white text-center font-bold text-[20px] tracking-wide py-3">
            교육 수료자 명단{orgSuffix ? `_ ${orgSuffix}` : ""}
          </div>

          {/* Meta */}
          <div className="flex items-end justify-between mt-7 mb-3 text-[13px]">
            <div className="font-bold underline underline-offset-[3px] decoration-[1px]">
              훈련 과정명 : {title}
            </div>
            <div className="text-[13px]">훈련기간 : {period || "—"}</div>
          </div>

          {/* Two-column roster table */}
          <div className="grid grid-cols-2 gap-6">
            {[0, 1].map((col) => (
              <table key={col} className="w-full border-collapse text-[12px] table-fixed">
                <colgroup>
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "26%" }} />
                  <col style={{ width: "30%" }} />
                  <col style={{ width: "30%" }} />
                </colgroup>
                <thead>
                  <tr className="bg-[#dde7f0]">
                    <th className="border border-[#a9b6c6] py-1.5 font-normal text-center">연번</th>
                    <th className="border border-[#a9b6c6] py-1.5 font-normal text-center">소속</th>
                    <th className="border border-[#a9b6c6] py-1.5 font-normal text-center">사번</th>
                    <th className="border border-[#a9b6c6] py-1.5 font-normal text-center">성명</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 30 }).map((_, i) => {
                    const idx = col * 30 + i;
                    const row = padded[idx];
                    return (
                      <tr key={idx}>
                        <td className="border border-[#a9b6c6] text-center h-[24px]">{idx + 1}</td>
                        <td className="border border-[#a9b6c6] text-center">{row?.affiliation ?? ""}</td>
                        <td className="border border-[#a9b6c6] text-center">{row?.employeeId ?? ""}</td>
                        <td className="border border-[#a9b6c6] text-center">{row?.name ?? ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-8 flex items-center justify-between text-[13px]">
            <div>{confirmText}</div>
            <div className="font-bold text-[#1f4e8f] text-[16px] tracking-tight">
              Meta<span className="text-[#3d5d8f]">M</span>
            </div>
          </div>
          <div className="text-center font-bold text-[15px] mt-4">{issuer}</div>
        </div>

        <DialogFooter className="print:hidden">
          <Button variant="outline" onClick={() => onOpenChange(false)}>닫기</Button>
          <Button onClick={handlePrint} className="gap-1">
            <FileDown className="h-4 w-4" /> 인쇄 / PDF 저장
          </Button>
        </DialogFooter>
      </DialogContent>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #roster-print-area, #roster-print-area * { visibility: visible !important; }
          #roster-print-area {
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
            padding: 16mm !important;
            background: white !important;
          }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>
    </Dialog>
  );
};

export default CompletionRosterPrint;