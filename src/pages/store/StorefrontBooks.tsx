import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Package, Search, Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import PageLoading from "@/components/PageLoading";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import StorefrontHeader from "@/components/StorefrontHeader";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const won = (n: number) => `${(n || 0).toLocaleString("ko-KR")}원`;

const StorefrontBooks = () => {
  const { user, profile } = useUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState("all");
  const [target, setTarget] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    quantity: 1,
    recipient_name: "",
    recipient_phone: "",
    postcode: "",
    address1: "",
    address2: "",
    delivery_memo: "",
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["store-products-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_products")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["product-categories-public"],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_categories")
        .select("id, name")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      return data || [];
    },
  });

  const catMap = useMemo(() => {
    const m: Record<string, string> = {};
    categories.forEach((c: any) => { m[c.id] = c.name; });
    return m;
  }, [categories]);

  const filtered = useMemo(() => {
    return products.filter((p: any) => {
      if (type !== "all" && (p.product_type || "book") !== type) return false;
      if (!keyword.trim()) return true;
      const k = keyword.toLowerCase();
      return [p.name, p.author, p.publisher].some((v) => (v || "").toLowerCase().includes(k));
    });
  }, [products, keyword, type]);

  const openOrder = (p: any) => {
    if (!user) {
      toast.error("로그인이 필요합니다.");
      navigate("/auth");
      return;
    }
    setForm({
      quantity: 1,
      recipient_name: profile?.full_name || "",
      recipient_phone: (profile as any)?.phone || "",
      postcode: "",
      address1: "",
      address2: "",
      delivery_memo: "",
    });
    setTarget(p);
  };

  const priceOf = (p: any) => (p.sale_price ?? p.price ?? 0);

  const submitOrder = async () => {
    if (!target || !user) return;
    const needsShipping = target.requires_shipping !== false && target.product_type !== "ebook";

    if (needsShipping) {
      if (!form.recipient_name.trim() || !form.recipient_phone.trim() || !form.address1.trim()) {
        toast.error("수령인·연락처·주소를 입력해주세요.");
        return;
      }
      if (target.stock_quantity != null && form.quantity > target.stock_quantity) {
        toast.error("재고 수량을 초과했습니다.");
        return;
      }
    }

    setSaving(true);
    try {
      if (needsShipping) {
        const { error } = await supabase.from("product_shipments").insert({
          user_id: user.id,
          product_id: target.id,
          quantity: form.quantity,
          recipient_name: form.recipient_name.trim(),
          recipient_phone: form.recipient_phone.trim(),
          postcode: form.postcode.trim() || null,
          address1: form.address1.trim(),
          address2: form.address2.trim() || null,
          delivery_memo: form.delivery_memo.trim() || null,
          status: "pending",
        });
        if (error) throw error;
      } else {
        const days = target.ebook_access_days;
        const { error } = await supabase.from("ebook_entitlements").insert({
          user_id: user.id,
          product_id: target.id,
          download_limit: target.ebook_download_limit ?? 5,
          expires_at: days ? new Date(Date.now() + days * 86400000).toISOString() : null,
        });
        if (error) throw error;
      }
      toast.success(needsShipping ? "주문이 접수되었습니다. 배송 상태는 마이페이지에서 확인하세요." : "전자책 열람 권한이 발급되었습니다.");
      setTarget(null);
      qc.invalidateQueries({ queryKey: ["my-shipments"] });
      qc.invalidateQueries({ queryKey: ["my-ebooks"] });
    } catch (e: any) {
      toast.error(e.message || "주문에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const needsShipping = target && target.requires_shipping !== false && target.product_type !== "ebook";

  return (
    <div className="min-h-screen bg-background">
      <StorefrontHeader />
      <main className="max-w-7xl mx-auto px-4 py-10">
        <header className="mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> 도서 · 굿즈 마켓
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            학습에 필요한 교재와 굿즈, 전자책을 만나보세요.
          </p>
        </header>

        <div className="flex flex-wrap gap-2 items-center mb-6">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="상품·저자·출판사 검색"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 유형</SelectItem>
              <SelectItem value="book">도서</SelectItem>
              <SelectItem value="ebook">전자책</SelectItem>
              <SelectItem value="goods">굿즈</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <PageLoading size="lg" />
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center text-muted-foreground text-sm">등록된 상품이 없습니다.</div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {filtered.map((p: any) => {
              const soldOut = p.requires_shipping !== false && p.product_type !== "ebook" && (p.stock_quantity ?? 0) <= 0;
              return (
                <article key={p.id} className="rounded-xl border overflow-hidden flex flex-col min-w-0">
                  <div className="aspect-[16/10] bg-muted flex items-center justify-center overflow-hidden">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <Package className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="p-4 space-y-2 flex-1 flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="secondary" className="whitespace-nowrap">
                        {p.product_type === "ebook" ? "전자책" : p.product_type === "goods" ? "굿즈" : "도서"}
                      </Badge>
                      {p.category_id && catMap[p.category_id] && (
                        <Badge variant="outline" className="whitespace-nowrap">{catMap[p.category_id]}</Badge>
                      )}
                      {soldOut && <Badge variant="destructive" className="whitespace-nowrap">품절</Badge>}
                    </div>
                    <h2 className="font-medium leading-snug line-clamp-2">{p.name}</h2>
                    {(p.author || p.publisher) && (
                      <p className="text-xs text-muted-foreground truncate">
                        {[p.author, p.publisher].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <div className="mt-auto pt-2 flex items-end justify-between gap-2 min-w-0">
                      <div className="min-w-0">
                        {p.sale_price != null && p.sale_price !== p.price && (
                          <p className="text-xs text-muted-foreground line-through">{won(p.price)}</p>
                        )}
                        <p className="font-semibold">{won(priceOf(p))}</p>
                      </div>
                      <Button size="sm" disabled={soldOut} onClick={() => openOrder(p)}>
                        {p.product_type === "ebook" ? "구매" : "주문하기"}
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={!!target} onOpenChange={(v) => !v && setTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-4 w-4" /> {target?.name}
            </DialogTitle>
          </DialogHeader>
          {needsShipping ? (
            <div className="space-y-3">
              <div>
                <Label>수량</Label>
                <Input
                  type="number"
                  min={1}
                  className="mt-1"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Math.max(1, Number(e.target.value) || 1) })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>수령인 *</Label>
                  <Input className="mt-1" value={form.recipient_name} onChange={(e) => setForm({ ...form, recipient_name: e.target.value })} />
                </div>
                <div>
                  <Label>연락처 *</Label>
                  <Input className="mt-1" value={form.recipient_phone} onChange={(e) => setForm({ ...form, recipient_phone: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>우편번호</Label>
                <Input className="mt-1" value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} />
              </div>
              <div>
                <Label>주소 *</Label>
                <Input className="mt-1" value={form.address1} onChange={(e) => setForm({ ...form, address1: e.target.value })} />
              </div>
              <div>
                <Label>상세주소</Label>
                <Input className="mt-1" value={form.address2} onChange={(e) => setForm({ ...form, address2: e.target.value })} />
              </div>
              <div>
                <Label>배송 메모</Label>
                <Textarea className="mt-1" rows={2} value={form.delivery_memo} onChange={(e) => setForm({ ...form, delivery_memo: e.target.value })} />
              </div>
              <div className="rounded-lg border p-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">결제 예정 금액</span>
                <span className="font-semibold">
                  {won(priceOf(target || {}) * form.quantity + (target?.shipping_fee || 0))}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              전자책은 구매 즉시 마이페이지에서 다운로드할 수 있습니다.
              {target?.ebook_download_limit ? ` (다운로드 ${target.ebook_download_limit}회 제한)` : ""}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>취소</Button>
            <Button onClick={submitOrder} disabled={saving}>{saving ? "처리 중..." : "주문 접수"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StorefrontBooks;
