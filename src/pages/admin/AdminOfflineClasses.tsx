import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Plus, Pencil, Trash2, FileSpreadsheet, Users } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

const CLASS_STATUS: Record<string, string> = {
  draft: "작성중",
  open: "모집중",
  closed: "모집마감",
  finished: "종료",
};
const ENROLL_STATUS: Record<string, string> = {
  applied: "신청",
  approved: "승인",
  canceled: "취소",
};

const emptyForm = {
  id: "",
  title: "",
  description: "",
  instructor_name: "",
  venue: "",
  address: "",
  capacity: 30,
  credit_hours: 0,
  price: 0,
  start_at: "",
  end_at: "",
  apply_start_at: "",
  apply_end_at: "",
  status: "draft",
};

const toLocalInput = (v?: string | null) => (v ? new Date(v).toISOString().slice(0, 16) : "");
const toISO = (v: string) => (v ? new Date(v).toISOString() : null);
const fmtDT = (v?: string | null) => (v ? new Date(v).toLocaleString("ko-KR") : "-");

/** 집합강의·연수(학점) 관리 */
const AdminOfflineClasses = () => {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>("");

  const { data: classes = [] } = useQuery({
    queryKey: ["offline-classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offline_classes")
        .select("*")
        .order("start_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["offline-enrollments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offline_class_enrollments")
        .select("*, offline_classes(title, credit_hours)")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      const ids = Array.from(new Set((data || []).map((e: any) => e.user_id)));
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("user_id, full_name, email, phone_number").in("user_id", ids)
        : { data: [] as any[] };
      const pMap = new Map((profiles || []).map((p) => [p.user_id, p]));
      return (data || []).map((e: any) => ({
        ...e,
        userName: pMap.get(e.user_id)?.full_name || "-",
        userEmail: pMap.get(e.user_id)?.email || "-",
        userPhone: pMap.get(e.user_id)?.phone_number || "-",
      }));
    },
  });

  const countMap = useMemo(() => {
    const m = new Map<string, number>();
    enrollments.forEach((e: any) => {
      if (e.status !== "canceled") m.set(e.class_id, (m.get(e.class_id) || 0) + 1);
    });
    return m;
  }, [enrollments]);

  const filteredEnrollments = useMemo(
    () => (selectedClassId ? enrollments.filter((e: any) => e.class_id === selectedClassId) : enrollments),
    [enrollments, selectedClassId],
  );

  const save = async () => {
    if (!form.title.trim()) return toast.error("강의명을 입력하세요");
    const payload = {
      title: form.title.trim(),
      description: form.description || null,
      instructor_name: form.instructor_name || null,
      venue: form.venue || null,
      address: form.address || null,
      capacity: Number(form.capacity) || 0,
      credit_hours: Number(form.credit_hours) || 0,
      price: Number(form.price) || 0,
      start_at: toISO(form.start_at),
      end_at: toISO(form.end_at),
      apply_start_at: toISO(form.apply_start_at),
      apply_end_at: toISO(form.apply_end_at),
      status: form.status,
    };
    const { error } = form.id
      ? await supabase.from("offline_classes").update(payload).eq("id", form.id)
      : await supabase.from("offline_classes").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("저장되었습니다");
    setOpen(false);
    setForm(emptyForm);
    qc.invalidateQueries({ queryKey: ["offline-classes"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("offline_classes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("삭제되었습니다");
    qc.invalidateQueries({ queryKey: ["offline-classes"] });
  };

  const updateEnrollment = async (id: string, patch: any) => {
    const { error } = await supabase.from("offline_class_enrollments").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["offline-enrollments"] });
  };

  const markAttended = async (e: any, attended: boolean) => {
    const credits = attended ? Number(e.offline_classes?.credit_hours || 0) : 0;
    await updateEnrollment(e.id, { attended, credits_awarded: credits, attended_hours: credits });
  };

  const exportEnrollments = () => {
    const rows = filteredEnrollments.map((e: any) => ({
      강의명: e.offline_classes?.title || "-",
      성명: e.userName,
      이메일: e.userEmail,
      연락처: e.userPhone,
      신청상태: ENROLL_STATUS[e.status] || e.status,
      출석: e.attended ? "출석" : "미출석",
      인정학점: e.credits_awarded,
      수료증: e.certificate_issued ? "발급" : "미발급",
      신청일: fmtDT(e.created_at),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "신청자");
    XLSX.writeFile(wb, `집합강의_신청자_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <CalendarDays className="h-5 w-5" /> 집합강의·연수 관리
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            오프라인 강의 일정과 정원, 신청자 출석 및 학점 인정을 관리합니다.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="classes">강의 개설</TabsTrigger>
            <TabsTrigger value="enrollments">신청·출석·학점</TabsTrigger>
          </TabsList>

          <TabsContent value="classes" className="mt-4 space-y-3">
            <div className="flex justify-end">
              <Button size="sm" className="gap-1.5" onClick={() => { setForm(emptyForm); setOpen(true); }}>
                <Plus className="h-4 w-4" /> 강의 개설
              </Button>
            </div>
            <div className="rounded-xl border divide-y">
              {classes.length === 0 && (
                <p className="p-6 text-sm text-muted-foreground text-center">개설된 집합강의가 없습니다.</p>
              )}
              {classes.map((c: any) => (
                <div key={c.id} className="p-4 flex flex-wrap items-center justify-between gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{c.title}</span>
                      <Badge variant={c.status === "open" ? "default" : "secondary"} className="whitespace-nowrap">
                        {CLASS_STATUS[c.status] || c.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        <Users className="h-3 w-3 inline mr-1" />
                        {countMap.get(c.id) || 0}/{c.capacity}명
                      </span>
                      {c.credit_hours > 0 && (
                        <Badge variant="outline" className="whitespace-nowrap">{c.credit_hours}학점</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {fmtDT(c.start_at)} ~ {fmtDT(c.end_at)}
                      {c.venue ? ` · ${c.venue}` : ""}
                      {c.instructor_name ? ` · ${c.instructor_name}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedClassId(c.id)}
                    >
                      신청자 보기
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setForm({
                          id: c.id,
                          title: c.title,
                          description: c.description || "",
                          instructor_name: c.instructor_name || "",
                          venue: c.venue || "",
                          address: c.address || "",
                          capacity: c.capacity,
                          credit_hours: c.credit_hours,
                          price: c.price,
                          start_at: toLocalInput(c.start_at),
                          end_at: toLocalInput(c.end_at),
                          apply_start_at: toLocalInput(c.apply_start_at),
                          apply_end_at: toLocalInput(c.apply_end_at),
                          status: c.status,
                        });
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(c.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="enrollments" className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Select value={selectedClassId || "all"} onValueChange={(v) => setSelectedClassId(v === "all" ? "" : v)}>
                <SelectTrigger className="w-64"><SelectValue placeholder="강의 선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 강의</SelectItem>
                  {classes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportEnrollments}>
                <FileSpreadsheet className="h-4 w-4" /> 엑셀 다운로드
              </Button>
            </div>
            <div className="rounded-xl border divide-y">
              {filteredEnrollments.length === 0 && (
                <p className="p-6 text-sm text-muted-foreground text-center">신청자가 없습니다.</p>
              )}
              {filteredEnrollments.map((e: any) => (
                <div key={e.id} className="p-4 flex flex-wrap items-center justify-between gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {e.userName} <span className="text-xs text-muted-foreground">{e.userEmail}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {e.offline_classes?.title || "-"} · 신청 {fmtDT(e.created_at)} · 인정학점 {e.credits_awarded}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <label className="flex items-center gap-1.5 text-xs">
                      <Checkbox checked={e.attended} onCheckedChange={(v) => markAttended(e, !!v)} /> 출석
                    </label>
                    <label className="flex items-center gap-1.5 text-xs">
                      <Checkbox
                        checked={e.certificate_issued}
                        onCheckedChange={(v) => updateEnrollment(e.id, { certificate_issued: !!v })}
                      />{" "}
                      수료증
                    </label>
                    <Select value={e.status} onValueChange={(v) => updateEnrollment(e.id, { status: v })}>
                      <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(ENROLL_STATUS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "집합강의 수정" : "집합강의 개설"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>강의명</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>설명</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>강사명</Label>
                <Input value={form.instructor_name} onChange={(e) => setForm({ ...form, instructor_name: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>장소</Label>
                <Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>주소</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>정원</Label>
                <Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} className="mt-1" />
              </div>
              <div>
                <Label>인정 학점</Label>
                <Input type="number" step="0.5" value={form.credit_hours} onChange={(e) => setForm({ ...form, credit_hours: Number(e.target.value) })} className="mt-1" />
              </div>
              <div>
                <Label>수강료</Label>
                <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>시작 일시</Label>
                <Input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>종료 일시</Label>
                <Input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>접수 시작</Label>
                <Input type="datetime-local" value={form.apply_start_at} onChange={(e) => setForm({ ...form, apply_start_at: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>접수 마감</Label>
                <Input type="datetime-local" value={form.apply_end_at} onChange={(e) => setForm({ ...form, apply_end_at: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>상태</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CLASS_STATUS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button onClick={save}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminOfflineClasses;
