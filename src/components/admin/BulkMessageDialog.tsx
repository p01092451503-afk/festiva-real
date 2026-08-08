import { useState } from "react";
import { Mail, MessageSquare, Send, Users } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

export interface BulkMessageTarget {
  user_id: string;
  full_name?: string | null;
  email?: string | null;
  phone_number?: string | null;
}

interface BulkMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targets: BulkMessageTarget[];
}

const BulkMessageDialog = ({ open, onOpenChange, targets }: BulkMessageDialogProps) => {
  const [channel, setChannel] = useState<"email" | "alimtalk">("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [templateCode, setTemplateCode] = useState("");

  const emailCount = targets.filter((t) => !!t.email).length;
  const phoneCount = targets.filter((t) => !!t.phone_number).length;

  const sendMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-bulk-message", {
        body: {
          channel,
          subject: channel === "email" ? subject : null,
          body,
          templateCode: channel === "alimtalk" ? templateCode || null : null,
          recipients: targets.map((t) => ({
            userId: t.user_id,
            name: t.full_name || "",
            email: t.email || null,
            phone: t.phone_number || null,
          })),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(
        `발송 요청 완료 — 성공 ${data?.success ?? 0}건 / 실패 ${data?.failed ?? 0}건`,
        { description: data?.note || undefined },
      );
      onOpenChange(false);
      setSubject("");
      setBody("");
    },
    onError: (err: any) => toast.error(err?.message || "발송에 실패했습니다."),
  });

  const canSend =
    body.trim().length > 0 &&
    (channel === "email" ? subject.trim().length > 0 && emailCount > 0 : phoneCount > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" /> 일괄 메시지 발송
          </DialogTitle>
          <DialogDescription>
            선택한 {targets.length}명에게 이메일 또는 카카오 알림톡을 발송합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          이메일 보유 {emailCount}명 · 휴대폰 보유 {phoneCount}명
        </div>

        <Tabs value={channel} onValueChange={(v) => setChannel(v as "email" | "alimtalk")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="email" className="gap-1.5">
              <Mail className="h-3.5 w-3.5" /> 이메일
            </TabsTrigger>
            <TabsTrigger value="alimtalk" className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> 카카오 알림톡
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label>제목</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="메일 제목" />
            </div>
          </TabsContent>

          <TabsContent value="alimtalk" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label>템플릿 코드</Label>
              <Input
                value={templateCode}
                onChange={(e) => setTemplateCode(e.target.value)}
                placeholder="사전 승인된 알림톡 템플릿 코드"
              />
              <p className="text-[11px] text-muted-foreground">
                알림톡은 사전 승인된 템플릿만 발송할 수 있습니다. 템플릿 코드가 없으면 문자(SMS)로 대체 발송됩니다.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-1.5">
          <Label>내용</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={7}
            placeholder={"안녕하세요 {name}님,\n..."}
          />
          <p className="text-[11px] text-muted-foreground">{"{name} 을 입력하면 수신자 이름으로 치환됩니다."}</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={() => sendMutation.mutate()} disabled={!canSend || sendMutation.isPending} className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            {sendMutation.isPending ? "발송 중..." : "발송"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkMessageDialog;
