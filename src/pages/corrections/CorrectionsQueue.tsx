import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PenLine, ChevronRight, Clock, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

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
  const { primaryRole } = useUserRole();
  const [tab, setTab] = useState<string>("pending");
  const basePath = role === "admin" ? "/admin/corrections" : "/teacher/corrections";

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["corrections-queue", role],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("correction_requests")
        .select(
          "id, topic, status, score, submitted_at, completed_at, student_id, assigned_teacher_id, correction_pages(id), profiles:student_id(full_name, email)",
        )
        .order("submitted_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
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
            학생이 제출한 답안을 검토하고 첨삭하세요.
          </p>
        </header>

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
                  {filtered.map((r: any) => (
                    <li key={r.id}>
                      <Link
                        to={`${basePath}/${r.id}`}
                        className="flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{r.topic}</div>
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                            <span>{r.profiles?.full_name || r.profiles?.email || "익명"}</span>
                            <span>· {r.correction_pages?.length ?? 0}장</span>
                            {r.score != null && <span>· 점수 {r.score}</span>}
                            <span>· {new Date(r.submitted_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default CorrectionsQueue;
