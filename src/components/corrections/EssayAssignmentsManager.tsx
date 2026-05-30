import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, FileText, Loader2, Users, Calendar, Trash2, Search, BookOpen, Check, X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";

interface Props { role: "admin" | "teacher"; }

const STATUS_LABEL: Record<string, string> = {
  assigned: "대기",
  submitted: "제출",
  completed: "완료",
};

export default function EssayAssignmentsManager({ role }: Props) {
  const { user } = useUser();
  const { isAdmin } = useUserRole();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [openCreate, setOpenCreate] = useState(false);

  // 강사: 본인 담당 강의만, 관리자: 전체 강의
  const { data: courses = [] } = useQuery({
    queryKey: ["essay-asgn-courses", role, user?.id, isAdmin],
    enabled: !!user?.id,
    queryFn: async () => {
      let q = supabase.from("courses").select("id, title, instructor_id").order("title");
      if (role === "teacher" && !isAdmin) q = q.eq("instructor_id", user!.id);
      const { data } = await q;
      return (data || []) as { id: string; title: string; instructor_id: string | null }[];
    },
  });

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["essay-assignments", role, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("correction_assignments")
        .select(`
          id, title, instructions, course_id, assigned_by, due_at, created_at,
          courses:course_id(title),
          correction_assignment_targets(id, status)
        `)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("correction_assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "삭제되었습니다." });
      qc.invalidateQueries({ queryKey: ["essay-assignments"] });
    },
    onError: (e: any) => toast({ title: e?.message || "삭제 실패", variant: "destructive" }),
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-5 w-5 text-foreground" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold">에세이 과제 부여</h2>
            <p className="text-xs text-muted-foreground">학생에게 글 주제를 부여하면, 학생이 직접 답안 사진을 올려 첨삭 요청합니다.</p>
          </div>
        </div>
        <Button onClick={() => setOpenCreate(true)} className="gap-2" size="sm">
          <Plus className="h-4 w-4" /> 새 과제
        </Button>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground text-sm">불러오는 중…</div>
      ) : assignments.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground">
          아직 부여한 과제가 없습니다. 우측 상단의 "새 과제" 버튼으로 첫 과제를 만들어 보세요.
        </div>
      ) : (
        <ul className="divide-y-2 divide-border/80">
          {assignments.map((a: any) => {
            const targets = a.correction_assignment_targets || [];
            const submitted = targets.filter((t: any) => t.status !== "assigned").length;
            return (
              <li key={a.id} className="p-4 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{a.title}</div>
                  {a.instructions && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">{a.instructions}</div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {a.courses?.title && (
                      <span className="inline-flex items-center gap-1"><BookOpen className="h-3 w-3" /> {a.courses.title}</span>
                    )}
                    <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> 대상 {targets.length}명 · 제출 {submitted}</span>
                    {a.due_at && (
                      <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> 기한 {new Date(a.due_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm("이 과제를 삭제하시겠습니까? (제출된 첨삭 요청은 유지됩니다)"))
                      deleteMutation.mutate(a.id);
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {openCreate && (
        <AssignEssayDialog
          courses={courses}
          role={role}
          onClose={() => setOpenCreate(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["essay-assignments"] });
            setOpenCreate(false);
          }}
        />
      )}
    </Card>
  );
}

/* ------------- 과제 생성 다이얼로그 ------------- */
function AssignEssayDialog({
  courses, role, onClose, onCreated,
}: {
  courses: { id: string; title: string; instructor_id: string | null }[];
  role: "admin" | "teacher";
  onClose: () => void;
  onCreated: () => void;
}) {
  const { user } = useUser();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [courseId, setCourseId] = useState<string>("none");
  const [dueAt, setDueAt] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // 수강생 목록 (강의 선택 시: 해당 강의 수강생 / 미선택 시: 강사가 담당하는 전체 강의 수강생)
  const { data: students = [], isLoading } = useQuery({
    queryKey: ["essay-asgn-students", courseId, role, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      let courseIds: string[] = [];
      if (courseId !== "none") {
        courseIds = [courseId];
      } else if (role === "teacher") {
        courseIds = courses.map((c) => c.id);
      }
      // admin + course=none → 모든 학생을 보여주기 (역할 student)
      let userIds: string[] = [];
      if (courseIds.length > 0) {
        const { data: enr } = await supabase
          .from("enrollments")
          .select("user_id")
          .in("course_id", courseIds);
        userIds = Array.from(new Set((enr || []).map((e: any) => e.user_id)));
      } else {
        const { data: rs } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "student");
        userIds = Array.from(new Set((rs || []).map((r: any) => r.user_id)));
      }
      if (userIds.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, avatar_url")
        .in("user_id", userIds);
      return (profs || []) as { user_id: string; full_name: string | null; email: string | null; avatar_url: string | null }[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      (s.full_name || "").toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q)
    );
  }, [students, search]);

  const toggleAll = () => {
    if (filtered.every((s) => selectedStudents.has(s.user_id))) {
      const next = new Set(selectedStudents);
      filtered.forEach((s) => next.delete(s.user_id));
      setSelectedStudents(next);
    } else {
      const next = new Set(selectedStudents);
      filtered.forEach((s) => next.add(s.user_id));
      setSelectedStudents(next);
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedStudents);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedStudents(next);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return toast({ title: "주제(제목)를 입력하세요", variant: "destructive" });
    if (selectedStudents.size === 0) return toast({ title: "대상 학생을 1명 이상 선택하세요", variant: "destructive" });
    try {
      setSaving(true);
      const { data: created, error } = await supabase
        .from("correction_assignments")
        .insert({
          title: title.trim(),
          instructions: instructions.trim() || null,
          course_id: courseId !== "none" ? courseId : null,
          assigned_by: user!.id,
          due_at: dueAt || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      const rows = Array.from(selectedStudents).map((sid) => ({
        assignment_id: created.id,
        student_id: sid,
        status: "assigned",
      }));
      const { error: tErr } = await supabase.from("correction_assignment_targets").insert(rows);
      if (tErr) throw tErr;

      toast({ title: `${rows.length}명에게 과제가 부여되었습니다.` });
      onCreated();
    } catch (e: any) {
      toast({ title: e?.message || "저장 실패", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const allChecked = filtered.length > 0 && filtered.every((s) => selectedStudents.has(s.user_id));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>새 에세이 과제 부여</DialogTitle>
          <DialogDescription>
            글 주제와 안내, 대상 학생을 선택하세요. 학생은 답안을 사진으로 올려 첨삭 요청을 제출합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2 space-y-1.5">
              <Label>주제 / 제목 <span className="text-destructive">*</span></Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 2024년 노무사 2차 행정쟁송법 사례 약술" />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label>안내문 / 작성 가이드</Label>
              <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3}
                placeholder="작성 분량, 핵심 논점, 참고 자료 등 학생이 알아야 할 내용을 작성하세요." />
            </div>
            <div className="space-y-1.5">
              <Label>관련 강의</Label>
              <Select value={courseId} onValueChange={(v) => { setCourseId(v); setSelectedStudents(new Set()); }}>
                <SelectTrigger><SelectValue placeholder="강의 선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{role === "teacher" ? "내 담당 강의 수강생 전체" : "선택 안 함 (전체 학생)"}</SelectItem>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>제출 기한 (선택)</Label>
              <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>대상 학생 <span className="text-destructive">*</span></Label>
              <span className="text-xs text-muted-foreground">선택: {selectedStudents.size}명</span>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="이름/이메일 검색" className="pl-9 h-9" />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={toggleAll}>
                {allChecked ? "현재 표시 해제" : "현재 표시 전체 선택"}
              </Button>
            </div>
            <ScrollArea className="h-[260px] rounded-md border border-border">
              {isLoading ? (
                <div className="p-6 text-center text-sm text-muted-foreground flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> 학생 목록 불러오는 중…
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">표시할 학생이 없습니다.</div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {filtered.map((s) => {
                    const checked = selectedStudents.has(s.user_id);
                    return (
                      <li key={s.user_id}>
                        <button
                          type="button"
                          onClick={() => toggleOne(s.user_id)}
                          className={`w-full flex items-center gap-3 p-2.5 text-left hover:bg-muted/40 transition ${checked ? "bg-primary/5" : ""}`}
                        >
                          <div className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                            {checked && <Check className="h-3.5 w-3.5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{s.full_name || "(이름없음)"}</div>
                            {s.email && <div className="text-xs text-muted-foreground truncate">{s.email}</div>}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>취소</Button>
          <Button onClick={handleSubmit} disabled={saving || !title.trim() || selectedStudents.size === 0}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {selectedStudents.size}명에게 부여
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
