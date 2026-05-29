import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, RefreshCw, Send, XCircle, Copy } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useFeatureModules } from "@/hooks/useFeatureModules";
import { Navigate } from "react-router-dom";

const STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  sent: "발송됨",
  failed: "실패",
  consumed: "사용 완료",
  expired: "만료",
  revoked: "폐기",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  sent: "default",
  failed: "destructive",
  consumed: "default",
  expired: "outline",
  revoked: "destructive",
};

export default function AdminInvitationLogs() {
  const { isEnabled, isLoading: modulesLoading } = useFeatureModules();
  const qc = useQueryClient();

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["course-invitations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_invitations")
        .select("*, courses:course_id(title)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!modulesLoading && !isEnabled("closed_lms")) return <Navigate to="/admin" replace />;

  const resend = async (id: string) => {
    try {
      const { error } = await supabase.functions.invoke("send-course-invite", { body: { resend_invitation_id: id } });
      if (error) throw error;
      toast.success("재발송 요청 완료");
      qc.invalidateQueries({ queryKey: ["course-invitations"] });
    } catch (e: any) { toast.error(e?.message || "재발송 실패"); }
  };

  const revoke = async (id: string) => {
    if (!confirm("이 초대의 로그인 토큰을 폐기하시겠습니까?")) return;
    const { error: e1 } = await supabase.from("one_time_login_tokens").update({ revoked_at: new Date().toISOString() }).eq("invitation_id", id);
    const { error: e2 } = await supabase.from("course_invitations").update({ status: "revoked" }).eq("id", id);
    if (e1 || e2) return toast.error("폐기 실패");
    toast.success("토큰을 폐기했습니다");
    qc.invalidateQueries({ queryKey: ["course-invitations"] });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 min-w-0">
        <header className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-muted-foreground" />
              <h1 className="text-xl sm:text-2xl font-semibold">초대 발송 현황</h1>
            </div>
            <p className="text-muted-foreground mt-1">최근 발송된 초대 500건을 표시합니다.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
          </Button>
        </header>

        <section className="stat-card !p-0 overflow-hidden">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">불러오는 중…</p>
          ) : rows.length === 0 ? (
            <p className="p-12 text-center text-sm text-muted-foreground">발송 기록이 없습니다.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>발송일</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead>휴대폰</TableHead>
                  <TableHead>강의</TableHead>
                  <TableHead>방식</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>만료일</TableHead>
                  <TableHead className="w-44">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString("ko-KR")}
                    </TableCell>
                    <TableCell>{r.recipient_name}</TableCell>
                    <TableCell className="font-mono text-xs">{r.phone}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{r.courses?.title ?? "—"}</TableCell>
                    <TableCell className="text-xs">
                      {r.delivery_method === "magic_link" ? "링크" : r.delivery_method === "credentials" ? "ID/PW" : "둘 다"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{new Date(r.expires_at).toLocaleDateString("ko-KR")}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => resend(r.id)} title="재발송">
                          <Send className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => {
                          navigator.clipboard.writeText(r.message_body ?? "");
                          toast.success("메시지 복사됨");
                        }} title="메시지 복사">
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => revoke(r.id)} title="폐기">
                          <XCircle className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}