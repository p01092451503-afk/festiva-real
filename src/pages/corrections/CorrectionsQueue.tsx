import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PenLine, ChevronRight, Clock, Loader2, CheckCircle2, AlertCircle, FileText, Inbox, Mail, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import EssayAssignmentsManager from "@/components/corrections/EssayAssignmentsManager";

interface Props {
  role: "teacher" | "admin";
}

const STATUS_TABS = [
  { id: "pending", label: "대기", icon: Clock },
  { id: "in_progress", label: "진행 중", icon: Loader2 },
  { id: "completed", label: "완료", icon: CheckCircle2 },
  { id: "returned", label: "반려", icon: AlertCircle },
] as const;

const CorrectionsQueue = ({ role }: Props) => {
  const [section, setSection] = useState<"queue" | "assignments">("queue");
  const [tab, setTab] = useState<string>("pending");
  const basePath = role === "admin" ? "/admin/corrections" : "/teacher/corrections";

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["corrections-queue", role],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("correction_requests")
        .select(
          "id, topic, status, score, submitted_at, completed_at, student_id, assigned_teacher_id, correction_pages(id)",
        )
        .order("submitted_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = data || [];
      const studentIds = Array.from(new Set(rows.map((r: any) => r.student_id).filter(Boolean)));
      let profileMap: Record<string, { full_name?: string; email?: string; avatar_url?: string | null }> = {};
      if (studentIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, avatar_url")
          .in("user_id", studentIds);
        (profs || []).forEach((p: any) => {
          profileMap[p.user_id] = { full_name: p.full_name, email: p.email, avatar_url: p.avatar_url };
        });
      }
      return rows.map((r: any) => ({ ...r, profiles: profileMap[r.student_id] || null }));
    },
  });

  const filtered = useMemo(
    () => requests.filter((r: any) => r.status === tab),
    [requests, tab],
  );

  return (
    <DashboardLayout>
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <header>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <PenLine className="h-6 w-6" /> 첨삭 관리
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            학생에게 에세이 과제를 부여하고, 제출된 답안을 검토·첨삭하세요.
          </p>
        </header>

        <Tabs value={section} onValueChange={(v) => setSection(v as any)}>
          <TabsList className="grid grid-cols-2 w-full sm:w-auto">
            <TabsTrigger value="queue" className="gap-1.5">
              <Inbox className="h-4 w-4" /> 제출함
            </TabsTrigger>
            <TabsTrigger value="assignments" className="gap-1.5">
              <FileText className="h-4 w-4" /> 에세이 과제 부여
            </TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="mt-4 space-y-4">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid grid-cols-4 w-full sm:w-auto">
                {STATUS_TABS.map((s) => {
                  const count = requests.filter((r: any) => r.status === s.id).length;
                  return (
                    <TabsTrigger key={s.id} value={s.id} className="gap-1">
                      {s.label} <span className="text-xs text-muted-foreground">({count})</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              <TabsContent value={tab} className="mt-4">
                <Card>
                  {isLoading ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">불러오는 중…</div>
                  ) : filtered.length === 0 ? (
                    <div className="p-10 text-center text-muted-foreground text-sm">해당 상태의 요청이 없습니다.</div>
                  ) : (
                    <ul className="divide-y-2 divide-border/80">
                      {filtered.map((r: any) => {
                        const name = r.profiles?.full_name || "이름 미등록";
                        const email = r.profiles?.email;
                        const initial = (name || email || "?").trim().charAt(0).toUpperCase();
                        return (
                          <li key={r.id}>
                            <Link
                              to={`${basePath}/${r.id}`}
                              className="flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors"
                            >
                              <Avatar className="h-11 w-11 shrink-0 border border-border/60">
                                {r.profiles?.avatar_url && <AvatarImage src={r.profiles.avatar_url} alt={name} />}
                                <AvatarFallback className="bg-muted text-foreground text-sm font-medium">
                                  {initial}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                                    {name}
                                  </span>
                                  {email && (
                                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                      <Mail className="h-3 w-3" />
                                      {email}
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-foreground mt-1 truncate">{r.topic}</div>
                                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className="text-[10px] py-0 h-5">{r.correction_pages?.length ?? 0}장</Badge>
                                  {r.score != null && <span>· 점수 {r.score}</span>}
                                  <span>· 제출 {new Date(r.submitted_at).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="assignments" className="mt-4">
            <EssayAssignmentsManager role={role} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default CorrectionsQueue;
