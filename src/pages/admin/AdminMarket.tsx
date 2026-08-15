import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Minus, Save, Pencil, Trash2, Truck, FileSpreadsheet, BookOpen, PackageCheck, CheckCircle2, ImageIcon, Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

const PRODUCT_TYPES: Record<string, string> = { goods: "일반상품", book: "도서", ebook: "전자책" };
const SHIP_STATUS: Record<string, string> = {
  pending: "접수",
  preparing: "배송준비",
  shipped: "발송완료",
  delivered: "배송완료",
  canceled: "취소",
};
const CARRIERS = ["CJ대한통운", "우체국택배", "한진택배", "롯데택배", "로젠택배"];

const emptyProduct = {
  id: "",
  name: "",
  description: "",
  image_url: "",
  product_type: "book",
  category_id: "__none__",
  price: 0,
  sale_price: "",
  stock_quantity: 0,
  stock_alert_threshold: 5,
  sku: "",
  author: "",
  publisher: "",
  isbn: "",
  requires_shipping: true,
  shipping_fee: 3000,
  ebook_file_url: "",
  ebook_download_limit: 5,
  ebook_access_days: 365,
  is_active: true,
};

const won = (n: number) => `${(n || 0).toLocaleString("ko-KR")}원`;
const fmtD = (v?: string | null) => (v ? new Date(v).toLocaleDateString("ko-KR") : "-");

/** 도서·마켓 관리: 상품/재고 · 카테고리 · 배송관리 · 전자책 권한 */
const AdminMarket = () => {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyProduct);
  const [open, setOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [shipStatusFilter, setShipStatusFilter] = useState("all");
  const [shipEdit, setShipEdit] = useState<any>(null);
  const [selectedShipIds, setSelectedShipIds] = useState<string[]>([]);
  const [bulkCarrier, setBulkCarrier] = useState(CARRIERS[0]);
  const [inline, setInline] = useState<Record<string, { price: string; sale_price: string; stock: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);


  const { data: categories = [] } = useQuery({
    queryKey: ["product-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_categories").select("*").order("display_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["market-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("store_products").select("*").order("display_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: shipments = [] } = useQuery({
    queryKey: ["product-shipments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_shipments")
        .select("*, store_products(name)")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });

  const { data: entitlements = [] } = useQuery({
    queryKey: ["ebook-entitlements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebook_entitlements")
        .select("*, store_products(name)")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const ids = Array.from(new Set((data || []).map((e: any) => e.user_id)));
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("user_id, full_name, email").in("user_id", ids)
        : { data: [] as any[] };
      const pMap = new Map((profiles || []).map((p) => [p.user_id, p]));
      return (data || []).map((e: any) => ({
        ...e,
        userName: pMap.get(e.user_id)?.full_name || "-",
        userEmail: pMap.get(e.user_id)?.email || "-",
      }));
    },
  });

  const lowStock = useMemo(
    () =>
      products.filter(
        (p: any) =>
          p.product_type !== "ebook" &&
          p.stock_quantity !== null &&
          p.stock_quantity <= (p.stock_alert_threshold ?? 0),
      ),
    [products],
  );

  const filteredShipments = useMemo(
    () => (shipStatusFilter === "all" ? shipments : shipments.filter((s: any) => s.status === shipStatusFilter)),
    [shipments, shipStatusFilter],
  );

  /** 상품 썸네일 업로드 (site-assets 버킷의 products/ 경로) */
  const uploadThumbnail = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("이미지 파일만 업로드할 수 있습니다");
    if (file.size > 5 * 1024 * 1024) return toast.error("5MB 이하 이미지를 사용하세요");
    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `products/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("site-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("site-assets").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: data.publicUrl }));
      toast.success("썸네일이 업로드되었습니다");
    } catch (e: any) {
      toast.error(e.message || "업로드에 실패했습니다");
    } finally {
      setUploadingImage(false);
    }
  };

  const saveProduct = async () => {
    if (!form.name.trim()) return toast.error("상품명을 입력하세요");
    const payload: any = {
      name: form.name.trim(),
      description: form.description || null,
      image_url: form.image_url || null,
      product_type: form.product_type,
      category_id: form.category_id === "__none__" ? null : form.category_id,
      price: Number(form.price) || 0,
      sale_price: form.sale_price === "" ? null : Number(form.sale_price),
      stock_quantity: form.product_type === "ebook" ? null : Number(form.stock_quantity) || 0,
      stock_alert_threshold: Number(form.stock_alert_threshold) || 0,
      sku: form.sku || null,
      author: form.author || null,
      publisher: form.publisher || null,
      isbn: form.isbn || null,
      requires_shipping: form.product_type === "ebook" ? false : form.requires_shipping,
      shipping_fee: Number(form.shipping_fee) || 0,
      ebook_file_url: form.ebook_file_url || null,
      ebook_download_limit: Number(form.ebook_download_limit) || 5,
      ebook_access_days: Number(form.ebook_access_days) || 365,
      is_active: form.is_active,
    };
    const { error } = form.id
      ? await supabase.from("store_products").update(payload).eq("id", form.id)
      : await supabase.from("store_products").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("저장되었습니다");
    setOpen(false);
    setForm(emptyProduct);
    qc.invalidateQueries({ queryKey: ["market-products"] });
  };

  const removeProduct = async (id: string) => {
    const { error } = await supabase.from("store_products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("삭제되었습니다");
    qc.invalidateQueries({ queryKey: ["market-products"] });
  };

  /** 목록에서 바로 가격·재고를 수정 */
  const inlineOf = (p: any) =>
    inline[p.id] ?? {
      price: String(p.price ?? 0),
      sale_price: p.sale_price === null || p.sale_price === undefined ? "" : String(p.sale_price),
      stock: String(p.stock_quantity ?? 0),
    };

  const setInlineField = (p: any, key: "price" | "sale_price" | "stock", value: string) =>
    setInline((prev) => ({ ...prev, [p.id]: { ...inlineOf(p), [key]: value } }));

  const saveInline = async (p: any) => {
    const v = inlineOf(p);
    setSavingId(p.id);
    const patch: any = {
      price: Number(v.price) || 0,
      sale_price: v.sale_price === "" ? null : Number(v.sale_price),
    };
    if (p.product_type !== "ebook") patch.stock_quantity = Number(v.stock) || 0;
    const { error } = await supabase.from("store_products").update(patch).eq("id", p.id);
    setSavingId(null);
    if (error) return toast.error(error.message);
    toast.success("반영되었습니다");
    setInline((prev) => {
      const next = { ...prev };
      delete next[p.id];
      return next;
    });
    qc.invalidateQueries({ queryKey: ["market-products"] });
  };

  const adjustStock = async (p: any, delta: number) => {
    const next = Math.max(0, (p.stock_quantity ?? 0) + delta);
    const { error } = await supabase.from("store_products").update({ stock_quantity: next }).eq("id", p.id);
    if (error) return toast.error(error.message);
    setInline((prev) => {
      const c = { ...prev };
      delete c[p.id];
      return c;
    });
    qc.invalidateQueries({ queryKey: ["market-products"] });
  };

  const toggleActive = async (p: any) => {
    const { error } = await supabase.from("store_products").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["market-products"] });
  };

  /** 주문(배송) 상태를 한 번에 변경 */
  const changeShipStatus = async (s: any, status: string) => {
    const patch: any = { status };
    if (status === "shipped" && !s.shipped_at) patch.shipped_at = new Date().toISOString();
    if (status === "delivered") {
      if (!s.shipped_at) patch.shipped_at = new Date().toISOString();
      if (!s.delivered_at) patch.delivered_at = new Date().toISOString();
    }
    const { error } = await supabase.from("product_shipments").update(patch).eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success(`${SHIP_STATUS[status]} 처리되었습니다`);
    qc.invalidateQueries({ queryKey: ["product-shipments"] });
  };

  const bulkStatus = async (status: string) => {
    if (selectedShipIds.length === 0) return toast.error("주문을 선택하세요");
    const patch: any = { status };
    if (status === "shipped") patch.shipped_at = new Date().toISOString();
    if (status === "delivered") patch.delivered_at = new Date().toISOString();
    const { error } = await supabase.from("product_shipments").update(patch).in("id", selectedShipIds);
    if (error) return toast.error(error.message);
    toast.success(`${selectedShipIds.length}건을 ${SHIP_STATUS[status]} 처리했습니다`);
    setSelectedShipIds([]);
    qc.invalidateQueries({ queryKey: ["product-shipments"] });
  };


  const addCategory = async () => {
    if (!catName.trim()) return;
    const { error } = await supabase.from("product_categories").insert({ name: catName.trim() });
    if (error) return toast.error(error.message);
    setCatName("");
    qc.invalidateQueries({ queryKey: ["product-categories"] });
  };

  const removeCategory = async (id: string) => {
    const { error } = await supabase.from("product_categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["product-categories"] });
  };

  const saveShipment = async () => {
    if (!shipEdit) return;
    const patch: any = {
      carrier: shipEdit.carrier || null,
      tracking_no: shipEdit.tracking_no || null,
      status: shipEdit.status,
      admin_memo: shipEdit.admin_memo || null,
    };
    if (shipEdit.status === "shipped" && !shipEdit.shipped_at) patch.shipped_at = new Date().toISOString();
    if (shipEdit.status === "delivered" && !shipEdit.delivered_at) patch.delivered_at = new Date().toISOString();
    const { error } = await supabase.from("product_shipments").update(patch).eq("id", shipEdit.id);
    if (error) return toast.error(error.message);
    toast.success("저장되었습니다");
    setShipEdit(null);
    qc.invalidateQueries({ queryKey: ["product-shipments"] });
  };

  const bulkShip = async () => {
    if (selectedShipIds.length === 0) return toast.error("주문을 선택하세요");
    const { error } = await supabase
      .from("product_shipments")
      .update({ status: "shipped", carrier: bulkCarrier, shipped_at: new Date().toISOString() })
      .in("id", selectedShipIds);
    if (error) return toast.error(error.message);
    toast.success(`${selectedShipIds.length}건을 발송처리했습니다`);
    setSelectedShipIds([]);
    qc.invalidateQueries({ queryKey: ["product-shipments"] });
  };

  const exportShipments = () => {
    const rows = filteredShipments.map((s: any) => ({
      주문일: fmtD(s.created_at),
      상품: s.store_products?.name || "-",
      수량: s.quantity,
      수령인: s.recipient_name,
      연락처: s.recipient_phone,
      주소: `${s.postcode ? `(${s.postcode}) ` : ""}${s.address1} ${s.address2 || ""}`.trim(),
      배송메모: s.delivery_memo || "",
      택배사: s.carrier || "",
      송장번호: s.tracking_no || "",
      상태: SHIP_STATUS[s.status] || s.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "배송목록");
    XLSX.writeFile(wb, `배송목록_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const revokeEntitlement = async (id: string, revoked: boolean) => {
    const { error } = await supabase.from("ebook_entitlements").update({ is_revoked: revoked }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["ebook-entitlements"] });
  };

  const resetDownloads = async (id: string) => {
    const { error } = await supabase.from("ebook_entitlements").update({ download_count: 0 }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("다운로드 횟수를 초기화했습니다");
    qc.invalidateQueries({ queryKey: ["ebook-entitlements"] });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <Package className="h-5 w-5" /> 도서·마켓 관리
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            상품과 재고, 배송(송장·일괄처리), 전자책 다운로드 권한을 관리합니다.
          </p>
        </div>

        {lowStock.length > 0 && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
            <p className="text-sm font-medium">재고 부족 알림 ({lowStock.length}건)</p>
            <p className="text-xs text-muted-foreground mt-1">
              {lowStock.map((p: any) => `${p.name}(${p.stock_quantity})`).join(", ")}
            </p>
          </div>
        )}

        <Tabs defaultValue="products">
          <TabsList>
            <TabsTrigger value="products">상품·재고</TabsTrigger>
            <TabsTrigger value="categories">카테고리</TabsTrigger>
            <TabsTrigger value="shipments">배송관리</TabsTrigger>
            <TabsTrigger value="ebooks">전자책 권한</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-4 space-y-3">
            <div className="flex justify-end">
              <Button size="sm" className="gap-1.5" onClick={() => { setForm(emptyProduct); setOpen(true); }}>
                <Plus className="h-4 w-4" /> 상품 등록
              </Button>
            </div>
            <div className="rounded-xl border divide-y">
              {products.length === 0 && (
                <p className="p-6 text-sm text-muted-foreground text-center">등록된 상품이 없습니다.</p>
              )}
              {products.map((p: any) => (
                <div key={p.id} className="p-4 flex flex-wrap items-center justify-between gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{p.name}</span>
                      <Badge variant="secondary" className="whitespace-nowrap">
                        {PRODUCT_TYPES[p.product_type] || p.product_type}
                      </Badge>
                      {!p.is_active && <Badge variant="outline" className="whitespace-nowrap">판매중지</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {won(p.sale_price ?? p.price)}
                      {p.product_type === "ebook"
                        ? ` · 다운로드 ${p.ebook_download_limit}회 / ${p.ebook_access_days}일`
                        : ` · 재고 ${p.stock_quantity ?? 0}개`}
                      {p.author ? ` · ${p.author}` : ""}
                      {p.publisher ? ` / ${p.publisher}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-end gap-2 shrink-0">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">정가</Label>
                      <Input
                        type="number"
                        className="mt-0.5 h-8 w-24"
                        value={inlineOf(p).price}
                        onChange={(e) => setInlineField(p, "price", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">판매가</Label>
                      <Input
                        type="number"
                        className="mt-0.5 h-8 w-24"
                        placeholder="없음"
                        value={inlineOf(p).sale_price}
                        onChange={(e) => setInlineField(p, "sale_price", e.target.value)}
                      />
                    </div>
                    {p.product_type !== "ebook" && (
                      <div>
                        <Label className="text-[11px] text-muted-foreground">재고</Label>
                        <div className="mt-0.5 flex items-center gap-1">
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => adjustStock(p, -1)}>
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <Input
                            type="number"
                            className="h-8 w-20"
                            value={inlineOf(p).stock}
                            onChange={(e) => setInlineField(p, "stock", e.target.value)}
                          />
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => adjustStock(p, 1)}>
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                    <Button size="sm" className="h-8" disabled={savingId === p.id} onClick={() => saveInline(p)}>
                      <Save className="h-3.5 w-3.5 mr-1" /> 적용
                    </Button>
                    <Button variant="outline" size="sm" className="h-8" onClick={() => toggleActive(p)}>
                      {p.is_active ? "판매중지" : "판매재개"}
                    </Button>
                  </div>
                  <div className="flex gap-1 shrink-0">

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setForm({
                          id: p.id,
                          name: p.name,
                          description: p.description || "",
                          image_url: p.image_url || "",
                          product_type: p.product_type || "goods",
                          category_id: p.category_id || "__none__",
                          price: p.price,
                          sale_price: p.sale_price ?? "",
                          stock_quantity: p.stock_quantity ?? 0,
                          stock_alert_threshold: p.stock_alert_threshold ?? 5,
                          sku: p.sku || "",
                          author: p.author || "",
                          publisher: p.publisher || "",
                          isbn: p.isbn || "",
                          requires_shipping: p.requires_shipping ?? true,
                          shipping_fee: p.shipping_fee ?? 0,
                          ebook_file_url: p.ebook_file_url || "",
                          ebook_download_limit: p.ebook_download_limit ?? 5,
                          ebook_access_days: p.ebook_access_days ?? 365,
                          is_active: p.is_active,
                        });
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removeProduct(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="categories" className="mt-4 space-y-3">
            <div className="flex gap-2">
              <Input placeholder="카테고리명" value={catName} onChange={(e) => setCatName(e.target.value)} className="max-w-xs" />
              <Button onClick={addCategory} className="gap-1.5"><Plus className="h-4 w-4" /> 추가</Button>
            </div>
            <div className="rounded-xl border divide-y">
              {categories.length === 0 && (
                <p className="p-6 text-sm text-muted-foreground text-center">등록된 카테고리가 없습니다.</p>
              )}
              {categories.map((c: any) => (
                <div key={c.id} className="p-3 flex items-center justify-between">
                  <span className="text-sm">{c.name}</span>
                  <Button variant="ghost" size="icon" onClick={() => removeCategory(c.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="shipments" className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Select value={shipStatusFilter} onValueChange={setShipStatusFilter}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 상태</SelectItem>
                    {Object.entries(SHIP_STATUS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={bulkCarrier} onValueChange={setBulkCarrier}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CARRIERS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={bulkShip}>
                  <Truck className="h-4 w-4" /> 선택 발송처리 ({selectedShipIds.length})
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => bulkStatus("preparing")}>
                  <PackageCheck className="h-4 w-4" /> 배송준비
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => bulkStatus("delivered")}>
                  <CheckCircle2 className="h-4 w-4" /> 배송완료
                </Button>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportShipments}>
                <FileSpreadsheet className="h-4 w-4" /> 엑셀 다운로드
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {Object.entries(SHIP_STATUS).map(([v, l]) => (
                <span key={v} className="rounded-full border px-2.5 py-1">
                  {l} {shipments.filter((s: any) => s.status === v).length}건
                </span>
              ))}
            </div>
            <div className="rounded-xl border divide-y">
              {filteredShipments.length === 0 && (
                <p className="p-6 text-sm text-muted-foreground text-center">배송 건이 없습니다.</p>
              )}
              {filteredShipments.map((s: any) => (
                <div key={s.id} className="p-4 flex flex-wrap items-center gap-3 min-w-0">
                  <Checkbox
                    checked={selectedShipIds.includes(s.id)}
                    onCheckedChange={(v) =>
                      setSelectedShipIds((prev) => (v ? [...prev, s.id] : prev.filter((id) => id !== s.id)))
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {s.store_products?.name || "상품"} × {s.quantity}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {s.recipient_name} · {s.recipient_phone} · {s.postcode ? `(${s.postcode}) ` : ""}
                      {s.address1} {s.address2 || ""}
                    </p>
                    {(s.carrier || s.tracking_no) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {s.carrier || "-"} {s.tracking_no || ""}
                      </p>
                    )}
                  </div>
                  <Badge variant={s.status === "delivered" ? "default" : "secondary"} className="whitespace-nowrap">
                    {SHIP_STATUS[s.status] || s.status}
                  </Badge>
                  <div className="flex flex-wrap gap-1 shrink-0">
                    {(["pending", "preparing", "shipped", "delivered"] as const).map((st) => (
                      <Button
                        key={st}
                        size="sm"
                        variant={s.status === st ? "default" : "outline"}
                        className="h-8"
                        disabled={s.status === st}
                        onClick={() => changeShipStatus(s, st)}
                      >
                        {SHIP_STATUS[st]}
                      </Button>
                    ))}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setShipEdit({ ...s })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              ))}

            </div>
          </TabsContent>

          <TabsContent value="ebooks" className="mt-4">
            <div className="rounded-xl border divide-y">
              {entitlements.length === 0 && (
                <p className="p-6 text-sm text-muted-foreground text-center">전자책 구매 이력이 없습니다.</p>
              )}
              {entitlements.map((e: any) => (
                <div key={e.id} className="p-4 flex flex-wrap items-center justify-between gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="font-medium truncate flex items-center gap-1.5">
                      <BookOpen className="h-4 w-4" /> {e.store_products?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {e.userName} ({e.userEmail}) · 다운로드 {e.download_count}/{e.download_limit}회 · 만료{" "}
                      {fmtD(e.expires_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {e.is_revoked && <Badge variant="destructive" className="whitespace-nowrap">권한회수</Badge>}
                    <Button variant="outline" size="sm" onClick={() => resetDownloads(e.id)}>횟수 초기화</Button>
                    <Button variant="outline" size="sm" onClick={() => revokeEntitlement(e.id, !e.is_revoked)}>
                      {e.is_revoked ? "권한복구" : "권한회수"}
                    </Button>
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
            <DialogTitle>{form.id ? "상품 수정" : "상품 등록"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>상품 유형</Label>
                <Select value={form.product_type} onValueChange={(v) => setForm({ ...form, product_type: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRODUCT_TYPES).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>카테고리</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">미분류</SelectItem>
                    {categories.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>상품명</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>설명</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>정가</Label>
                <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="mt-1" />
              </div>
              <div>
                <Label>판매가</Label>
                <Input type="number" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>SKU</Label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="mt-1" />
              </div>
            </div>
            {form.product_type !== "ebook" && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>재고 수량</Label>
                  <Input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: Number(e.target.value) })} className="mt-1" />
                </div>
                <div>
                  <Label>재고 알림 기준</Label>
                  <Input type="number" value={form.stock_alert_threshold} onChange={(e) => setForm({ ...form, stock_alert_threshold: Number(e.target.value) })} className="mt-1" />
                </div>
                <div>
                  <Label>배송비</Label>
                  <Input type="number" value={form.shipping_fee} onChange={(e) => setForm({ ...form, shipping_fee: Number(e.target.value) })} className="mt-1" />
                </div>
              </div>
            )}
            {(form.product_type === "book" || form.product_type === "ebook") && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>저자</Label>
                  <Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label>출판사</Label>
                  <Input value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label>ISBN</Label>
                  <Input value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} className="mt-1" />
                </div>
              </div>
            )}
            {form.product_type === "ebook" && (
              <div className="space-y-3">
                <div>
                  <Label>전자책 파일 주소(PDF)</Label>
                  <Input value={form.ebook_file_url} onChange={(e) => setForm({ ...form, ebook_file_url: e.target.value })} className="mt-1" placeholder="https://..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>다운로드 허용 횟수</Label>
                    <Input type="number" value={form.ebook_download_limit} onChange={(e) => setForm({ ...form, ebook_download_limit: Number(e.target.value) })} className="mt-1" />
                  </div>
                  <div>
                    <Label>이용 기간(일)</Label>
                    <Input type="number" value={form.ebook_access_days} onChange={(e) => setForm({ ...form, ebook_access_days: Number(e.target.value) })} className="mt-1" />
                  </div>
                </div>
              </div>
            )}
            {form.product_type !== "ebook" && (
              <div className="flex items-center justify-between">
                <Label>배송 필요</Label>
                <Switch checked={form.requires_shipping} onCheckedChange={(v) => setForm({ ...form, requires_shipping: v })} />
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label>판매중</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button onClick={saveProduct}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!shipEdit} onOpenChange={(o) => !o && setShipEdit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>배송 정보 수정</DialogTitle>
          </DialogHeader>
          {shipEdit && (
            <div className="space-y-3">
              <div>
                <Label>택배사</Label>
                <Select value={shipEdit.carrier || ""} onValueChange={(v) => setShipEdit({ ...shipEdit, carrier: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="택배사 선택" /></SelectTrigger>
                  <SelectContent>
                    {CARRIERS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>송장번호</Label>
                <Input value={shipEdit.tracking_no || ""} onChange={(e) => setShipEdit({ ...shipEdit, tracking_no: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>배송 상태</Label>
                <Select value={shipEdit.status} onValueChange={(v) => setShipEdit({ ...shipEdit, status: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SHIP_STATUS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>관리자 메모</Label>
                <Textarea rows={2} value={shipEdit.admin_memo || ""} onChange={(e) => setShipEdit({ ...shipEdit, admin_memo: e.target.value })} className="mt-1" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShipEdit(null)}>취소</Button>
            <Button onClick={saveShipment}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminMarket;
