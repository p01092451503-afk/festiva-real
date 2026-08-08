import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, PauseCircle, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  enrollment: any;
  course: any;
  userId?: string;
}

const fmt = (v?: string | null) => (v ? new Date(v).toLocaleDateString("ko-KR") : null);

/** 학습자용 수강 연장 신청 / 일시정지(휴강) 신청·해제 액션 */
const CourseAccessActions = ({ enrollment, course, userId }: Props) => {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const extensionOn = !!course?.extension_enabled;
  const suspensionOn = !!course?.suspension_enabled;

  const { data: suspensions = [] } = useQuery({
    queryKey: ["my-suspensions", enrollment.id],
    enabled: !!userId && suspensionOn,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_suspensions")
        .select("id, status, start_at, planned_end_at, days_used")
        .eq("enrollment_id", enrollment.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: extensions = [] } = useQuery({
    queryKey: ["my-extensions", enrollment.id],
    enabled: !!userId && extensionOn,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_extensions")
        .select("id, status, extend_days")
        .eq("enrollment_id", enrollment.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const active = suspensions.find((s) => s.status === "active");
  const usedCount = suspensions.length;
  const pendingExt = extensions.find((e) => e.status === "pending");

  const requestExtension = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("course_extensions").insert({
        enrollment_id: enrollment.id,
        user_id: userId!,
        course_id: course.id,
        extend_days: course.extension_days || 30,
        price: course.extension_price || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("연장 신청이 접수되었습니다. 관리자 승인 후 반영됩니다.");
      qc.invalidateQueries({ queryKey: ["my-extensions", enrollment.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const startSuspension = useMutation({
    mutationFn: async () => {
      if (course.suspension_max_count && usedCount >= course.suspension_max_count) {
        throw new Error(`일시정지는 최대 ${course.suspension_max_count}회까지 가능합니다.`);
      }
      const planned = course.suspension_max_days
        ? new Date(Date.now() + course.suspension_max_days * 86400000).toISOString()
        : null;
      const { error } = await supabase.from("course_suspensions").insert({
        enrollment_id: enrollment.id,
        user_id: userId!,
        course_id: course.id,
        planned_end_at: planned,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("수강이 일시정지되었습니다.");
      qc.invalidateQueries({ queryKey: ["my-suspensions", enrollment.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const endSuspension = useMutation({
    mutationFn: async () => {
      if (!active) return;
      const days = Math.max(1, Math.ceil((Date.now() - new Date(active.start_at).getTime()) / 86400000));
      const { error } = await supabase.from("course_suspensions")
        .update({ status: "ended", end_at: new Date().toISOString(), days_used: days })
        .eq("id", active.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("일시정지가 해제되었습니다.");
      qc.invalidateQueries({ queryKey: ["my-suspensions", enrollment.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!extensionOn && !suspensionOn) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pb-3 -mt-1">
      {enrollment.expires_at && (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <CalendarClock className="h-3.5 w-3.5" /> 수강 종료일 {fmt(enrollment.expires_at)}
        </span>
      )}
      {active && <Badge variant="secondary" className="whitespace-nowrap">일시정지 중</Badge>}

      {extensionOn && (
        pendingExt ? (
          <Badge variant="outline" className="whitespace-nowrap">연장 승인 대기</Badge>
        ) : (
          <Button size="sm" variant="outline" disabled={busy}
            onClick={() => { setBusy(true); requestExtension.mutate(undefined, { onSettled: () => setBusy(false) }); }}>
            수강 연장 신청 ({course.extension_days || 30}일 · {(course.extension_price || 0).toLocaleString()}원)
          </Button>
        )
      )}

      {suspensionOn && (
        active ? (
          <Button size="sm" variant="outline" onClick={() => endSuspension.mutate()}>
            <PlayCircle className="h-4 w-4 mr-1" /> 학습 재개
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => startSuspension.mutate()}>
            <PauseCircle className="h-4 w-4 mr-1" /> 일시정지 신청
            {course.suspension_max_count ? ` (${usedCount}/${course.suspension_max_count})` : ""}
          </Button>
        )
      )}
    </div>
  );
};

export default CourseAccessActions;
