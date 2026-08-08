import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, BookOpen, Bell, Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  SALE_STATUS_ORDER, SALE_STATUS_META, saleStatusClass, saleStatusLabel, type SaleStatus,
} from "@/lib/statusMeta";

type ScheduleFields = {
  open_scheduled_at: string | null;
  apply_start_at: string | null;
  apply_end_at: string | null;
  operation_start_at: string | null;
};

const toLocalInput = (v?: string | null) => (v ? new Date(v).toISOString().slice(0, 16) : "");
const toIso = (v: string) => (v ? new Date(v).toISOString() : null);

const emptyProduct = {
  id: "",
  name: "",
  description: "",
  price: 0,
  sale_price: null as number | null,
  stock_quantity: null as number | null,
  sale_status: "on_sale" as SaleStatus,
  linked_course_id: null as string | null,
  is_active: true,
  open_scheduled_at: "",
  apply_start_at: "",
  apply_end_at: "",
  operation_start_at: "",
};

const AdminSaleStatus = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [productDialog, setProductDialog] = useState(false);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [courseEditId, setCourseEditId] = useState<string | null>(null);
  const [courseForm, setCourseForm] = useState<{ sale_status: SaleStatus } & Record<string, string>>({
    sale_status: "on_sale",
    open_scheduled_at: "",
    apply_start_at: "",
    apply_end_at: "",
    operation_start_at: "",
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["sale-status-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, status, sale_status, open_scheduled_at, apply_start_at, apply_end_at, operation_start_at")
        .neq("status", "archived")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["sale-status-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_products")
        .select("*")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["sale-status-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_open_alerts")
        .select("id, course_id, product_id, created_at");
      if (error) throw error;
      return data;
    },
  });

  const alertCount = useMemo(() => {
    const map = new Map<string, number>();
    alerts.forEach((a: any) => {
      const key = a.course_id || a.product_id;
      if (!key) return;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [alerts]);

  const saveCourse = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("courses")
        .update({
          sale_status: courseForm.sale_status,
          open_scheduled_at: toIso(courseForm.open_scheduled_at),
          apply_start_at: toIso(courseForm.apply_start_at),
          apply_end_at: toIso(courseForm.apply_end_at),
          operation_start_at: toIso(courseForm.operation_start_at),
        } as any)
        .eq("id", courseEditId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("강의 판매 상태가 저장되었습니다");
      setCourseEditId(null);
      queryClient.invalidateQueries({ queryKey: ["sale-status-courses"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveProduct = useMutation({
    mutationFn: async () => {
      const payload = {
        name: productForm.name,
        description: productForm.description || null,
        price: Number(productForm.price) || 0,
        sale_price: productForm.sale_price != null && String(productForm.sale_price) !== "" ? Number(productForm.sale_price) : null,
        stock_quantity: productForm.stock_quantity != null && String(productForm.stock_quantity) !== "" ? Number(productForm.stock_quantity) : null,
        sale_status: productForm.sale_status,
        linked_course_id: productForm.linked_course_id || null,
        is_active: productForm.is_active,
        open_scheduled_at: toIso(productForm.open_scheduled_at),
        apply_start_at: toIso(productForm.apply_start_at),
        apply_end_at: toIso(productForm.apply_end_at),
        operation_start_at: toIso(productForm.operation_start_at),
      };
      if (productForm.id) {
        const { error } = await supabase.from("store_products").update(payload as any).eq("id", productForm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("store_products").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("교보재 정보가 저장되었습니다");
      setProductDialog(false);
      queryClient.invalidateQueries({ queryKey: ["sale-status-products"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("store_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("삭제되었습니다");
      queryClient.invalidateQueries({ queryKey: ["sale-status-products"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const quickStatus = useMutation({
    mutationFn: async ({ kind, id, status }: { kind: "course" | "product"; id: string; status: SaleStatus }) => {
      const table = kind === "course" ? "courses" : "store_products";
      const { error } = await supabase.from(table as any).update({ sale_status: status } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("판매 상태가 변경되었습니다");
      queryClient.invalidateQueries({ queryKey: ["sale-status-courses"] });
      queryClient.invalidateQueries({ queryKey: ["sale-status-products"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const q = search.trim().toLowerCase();
  const filteredCourses = courses.filter((c: any) => !q || c.title?.toLowerCase().includes(q));
  const filteredProducts = products.filter((p: any) => !q || p.name?.toLowerCase().includes(q));

  const openCourseEdit = (c: any) => {
    setCourseEditId(c.id);
    setCourseForm({
      sale_status: (c.sale_status || "on_sale") as SaleStatus,
      open_scheduled_at: toLocalInput(c.open_scheduled_at),
      apply_start_at: toLocalInput(c.apply_start_at),
      apply_end_at: toLocalInput(c.apply_end_at),
      operation_start_at: toLocalInput(c.operation_start_at),
    });
  };

  const openProductEdit = (p?: any) => {
    setProductForm(
      p
        ? {
            id: p.id,
            name: p.name || "",
            description: p.description || "",
            price: p.price || 0,
            sale_price: p.sale_price,
            stock_quantity: p.stock_quantity,
            sale_status: (p.sale_status || "on_sale") as SaleStatus,
            linked_course_id: p.linked_course_id,
            is_active: p.is_active,
            open_scheduled_at: toLocalInput(p.open_scheduled_at),
            apply_start_at: toLocalInput(p.apply_start_at),
            apply_end_at: toLocalInput(p.apply_end_at),
            operation_start_at: toLocalInput(p.operation_start_at),
          }
        : emptyProduct,
    );
    setProductDialog(true);
  };

  const StatusSelect = ({ value, onChange }: { value: string; onChange: (v: SaleStatus) => void }) => (
    <Select value={value} onValueChange={(v) => onChange(v as SaleStatus)}>
      <SelectTrigger className="h-8 w-32 rounded-lg text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SALE_STATUS_ORDER.map((s) => (
          <SelectItem key={s} value={s} className="text-xs">
            {SALE_STATUS_META[s].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const ScheduleInputs = ({
    form,
    setField,
  }: {
    form: Record<string, string>;
    setField: (k: string, v: string) => void;
  }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {[
        ["open_scheduled_at", "오픈 예정일"],
        ["apply_start_at", "신청 시작일"],
        ["apply_end_at", "신청 마감일"],
        ["operation_start_at", "운영 시작일"],
      ].map(([key, label]) => (
        <div key={key} className="space-y-1.5">
          <Label className="text-xs">{label}</Label>
          <Input
            type="datetime-local"
            value={form[key] || ""}
            onChange={(e) => setField(key, e.target.value)}
          />
        </div>
      ))}
    </div>
  );

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2">
            <Package className="h-6 w-6" aria-hidden="true" />
            상품 판매 상태 관리
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            강의와 교보재의 5단계 판매 상태(오픈알림 · 사전신청 · 신청하기 · 신청마감 · 품절)와 일정을 관리합니다.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {SALE_STATUS_ORDER.map((s) => (
            <div key={s} className={`rounded-xl border p-3 ${saleStatusClass(s)}`}>
              <p className="text-xs font-semibold">{SALE_STATUS_META[s].label}</p>
              <p className="text-[11px] mt-1 leading-snug opacity-80">{SALE_STATUS_META[s].desc}</p>
            </div>
          ))}
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="강의 · 교보재 이름 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl"
          />
        </div>

        <Tabs defaultValue="courses">
          <TabsList>
            <TabsTrigger value="courses" className="gap-1.5"><BookOpen className="h-3.5 w-3.5" />강의</TabsTrigger>
            <TabsTrigger value="products" className="gap-1.5"><Package className="h-3.5 w-3.5" />교보재</TabsTrigger>
          </TabsList>

          <TabsContent value="courses" className="mt-4 space-y-2">
            {filteredCourses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">강의가 없습니다.</p>
            ) : (
              filteredCourses.map((c: any) => (
                <div key={c.id} className="stat-card !p-4 flex flex-wrap items-center gap-3 border-b-2 border-border/80">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{c.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full border ${saleStatusClass(c.sale_status)}`}>
                        {saleStatusLabel(c.sale_status)}
                      </span>
                      {(c.sale_status === "open_alert" || (alertCount.get(c.id) || 0) > 0) && (
                        <span className="flex items-center gap-1">
                          <Bell className="h-3 w-3" />알림 신청 {alertCount.get(c.id) || 0}명
                        </span>
                      )}
                    </p>
                  </div>
                  <StatusSelect
                    value={c.sale_status || "on_sale"}
                    onChange={(v) => quickStatus.mutate({ kind: "course", id: c.id, status: v })}
                  />
                  <Button variant="outline" size="sm" className="h-8 rounded-lg gap-1.5 text-xs" onClick={() => openCourseEdit(c)}>
                    <Pencil className="h-3 w-3" />일정 설정
                  </Button>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="products" className="mt-4 space-y-2">
            <div className="flex justify-end">
              <Button size="sm" className="rounded-xl gap-1.5" onClick={() => openProductEdit()}>
                <Plus className="h-3.5 w-3.5" />교보재 등록
              </Button>
            </div>
            {filteredProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">등록된 교보재가 없습니다.</p>
            ) : (
              filteredProducts.map((p: any) => (
                <div key={p.id} className="stat-card !p-4 flex flex-wrap items-center gap-3 border-b-2 border-border/80">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full border ${saleStatusClass(p.sale_status)}`}>
                        {saleStatusLabel(p.sale_status)}
                      </span>
                      <span>{Number(p.price || 0).toLocaleString()}원</span>
                      {p.stock_quantity != null && <span>재고 {p.stock_quantity}</span>}
                      {(alertCount.get(p.id) || 0) > 0 && (
                        <span className="flex items-center gap-1"><Bell className="h-3 w-3" />알림 {alertCount.get(p.id)}명</span>
                      )}
                    </p>
                  </div>
                  <StatusSelect
                    value={p.sale_status || "on_sale"}
                    onChange={(v) => quickStatus.mutate({ kind: "product", id: p.id, status: v })}
                  />
                  <Button variant="outline" size="sm" className="h-8 rounded-lg gap-1.5 text-xs" onClick={() => openProductEdit(p)}>
                    <Pencil className="h-3 w-3" />수정
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-destructive"
                    onClick={() => deleteProduct.mutate(p.id)}
                    aria-label="교보재 삭제"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* 강의 판매 일정 */}
      <Dialog open={!!courseEditId} onOpenChange={(o) => !o && setCourseEditId(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>강의 판매 상태 · 일정</DialogTitle>
            <DialogDescription>오픈알림 단계에서는 아래 일정이 학습자에게 안내됩니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">판매 상태</Label>
              <StatusSelect value={courseForm.sale_status} onChange={(v) => setCourseForm({ ...courseForm, sale_status: v })} />
              <p className="text-[11px] text-muted-foreground">{SALE_STATUS_META[courseForm.sale_status].desc}</p>
            </div>
            <ScheduleInputs form={courseForm} setField={(k, v) => setCourseForm({ ...courseForm, [k]: v })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCourseEditId(null)}>취소</Button>
            <Button onClick={() => saveCourse.mutate()} disabled={saveCourse.isPending}>
              {saveCourse.isPending ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 교보재 등록/수정 */}
      <Dialog open={productDialog} onOpenChange={setProductDialog}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{productForm.id ? "교보재 수정" : "교보재 등록"}</DialogTitle>
            <DialogDescription>교보재도 강의와 동일한 5단계 판매 상태로 운영됩니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">상품명</Label>
              <Input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">설명</Label>
              <Textarea rows={3} value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">정가</Label>
                <Input type="number" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">할인가</Label>
                <Input type="number" value={productForm.sale_price ?? ""} onChange={(e) => setProductForm({ ...productForm, sale_price: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">재고</Label>
                <Input type="number" value={productForm.stock_quantity ?? ""} onChange={(e) => setProductForm({ ...productForm, stock_quantity: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">판매 상태</Label>
                <StatusSelect value={productForm.sale_status} onChange={(v) => setProductForm({ ...productForm, sale_status: v })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">연결 강의 (선택)</Label>
                <Select
                  value={productForm.linked_course_id || "__none__"}
                  onValueChange={(v) => setProductForm({ ...productForm, linked_course_id: v === "__none__" ? null : v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">연결 없음</SelectItem>
                    {courses.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ScheduleInputs
              form={productForm as unknown as Record<string, string>}
              setField={(k, v) => setProductForm({ ...productForm, [k]: v })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialog(false)}>취소</Button>
            <Button onClick={() => saveProduct.mutate()} disabled={saveProduct.isPending || !productForm.name}>
              {saveProduct.isPending ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminSaleStatus;
