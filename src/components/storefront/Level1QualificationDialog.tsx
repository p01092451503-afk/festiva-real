import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * 팝업-1 — 1급 수강 자격 확인 (명세서 3.11)
 * 1급 과정 수강 신청 전 자격 요건 동의 절차. 체크박스 미선택 시 진행 불가.
 */
export default function Level1QualificationDialog({ open, onOpenChange, onConfirm }: Props) {
  const [agreed, setAgreed] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setAgreed(false);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">1급 수강 자격 확인</DialogTitle>
          <DialogDescription className="text-base">수강 신청 전 아래 자격 요건을 반드시 확인해 주세요</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border-2 border-brand-orange/40 bg-brand-orange/10 p-4 space-y-1.5">
          <p className="flex items-center gap-2 font-semibold text-brand-orange">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            자격 미달 시 자격증이 취소됩니다
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            1급 지원 시 경력증명서를 확인합니다. 허위 서류 제출 시 자격증 즉시 취소 및 환불 불가입니다.
          </p>
        </div>

        <div className="space-y-3">
          <p className="font-semibold">다음 조건을 충족하십니까?</p>
          <div className="rounded-md bg-brand-blue-light p-4 space-y-2">
            <p className="leading-relaxed">관련 분야 현장 경력 3년 이상이며 경력증명서를 제출할 수 있습니다.</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              관련 분야: 지자체·공공기관 축제·행사 담당, 문화재단·관광재단 실무, 행사기획사, 축제 전문 업체 근무 등
            </p>
          </div>
          <p className="text-sm font-medium text-destructive">위 조건 미충족 시 1급 자격증 발급이 취소됩니다.</p>
        </div>

        <label className="flex items-start gap-3 rounded-md border border-border p-4 cursor-pointer">
          <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
          <span className="text-sm leading-relaxed">위 내용을 확인했으며, 자격 미달 시 자격증이 취소됨에 동의합니다.</span>
        </label>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button
            disabled={!agreed}
            onClick={() => {
              setAgreed(false);
              onOpenChange(false);
              onConfirm();
            }}
          >
            확인했습니다 — 1급 수강 신청하기
          </Button>
        </DialogFooter>
      </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
