import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { InstructorEditDialog } from "@/components/admin/InstructorPicker";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, Search, Pencil, BookOpen, User, Mail } from "lucide-react";

interface TeacherRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface InstructorProfileRow {
  user_id: string;
  photo_url: string | null;
  headline: string | null;
  bio: string | null;
  expertise: string[] | null;
  years_experience: number | null;
  website_url: string | null;
  public_email: string | null;
}

export default function AdminInstructors() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // 강사 권한을 가진 사용자 + 프로필
  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ["admin-instructors-teachers"],
    queryFn: async (): Promise<TeacherRow[]> => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["teacher", "admin", "super_admin"]);
      const ids = Array.from(new Set((roles || []).map((r: any) => r.user_id)));
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, avatar_url")
        .in("user_id", ids);
      return ((profs || []) as TeacherRow[]).sort((a, b) =>
        (a.full_name || "").localeCompare(b.full_name || "", "ko")
      );
    },
  });

  // 강사 프로필 (instructor_profiles)
  const { data: profilesMap = {} } = useQuery({
    queryKey: ["admin-instructor-profiles-map"],
    queryFn: async (): Promise<Record<string, InstructorProfileRow>> => {
      const { data } = await (supabase as any)
        .from("instructor_profiles")
        .select("*");
      const map: Record<string, InstructorProfileRow> = {};
      for (const row of (data || []) as InstructorProfileRow[]) {
        map[row.user_id] = row;
      }
      return map;
    },
  });

  // 담당 강의 카운트
  const { data: courseCountMap = {} } = useQuery({
    queryKey: ["admin-instructor-course-counts"],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data } = await supabase
        .from("courses")
        .select("instructor_id")
        .not("instructor_id", "is", null);
      const map: Record<string, number> = {};
      for (const row of (data || []) as any[]) {
        if (row.instructor_id) map[row.instructor_id] = (map[row.instructor_id] || 0) + 1;
      }
      return map;
    },
  });

  // 편집 대상 강사 정보
  const { data: editingBase } = useQuery({
    queryKey: ["admin-instructor-base", editingId],
    enabled: !!editingId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, avatar_url")
        .eq("user_id", editingId!)
        .maybeSingle();
      return data as TeacherRow | null;
    },
  });

  const { data: editingProfile } = useQuery({
    queryKey: ["admin-instructor-profile-edit", editingId],
    enabled: !!editingId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("instructor_profiles")
        .select("*")
        .eq("user_id", editingId)
        .maybeSingle();
      return data as InstructorProfileRow | null;
    },
  });

  const { data: editingCourses = [] } = useQuery({
    queryKey: ["admin-instructor-courses-edit", editingId],
    enabled: !!editingId,
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("id, title, status")
        .eq("instructor_id", editingId!)
        .order("updated_at", { ascending: false });
      return (data || []) as { id: string; title: string; status: string }[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) => {
      const p = profilesMap[t.user_id];
      return (
        (t.full_name || "").toLowerCase().includes(q) ||
        (t.email || "").toLowerCase().includes(q) ||
        (p?.headline || "").toLowerCase().includes(q) ||
        (p?.expertise || []).some((e) => e.toLowerCase().includes(q))
      );
    });
  }, [teachers, profilesMap, search]);

  const totalWithProfile = teachers.filter((t) => !!profilesMap[t.user_id]).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <GraduationCap className="h-6 w-6 text-foreground mt-1 shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">강사 정보 관리</h1>
            <p className="text-sm text-muted-foreground mt-1">
              강사 사진, 약력, 강의 경력, 전문 분야 등을 등록·편집합니다.
            </p>
          </div>
        </div>

        {/* Stats + Search */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">전체 강사</p>
            <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{teachers.length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">프로필 등록</p>
            <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">
              {totalWithProfile}
              <span className="text-sm text-muted-foreground font-normal ml-1">/ {teachers.length}</span>
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">미작성</p>
            <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">
              {teachers.length - totalWithProfile}
            </p>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="이름, 이메일, 전문 분야로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* List */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            {search ? "검색 결과가 없습니다" : "등록된 강사가 없습니다"}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((t) => {
              const p = profilesMap[t.user_id];
              const courseCount = courseCountMap[t.user_id] || 0;
              const hasProfile = !!p;
              return (
                <div
                  key={t.user_id}
                  className="group rounded-2xl border border-border bg-card p-5 flex flex-col gap-4 hover:border-foreground/40 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <Avatar className="h-14 w-14 shrink-0 ring-1 ring-border/50">
                      <AvatarImage src={p?.photo_url || t.avatar_url || undefined} />
                      <AvatarFallback>
                        <User className="h-5 w-5 text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate">
                        {t.full_name || "(이름 없음)"}
                      </p>
                      {p?.headline ? (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {p.headline}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground/70 italic mt-0.5">
                          한 줄 소개 미작성
                        </p>
                      )}
                      {t.email && (
                        <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3 shrink-0" /> {t.email}
                        </p>
                      )}
                    </div>
                  </div>

                  {!!p?.expertise?.length && (
                    <div className="flex flex-wrap gap-1">
                      {p.expertise.slice(0, 4).map((e, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px] rounded-full px-2">
                          {e}
                        </Badge>
                      ))}
                      {p.expertise.length > 4 && (
                        <Badge variant="outline" className="text-[10px] rounded-full px-2">
                          +{p.expertise.length - 4}
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/60">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" /> {courseCount}개 강의
                      </span>
                      {p?.years_experience != null && (
                        <span className="tabular-nums">경력 {p.years_experience}년</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={hasProfile ? "outline" : "default"}
                      className="gap-1.5 h-8"
                      onClick={() => setEditingId(t.user_id)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {hasProfile ? "편집" : "작성"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {editingId && (
          <InstructorEditDialog
            instructorId={editingId}
            baseProfile={editingBase || null}
            existing={editingProfile || null}
            assignedCourses={editingCourses}
            onClose={() => setEditingId(null)}
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: ["admin-instructor-profiles-map"] });
              queryClient.invalidateQueries({ queryKey: ["admin-instructors-teachers"] });
              toast({ title: "강사 정보가 저장되었습니다" });
              setEditingId(null);
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
