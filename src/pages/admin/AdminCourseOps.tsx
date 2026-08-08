import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, PauseCircle, PlayCircle, Check, X } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

const fmt = (v?: string | null) => (v ? new Date(v).toLocaleDateString("ko-KR") : "-");

const AdminCourseOps = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState("extensions");

  const { data: extensions = [] } = useQuery({
    queryKey: ["course-extensions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_extensions")
        .select("*, courses(title), profiles:user_id(full_name, email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: suspensions = [] } = useQuery({
    queryKey: ["course-suspensions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_suspensions")
        .select("*, courses(title), profiles:user_id(full_name, email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const decide = useMutation({
    mutationFn: async ({ row, approve }: { row: any; approve: boolean }) => {
      if (!approve) {
        const { error } = await supabase.from("course_extensions")
          .update({ status: "rejected", processed_at: new Date().toISOString() }).eq("id", row.id);
        if (error) throw error;
        return;
      }
      const { data: enr, error: e0 } = await supabase
        .from("enrollments").select("expires_at").eq("id", row.enrollment_id).maybeSingle();
      if (e0) throw e0;
      const base = enr?.expires_at ? new Date(enr.expires_at) : new Date();
      const newEnd = new Date(Math.max(base.getTime(), Date.now()) + row.extend_days * 86400000);
      const { error: e1 } = await supabase.from("enrollments")
        .update({ expires_at: newEnd.toISOString() }).eq("id", row.enrollment_id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("course_extensions").update({
        status: "approved",
        previous_end_at: enr?.expires_at ?? null,
        new_end_at: newEnd.toISOString(),
        processed_at: new Date().toISOString(),
      }).eq("id", row.id);
      if (e2) throw e2;
    },
    onSuccess: () => { toast.success("처리되었습니다"); qc.invalidateQueries({ queryKey: ["course-extensions"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const endSuspension = useMutation({
    mutationFn: async (row: any) => {
      const start = new Date(row.start_at).getTime();
      const days = Math.max(1, Math.ceil((Date.now() - start) / 86400000));
      const { data: enr } = await supabase.from("enrollments").select("expires_at").eq("id", row.enrollment_id).maybeSingle();
      if (enr?.expires_at) {
        const newEnd = new Date(new Date(enr.expires_at).getTime() + days * 86400000);
        await supabase.from("enrollments").update({ expires_at: newEnd.toISOString() }).eq("id", row.enrollment_id);
      }
      const { error } = await supabase.from("course_suspensions")
        .update({ status: "ended", end_at: new Date().toISOString(), days_used: days }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("일시정지가 해제되었습니다"); qc.invalidateQueries({ queryKey: ["course-suspensions"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 min-w-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <CalendarClock className="h-5 w-5" /> 수강 연장 · 일시정지 관리
          </h1>
          <p className="text-muted-foreground mt-1">학습자의 수강 연장 신청을 승인하고, 일시정지(휴강) 상태를 관리합니다.</p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="extensions">수강 연장</TabsTrigger>
            <TabsTrigger value="suspensions">일시정지</TabsTrigger>
          </TabsList>

          <TabsContent value="extensions" className="pt-4">
            <div className="border rounded-md">
              {extensions.map((r) => (
                <div key={r.id} className="p-4 flex flex-wrap items-center gap-3 border-b-2 border-border/80 last:border-b-0 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{r.profiles?.full_name ?? "-"}</span>
                      <span className="text-sm text-muted-foreground truncate">{r.courses?.title}</span>
                      <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"} className="whitespace-nowrap">
                        {r.status === "approved" ? "승인" : r.status === "rejected" ? "반려" : "대기"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {r.extend_days}일 연장 · {(r.price ?? 0).toLocaleString()}원 · 신청 {fmt(r.created_at)}
                      {r.new_end_at ? ` · 변경 종료일 ${fmt(r.new_end_at)}` : ""}
                    </p>
                  </div>
                  {r.status === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => decide.mutate({ row: r, approve: true })}><Check className="h-4 w-4 mr-1" />승인</Button>
                      <Button size="sm" variant="outline" onClick={() => decide.mutate({ row: r, approve: false })}><X className="h-4 w-4 mr-1" />반려</Button>
                    </div>
                  )}
                </div>
              ))}
              {!extensions.length && <p className="p-6 text-sm text-muted-foreground">연장 신청이 없습니다.</p>}
            </div>
          </TabsContent>

          <TabsContent value="suspensions" className="pt-4">
            <div className="border rounded-md">
              {suspensions.map((r) => (
                <div key={r.id} className="p-4 flex flex-wrap items-center gap-3 border-b-2 border-border/80 last:border-b-0 min-w-0">
                  {r.status === "active" ? <PauseCircle className="h-4 w-4 shrink-0" /> : <PlayCircle className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{r.profiles?.full_name ?? "-"}</span>
                      <span className="text-sm text-muted-foreground truncate">{r.courses?.title}</span>
                      <Badge variant={r.status === "active" ? "secondary" : "outline"} className="whitespace-nowrap">
                        {r.status === "active" ? "정지중" : "해제됨"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {fmt(r.start_at)} ~ {fmt(r.end_at)} {r.days_used ? `· ${r.days_used}일 사용` : ""} {r.reason ? `· ${r.reason}` : ""}
                    </p>
                  </div>
                  {r.status === "active" && (
                    <Button size="sm" variant="outline" onClick={() => endSuspension.mutate(r)}>정지 해제</Button>
                  )}
                </div>
              ))}
              {!suspensions.length && <p className="p-6 text-sm text-muted-foreground">일시정지 이력이 없습니다.</p>}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminCourseOps;
