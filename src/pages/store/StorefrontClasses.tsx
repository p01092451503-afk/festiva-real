import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import StorefrontHeader from "@/components/StorefrontHeader";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const won = (n: number) => (n > 0 ? `${n.toLocaleString("ko-KR")}원` : "무료");
const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

const StorefrontClasses = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ["offline-classes-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offline_classes")
        .select("*")
        .neq("status", "draft")
        .order("start_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: myEnrollments = [] } = useQuery({
    queryKey: ["my-offline-enrollments", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("offline_class_enrollments")
        .select("id, class_id, status")
        .eq("user_id", user!.id);
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: counts = {} } = useQuery({
    queryKey: ["offline-class-counts", classes.map((c: any) => c.id).join(",")],
    queryFn: async () => {
      const { data } = await supabase.from("offline_class_enrollments").select("class_id");
      const m: Record<string, number> = {};
      (data || []).forEach((r: any) => { m[r.class_id] = (m[r.class_id] || 0) + 1; });
      return m;
    },
    enabled: classes.length > 0,
  });

  const appliedSet = useMemo(
    () => new Set(myEnrollments.filter((e: any) => e.status !== "cancelled").map((e: any) => e.class_id)),
    [myEnrollments]
  );

  const apply = async (cls: any) => {
    if (!user) {
      toast.error("로그인이 필요합니다.");
      navigate("/auth");
      return;
    }
    setBusy(cls.id);
    try {
      const { error } = await supabase.from("offline_class_enrollments").insert({
        class_id: cls.id,
        user_id: user.id,
        status: "applied",
      });
      if (error) throw error;
      toast.success("수강 신청이 접수되었습니다.");
      qc.invalidateQueries({ queryKey: ["my-offline-enrollments"] });
      qc.invalidateQueries({ queryKey: ["offline-class-counts"] });
    } catch (e: any) {
      toast.error(e.message || "신청에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  };

  const applyState = (cls: any) => {
    const now = Date.now();
    if (appliedSet.has(cls.id)) return { disabled: true, label: "신청 완료" };
    if (cls.status === "closed" || cls.status === "ended") return { disabled: true, label: "접수 마감" };
    if (cls.apply_start_at && new Date(cls.apply_start_at).getTime() > now) return { disabled: true, label: "접수 예정" };
    if (cls.apply_end_at && new Date(cls.apply_end_at).getTime() < now) return { disabled: true, label: "접수 마감" };
    if (cls.capacity && (counts[cls.id] || 0) >= cls.capacity) return { disabled: true, label: "정원 마감" };
    return { disabled: false, label: "신청하기" };
  };

  return (
    <div className="min-h-screen bg-background">
      <StorefrontHeader />
      <main className="max-w-5xl mx-auto px-4 py-10">
        <header className="mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <CalendarDays className="h-5 w-5" /> 오프라인 클래스
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            현장에서 진행되는 집합교육·특강에 신청하세요.
          </p>
        </header>

        {isLoading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
        ) : classes.length === 0 ? (
          <div className="py-24 text-center text-sm text-muted-foreground">예정된 클래스가 없습니다.</div>
        ) : (
          <div className="rounded-xl border divide-y">
            {classes.map((cls: any) => {
              const st = applyState(cls);
              return (
                <article key={cls.id} className="p-5 flex flex-wrap items-start justify-between gap-4 min-w-0">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-medium truncate">{cls.title}</h2>
                      {cls.credit_hours > 0 && (
                        <Badge variant="outline" className="whitespace-nowrap">{cls.credit_hours}시간 인정</Badge>
                      )}
                      {appliedSet.has(cls.id) && <Badge className="whitespace-nowrap">신청함</Badge>}
                    </div>
                    {cls.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{cls.description}</p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" /> {fmt(cls.start_at)}
                      </span>
                      {cls.venue && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" /> {cls.venue}
                        </span>
                      )}
                      {cls.capacity && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" /> {(counts[cls.id] || 0)}/{cls.capacity}명
                        </span>
                      )}
                      {cls.instructor_name && <span>강사 {cls.instructor_name}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="font-semibold whitespace-nowrap">{won(cls.price || 0)}</span>
                    <Button size="sm" disabled={st.disabled || busy === cls.id} onClick={() => apply(cls)}>
                      {busy === cls.id ? "처리 중..." : st.label}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default StorefrontClasses;
