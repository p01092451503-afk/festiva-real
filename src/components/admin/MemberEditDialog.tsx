import { useState } from "react";
import { KeyRound, UserCog } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MEMBER_STATUS_ORDER, memberStatusLabel } from "@/lib/statusMeta";

export type MemberRole = "admin" | "teacher" | "student";

export interface MemberEditDraft {
  userId: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  birthDate: string;
  gender: string;
  memberStatus: string;
  gradeId: string;
  marketingEmail: boolean;
  marketingSms: boolean;
  marketingKakao: boolean;
  adminMemo: string;
  role: MemberRole;
  roleLocked: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: MemberEditDraft | null;
  onDraftChange: (draft: MemberEditDraft) => void;
  grades?: { id: string; name: string }[];
  saving?: boolean;
  onSave: () => void;
  teacherRoleEnabled?: boolean;
  resetting?: boolean;
  onResetPassword: (newPassword: string) => void;
  canResetPassword?: boolean;
}

const MemberEditDialog = ({
  open,
  onOpenChange,
  draft,
  onDraftChange,
  grades = [],
  saving,
  onSave,
  teacherRoleEnabled = true,
  resetting,
  onResetPassword,
  canResetPassword = true,
}: Props) => {
  const [pw, setPw] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState("");

  if (!draft) return null;
  const set = (patch: Partial<MemberEditDraft>) => onDraftChange({ ...draft, ...patch });

  const submitReset = () => {
    if (pw.length < 8) return setPwError("비밀번호는 8자 이상 입력해 주세요.");
    if (pw !== pwConfirm) return setPwError("비밀번호가 일치하지 않습니다.");
    setPwError("");
    onResetPassword(pw);
    setPw("");
    setPwConfirm("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setPw(""); setPwConfirm(""); setPwError(""); } onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" /> 회원 정보 수정
          </DialogTitle>
          <DialogDescription>{draft.email || draft.fullName}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="info">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="info">기본 정보</TabsTrigger>
            <TabsTrigger value="account">계정·권한</TabsTrigger>
            <TabsTrigger value="marketing">수신 동의</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 pt-4">
            <div>
              <Label>이름</Label>
              <Input className="mt-1" value={draft.fullName} onChange={(e) => set({ fullName: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>휴대폰 번호</Label>
                <Input className="mt-1" value={draft.phoneNumber} placeholder="010-0000-0000" onChange={(e) => set({ phoneNumber: e.target.value })} />
              </div>
              <div>
                <Label>생년월일</Label>
                <Input className="mt-1" type="date" value={draft.birthDate} onChange={(e) => set({ birthDate: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>성별</Label>
                <Select value={draft.gender || "unknown"} onValueChange={(v) => set({ gender: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">미입력</SelectItem>
                    <SelectItem value="male">남성</SelectItem>
                    <SelectItem value="female">여성</SelectItem>
                    <SelectItem value="other">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>회원 등급</Label>
                <Select value={draft.gradeId || "__none__"} onValueChange={(v) => set({ gradeId: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="등급 선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">등급 없음</SelectItem>
                    {grades.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>관리자 메모</Label>
              <Textarea className="mt-1" rows={3} value={draft.adminMemo} onChange={(e) => set({ adminMemo: e.target.value })} placeholder="상담 이력, 특이사항 등" />
            </div>
          </TabsContent>

          <TabsContent value="account" className="space-y-4 pt-4">
            <div>
              <Label>회원 상태</Label>
              <Select value={draft.memberStatus || "active"} onValueChange={(v) => set({ memberStatus: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEMBER_STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>{memberStatusLabel(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">정지·탈퇴 상태의 회원은 로그인 및 구매가 제한됩니다.</p>
            </div>
            <div>
              <Label>역할</Label>
              <Select value={draft.role} onValueChange={(v) => set({ role: v as MemberRole })} disabled={draft.roleLocked}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">학습자</SelectItem>
                  {teacherRoleEnabled && <SelectItem value="teacher">강사</SelectItem>}
                  <SelectItem value="admin">관리자</SelectItem>
                </SelectContent>
              </Select>
              {draft.roleLocked && (
                <p className="text-xs text-muted-foreground mt-1">본인 계정 또는 최고관리자의 역할은 변경할 수 없습니다.</p>
              )}
            </div>

            <div className="rounded-xl border border-border p-3 space-y-3">
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                <KeyRound className="h-4 w-4" /> 비밀번호 초기화
              </p>
              {canResetPassword ? (
                <>
                  <Input type="password" autoComplete="new-password" placeholder="새 비밀번호 (8자 이상)" value={pw} onChange={(e) => setPw(e.target.value)} />
                  <Input type="password" autoComplete="new-password" placeholder="새 비밀번호 확인" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} />
                  {pwError && <p className="text-xs text-destructive">{pwError}</p>}
                  <Button variant="outline" className="w-full rounded-xl" onClick={submitReset} disabled={!pw || !pwConfirm || resetting}>
                    {resetting ? "처리 중…" : "비밀번호 초기화"}
                  </Button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">이 계정의 비밀번호는 초기화할 수 없습니다.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="marketing" className="space-y-3 pt-4">
            <p className="text-xs text-muted-foreground">회원이 동의한 마케팅 수신 채널입니다. 관리자가 직접 수정할 경우 동의 근거를 반드시 보관하세요.</p>
            {([
              ["marketingEmail", "이메일 수신 동의"],
              ["marketingSms", "SMS·알림톡 수신 동의"],
              ["marketingKakao", "카카오 채널 수신 동의"],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 border-b-2 border-border/80 py-3 cursor-pointer">
                <Checkbox checked={!!draft[key]} onCheckedChange={(v) => set({ [key]: v === true } as any)} />
                <span className="text-sm text-foreground">{label}</span>
              </label>
            ))}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "저장 중…" : "저장"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MemberEditDialog;
