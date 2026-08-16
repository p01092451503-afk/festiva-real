import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SlidersHorizontal, Search, Save, ListOrdered, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

const PRICE_DISPLAY = [
  { value: "normal", label: "정가 + 수강료" },
  { value: "free", label: "무료 표기" },
  { value: "monthly", label: "월 가격 표기" },
];

const USE_STATUS = [
  { value: "active", label: "사용" },
  { value: "paused", label: "운영중지" },
  { value: "closed", label: "종료" },
];

const VISIBILITY = [
  { value: "public", label: "노출" },
  { value: "hidden", label: "숨김" },
];

type CourseOptionForm = {
  use_status: string;
  visibility: string;
  sale_status: string;
  price_display_type: string;
  monthly_price: number | null;
  free_price_label: string;
  promo_label_text: string;
  promo_label_color: string;
  event_text: string;
  vat_exempt: boolean;
  extension_enabled: boolean;
  extension_price: number;
  extension_days: number;
  suspension_enabled: boolean;
  suspension_max_count: number;
  suspension_max_days: number;
};

const AdminCourseOptions = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<CourseOptionForm | null>(null);
  const [curriculumId, setCurriculumId] = useState<string | null>(null);
  const [addLectureId, setAddLectureId] = useState<string>("");

  const { data: courses = [] } = useQuery({
    queryKey: ["course-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, status, visibility, sale_status, use_status, price, sale_price, monthly_price, price_display_type, free_price_label, promo_label_text, promo_label_color, event_text, vat_exempt, extension_enabled, extension_price, extension_days, suspension_enabled, suspension_max_count, suspension_max_days")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: lectures = [] } = useQuery({
    queryKey: ["lectures-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lectures").select("id, title").eq("is_active", true).order("title");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: curriculum = [], refetch: refetchCurriculum } = useQuery({
    queryKey: ["course-curriculum", curriculumId],
    enabled: !!curriculumId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_lectures")
        .select("id, order_index, credit_time_override, is_required, lecture_id, lectures(title, credit_time_seconds)")
        .eq("course_id", curriculumId!)
        .order("order_index");
      if (error) throw error;
      return data as any[];
    },
  });

  const selected = useMemo(() => courses.find((c) => c.id === selectedId) ?? null, [courses, selectedId]);

  useEffect(() => {
    if (!selected) { setForm(null); return; }
    setForm({
      use_status: selected.use_status ?? "active",
      visibility: selected.visibility ?? "public",
      sale_status: selected.sale_status ?? "on_sale",
      price_display_type: selected.price_display_type ?? "normal",
      monthly_price: selected.monthly_price ?? null,
      free_price_label: selected.free_price_label ?? "",
      promo_label_text: selected.promo_label_text ?? "",
      promo_label_color: selected.promo_label_color ?? "#1f2937",
      event_text: selected.event_text ?? "",
      vat_exempt: !!selected.vat_exempt,
      extension_enabled: !!selected.extension_enabled,
      extension_price: selected.extension_price ?? 0,
      extension_days: selected.extension_days ?? 0,
      suspension_enabled: !!selected.suspension_enabled,
      suspension_max_count: selected.suspension_max_count ?? 0,
      suspension_max_days: selected.suspension_max_days ?? 0,
    });
  }, [selected]);

  const save = useMutation({
    mutationFn: async () => {
      if (!selectedId || !form) return;
      const { error } = await supabase.from("courses").update({
        ...form,
        monthly_price: form.monthly_price === null || Number.isNaN(form.monthly_price) ? null : Number(form.monthly_price),
        free_price_label: form.free_price_label || null,
        promo_label_text: form.promo_label_text || null,
        promo_label_color: form.promo_label_color || null,
        event_text: form.event_text || null,
      }).eq("id", selectedId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("저장되었습니다"); qc.invalidateQueries({ queryKey: ["course-options"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const addLecture = useMutation({
    mutationFn: async () => {
      if (!curriculumId || !addLectureId) return;
      const { error } = await supabase.from("course_lectures").insert({
        course_id: curriculumId, lecture_id: addLectureId, order_index: curriculum.length,
      });
      if (error) throw error;
    },
    onSuccess: () => { setAddLectureId(""); refetchCurriculum(); toast.success("차시가 추가되었습니다"); },
    onError: (e: any) => toast.error(e.message.includes("duplicate") ? "이미 추가된 강의입니다" : e.message),
  });

  const removeLecture = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("course_lectures").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { refetchCurriculum(); },
    onError: (e: any) => toast.error(e.message),
  });

  const moveLecture = useMutation({
    mutationFn: async ({ index, dir }: { index: number; dir: -1 | 1 }) => {
      const target = index + dir;
      if (target < 0 || target >= curriculum.length) return;
      const a = curriculum[index], b = curriculum[target];
      const { error: e1 } = await supabase.from("course_lectures").update({ order_index: b.order_index }).eq("id", a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("course_lectures").update({ order_index: a.order_index }).eq("id", b.id);
      if (e2) throw e2;
    },
    onSuccess: () => refetchCurriculum(),
    onError: (e: any) => toast.error(e.message),
  });

  const q = search.trim().toLowerCase();
  const filtered = courses.filter((c) => !q || c.title?.toLowerCase().includes(q));

  return (
    <DashboardLayout>
      <div className="space-y-6 min-w-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5" /> 강의 판매·운영 옵션
          </h1>
          <p className="text-muted-foreground mt-1">
            판매 / 노출 / 사용 상태를 독립적으로 제어하고, 수강료 표기 방식·홍보 라벨·수강 연장·일시정지 정책을 설정합니다.
          </p>
        </div>

        <div className="grid lg:grid-cols-[320px_1fr] gap-6 min-w-0">
          <div className="space-y-3 min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="강의명 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="border rounded-md max-h-[70vh] overflow-y-auto">
              {filtered.map((c) => (
                <button key={c.id} onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left p-3 border-b-2 border-border/80 last:border-b-0 hover:bg-muted/50 ${selectedId === c.id ? "bg-muted" : ""}`}>
                  <div className="font-medium truncate">{c.title}</div>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    <Badge variant="outline" className="whitespace-nowrap text-[10px]">{USE_STATUS.find((u) => u.value === (c.use_status ?? "active"))?.label}</Badge>
                    <Badge variant="secondary" className="whitespace-nowrap text-[10px]">{c.visibility === "hidden" ? "숨김" : "노출"}</Badge>
                    <Badge variant="outline" className="whitespace-nowrap text-[10px]">{c.sale_status ?? "on_sale"}</Badge>
                  </div>
                </button>
              ))}
              {!filtered.length && <p className="p-6 text-sm text-muted-foreground">강의가 없습니다.</p>}
            </div>
          </div>

          <div className="min-w-0">
            {!form || !selected ? (
              <div className="border rounded-md p-10 text-center text-muted-foreground">왼쪽에서 강의를 선택하세요.</div>
            ) : (
              <Tabs defaultValue="status">
                <TabsList>
                  <TabsTrigger value="status">상태·표기</TabsTrigger>
                  <TabsTrigger value="policy">연장·일시정지</TabsTrigger>
                  <TabsTrigger value="curriculum">차시 구성</TabsTrigger>
                </TabsList>

                <TabsContent value="status" className="space-y-4 pt-4">
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div>
                      <Label>사용 상태</Label>
                      <Select value={form.use_status} onValueChange={(v) => setForm({ ...form, use_status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{USE_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>노출 상태</Label>
                      <Select value={form.visibility} onValueChange={(v) => setForm({ ...form, visibility: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{VISIBILITY.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>판매 상태</Label>
                      <Select value={form.sale_status} onValueChange={(v) => setForm({ ...form, sale_status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open_alert">오픈알림</SelectItem>
                          <SelectItem value="presale">사전신청</SelectItem>
                          <SelectItem value="on_sale">신청하기</SelectItem>
                          <SelectItem value="closed">신청마감</SelectItem>
                          <SelectItem value="sold_out">품절</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3">
                    <div>
                      <Label>수강료 노출 타입</Label>
                      <Select value={form.price_display_type} onValueChange={(v) => setForm({ ...form, price_display_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{PRICE_DISPLAY.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {form.price_display_type === "monthly" && (
                      <div><Label>월 가격(원)</Label><Input type="number" value={form.monthly_price ?? 0} onChange={(e) => setForm({ ...form, monthly_price: Number(e.target.value) })} /></div>
                    )}
                    {form.price_display_type === "free" && (
                      <div><Label>무료 표기 문구</Label><Input placeholder="무료" value={form.free_price_label} onChange={(e) => setForm({ ...form, free_price_label: e.target.value })} /></div>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3">
                    <div><Label>홍보 라벨</Label><Input placeholder="BEST / 신규개설" value={form.promo_label_text} onChange={(e) => setForm({ ...form, promo_label_text: e.target.value })} /></div>
                    <div><Label>라벨 색상</Label><Input type="color" value={form.promo_label_color || "#1f2937"} onChange={(e) => setForm({ ...form, promo_label_color: e.target.value })} /></div>
                    <div><Label>이벤트 문구</Label><Input placeholder="강의명 상단 노출" value={form.event_text} onChange={(e) => setForm({ ...form, event_text: e.target.value })} /></div>
                  </div>

                  <div className="flex items-center justify-between border rounded-md p-3">
                    <div><Label>부가세 면제</Label><p className="text-sm text-muted-foreground">영수증 표기에 반영됩니다.</p></div>
                    <Switch checked={form.vat_exempt} onCheckedChange={(v) => setForm({ ...form, vat_exempt: v })} />
                  </div>

                  <Button onClick={() => save.mutate()}><Save className="h-4 w-4 mr-1" /> 저장</Button>
                </TabsContent>

                <TabsContent value="policy" className="space-y-4 pt-4">
                  <div className="flex items-center justify-between border rounded-md p-3">
                    <div><Label>수강 연장 사용</Label><p className="text-sm text-muted-foreground">상시 강의에서 학습자가 기간을 연장할 수 있습니다.</p></div>
                    <Switch checked={form.extension_enabled} onCheckedChange={(v) => setForm({ ...form, extension_enabled: v })} />
                  </div>
                  {form.extension_enabled && (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div><Label>연장 비용(원)</Label><Input type="number" value={form.extension_price} onChange={(e) => setForm({ ...form, extension_price: Number(e.target.value) })} /></div>
                      <div><Label>연장 일수</Label><Input type="number" value={form.extension_days} onChange={(e) => setForm({ ...form, extension_days: Number(e.target.value) })} /></div>
                    </div>
                  )}
                  <div className="flex items-center justify-between border rounded-md p-3">
                    <div><Label>일시정지(휴강) 사용</Label><p className="text-sm text-muted-foreground">정지 기간에는 학습독려 발송이 중지됩니다.</p></div>
                    <Switch checked={form.suspension_enabled} onCheckedChange={(v) => setForm({ ...form, suspension_enabled: v })} />
                  </div>
                  {form.suspension_enabled && (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div><Label>최대 횟수</Label><Input type="number" value={form.suspension_max_count} onChange={(e) => setForm({ ...form, suspension_max_count: Number(e.target.value) })} /></div>
                      <div><Label>최대 기간(일)</Label><Input type="number" value={form.suspension_max_days} onChange={(e) => setForm({ ...form, suspension_max_days: Number(e.target.value) })} /></div>
                    </div>
                  )}
                  <Button onClick={() => save.mutate()}><Save className="h-4 w-4 mr-1" /> 저장</Button>
                </TabsContent>

                <TabsContent value="curriculum" className="space-y-4 pt-4">
                  <Button variant="outline" onClick={() => setCurriculumId(selected.id)}>
                    <ListOrdered className="h-4 w-4 mr-1" /> 차시 구성 열기
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    콘텐츠 라이브러리의 강의(차시)를 이 강의에 연결합니다. 하나의 차시를 여러 강의에서 재사용할 수 있습니다.
                  </p>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </div>

      <Dialog open={!!curriculumId} onOpenChange={(o) => !o && setCurriculumId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>차시 구성</DialogTitle>
            <DialogDescription>{selected?.title}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Select value={addLectureId} onValueChange={setAddLectureId}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="추가할 강의 선택" /></SelectTrigger>
              <SelectContent>{lectures.map((l) => <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={() => addLecture.mutate()} disabled={!addLectureId}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="border rounded-md max-h-[50vh] overflow-y-auto">
            {curriculum.map((row, i) => (
              <div key={row.id} className="p-3 flex items-center gap-2 border-b-2 border-border/80 last:border-b-0 min-w-0">
                <span className="text-sm text-muted-foreground w-8 shrink-0">{i + 1}차시</span>
                <div className="flex-1 min-w-0">
                  <div className="truncate">{row.lectures?.title}</div>
                  <p className="text-xs text-muted-foreground">인정 {Math.round((row.credit_time_override ?? row.lectures?.credit_time_seconds ?? 0) / 60)}분</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => moveLecture.mutate({ index: i, dir: -1 })}><ArrowUp className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => moveLecture.mutate({ index: i, dir: 1 })}><ArrowDown className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => removeLecture.mutate(row.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {!curriculum.length && <p className="p-6 text-sm text-muted-foreground">연결된 차시가 없습니다.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCurriculumId(null)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminCourseOptions;
