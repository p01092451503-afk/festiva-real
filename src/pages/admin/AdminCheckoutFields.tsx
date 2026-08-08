import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plus, Trash2, FileSpreadsheet, Pencil } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

const FIELD_TYPES: Record<string, string> = {
  text: "한 줄 입력",
  textarea: "여러 줄 입력",
  tel: "전화번호",
  email: "이메일",
  select: "선택 목록",
  checkbox: "동의 체크",
};

const emptyForm = {
  id: "",
  course_id: "all",
  label: "",
  field_type: "text",
  options: "",
  is_required: false,
  order_index: 0,
  is_active: true,
};

const fmtDT = (v?: string | null) => (v ? new Date(v).toLocaleString("ko-KR") : "-");

/** 결제 시 추가정보 수집 폼: 항목 정의 + 수집된 응답 조회·엑셀 내보내기 */
const AdminCheckoutFields = () => {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");

  const { data: courses = [] } = useQuery({
    queryKey: ["cf-courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, title").order("title");
      return data || [];
    },
  });

  const { data: fields = [] } = useQuery({
    queryKey: ["checkout-fields"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_custom_fields")
        .select("*")
        .order("order_index");
      if (error) throw error;
      return data;
    },
  });

  const { data: values = [] } = useQuery({
    queryKey: ["checkout-field-values"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_custom_field_values")
        .select("*, orders(order_number, user_id, status, created_at)")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      const ids = Array.from(new Set((data || []).map((v: any) => v.orders?.user_id).filter(Boolean)));
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("user_id, full_name, email").in("user_id", ids)
        : { data: [] as any[] };
      const pMap = new Map((profiles || []).map((p) => [p.user_id, p]));
      return (data || []).map((v: any) => ({
        ...v,
        userName: pMap.get(v.orders?.user_id)?.full_name || "-",
        userEmail: pMap.get(v.orders?.user_id)?.email || "-",
      }));
    },
  });

  const courseTitle = (id: string | null) =>
    id ? courses.find((c) => c.id === id)?.title || "(삭제된 강의)" : "전체 공통";

  const filteredValues = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return values;
    return values.filter((v: any) =>
      [v.label, v.value, v.userName, v.userEmail, v.orders?.order_number].join(" ").toLowerCase().includes(kw),
    );
  }, [values, keyword]);

  const save = async () => {
    if (!form.label.trim()) {
      toast.error("항목 이름을 입력하세요.");
      return;
    }
    const payload = {
      course_id: form.course_id === "all" ? null : form.course_id,
      label: form.label.trim(),
      field_type: form.field_type,
      options:
        form.field_type === "select"
          ? form.options.split(",").map((o) => o.trim()).filter(Boolean)
          : [],
      is_required: form.is_required,
      order_index: Number(form.order_index) || 0,
      is_active: form.is_active,
    };
    const { error } = form.id
      ? await supabase.from("course_custom_fields").update(payload).eq("id", form.id)
      : await supabase.from("course_custom_fields").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(form.id ? "항목을 수정했습니다." : "항목을 추가했습니다.");
    setOpen(false);
    setForm(emptyForm);
    qc.invalidateQueries({ queryKey: ["checkout-fields"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("course_custom_fields").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("항목을 삭제했습니다.");
    qc.invalidateQueries({ queryKey: ["checkout-fields"] });
  };

  const exportValues = () => {
    if (filteredValues.length === 0) {
      toast.error("내보낼 응답이 없습니다.");
      return;
    }
    const sheet = XLSX.utils.json_to_sheet(
      filteredValues.map((v: any) => ({
        주문번호: v.orders?.order_number || "-",
        주문상태: v.orders?.status || "-",
        구매자: v.userName,
        이메일: v.userEmail,
        강의: courseTitle(v.course_id),
        항목: v.label,
        응답: v.value || "-",
        수집일시: fmtDT(v.created_at),
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "결제추가정보");
    XLSX.writeFile(wb, `결제_추가정보_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("엑셀 파일을 내려받았습니다.");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-semibold sm:text-2xl">
              <ClipboardList className="h-6 w-6" />
              결제 추가정보 수집
            </h1>
            <p className="mt-1 text-muted-foreground">
              결제 화면에서 받을 추가 입력 항목을 만들고, 수집된 응답을 조회·엑셀로 내려받습니다.
            </p>
          </div>
          <Button onClick={() => { setForm(emptyForm); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />항목 추가
          </Button>
        </div>

        <Tabs defaultValue="fields">
          <TabsList>
            <TabsTrigger value="fields">입력 항목</TabsTrigger>
            <TabsTrigger value="values">수집 응답</TabsTrigger>
          </TabsList>

          <TabsContent value="fields" className="pt-4">
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3 font-medium">순서</th>
                    <th className="p-3 font-medium">적용 강의</th>
                    <th className="p-3 font-medium">항목</th>
                    <th className="p-3 font-medium">유형</th>
                    <th className="p-3 font-medium">필수</th>
                    <th className="p-3 font-medium">사용</th>
                    <th className="p-3 font-medium">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">등록된 항목이 없습니다.</td></tr>
                  ) : (
                    fields.map((f: any) => (
                      <tr key={f.id} className="border-b-2 border-border/80 last:border-0">
                        <td className="p-3">{f.order_index}</td>
                        <td className="p-3">{courseTitle(f.course_id)}</td>
                        <td className="p-3 font-medium">{f.label}</td>
                        <td className="p-3">{FIELD_TYPES[f.field_type] || f.field_type}</td>
                        <td className="p-3">{f.is_required ? <Badge variant="outline">필수</Badge> : "-"}</td>
                        <td className="p-3">{f.is_active ? <Badge variant="secondary">사용중</Badge> : "미사용"}</td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() =>
                                setForm({
                                  id: f.id,
                                  course_id: f.course_id || "all",
                                  label: f.label,
                                  field_type: f.field_type,
                                  options: Array.isArray(f.options) ? f.options.join(", ") : "",
                                  is_required: f.is_required,
                                  order_index: f.order_index,
                                  is_active: f.is_active,
                                }) || setOpen(true)
                              }
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => remove(f.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="values" className="space-y-3 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Input
                className="max-w-xs"
                placeholder="주문번호·이름·응답 검색"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <Button variant="outline" onClick={exportValues}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />엑셀 내보내기
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3 font-medium">수집일시</th>
                    <th className="p-3 font-medium">주문번호</th>
                    <th className="p-3 font-medium">구매자</th>
                    <th className="p-3 font-medium">강의</th>
                    <th className="p-3 font-medium">항목</th>
                    <th className="p-3 font-medium">응답</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredValues.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">수집된 응답이 없습니다.</td></tr>
                  ) : (
                    filteredValues.map((v: any) => (
                      <tr key={v.id} className="border-b-2 border-border/80 last:border-0">
                        <td className="whitespace-nowrap p-3">{fmtDT(v.created_at)}</td>
                        <td className="whitespace-nowrap p-3">{v.orders?.order_number || "-"}</td>
                        <td className="p-3">
                          <div className="font-medium">{v.userName}</div>
                          <div className="text-xs text-muted-foreground">{v.userEmail}</div>
                        </td>
                        <td className="p-3">{courseTitle(v.course_id)}</td>
                        <td className="p-3">{v.label}</td>
                        <td className="p-3">{v.value || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? "항목 수정" : "항목 추가"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>적용 강의</Label>
                <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 공통</SelectItem>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>항목 이름</Label>
                <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="예: 수료증 발급용 한자 이름" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>입력 유형</Label>
                  <Select value={form.field_type} onValueChange={(v) => setForm({ ...form, field_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(FIELD_TYPES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>노출 순서</Label>
                  <Input
                    type="number"
                    value={form.order_index}
                    onChange={(e) => setForm({ ...form, order_index: Number(e.target.value) })}
                  />
                </div>
              </div>
              {form.field_type === "select" && (
                <div>
                  <Label>선택지 (쉼표로 구분)</Label>
                  <Input value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} placeholder="주간반, 야간반, 주말반" />
                </div>
              )}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_required} onCheckedChange={(v) => setForm({ ...form, is_required: v })} />
                  <Label>필수 입력</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  <Label>사용</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
              <Button onClick={save}>저장</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminCheckoutFields;
