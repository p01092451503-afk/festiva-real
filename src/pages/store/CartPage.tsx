import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import StorefrontHeader from "@/components/StorefrontHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { ShoppingCart, X, CreditCard, Tag, Loader2, BookOpen, Trash2, ArrowLeft } from "lucide-react";

interface CartCourse {
  cart_item_id: string;
  course_id: string;
  title: string;
  thumbnail_url: string | null;
  price: number;
  sale_price: number | null;
  instructor_name: string | null;
  category_name: string | null;
  is_enrolled: boolean;
}

const CartPage = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    id: string;
    code: string;
    discount_type: string;
    discount_value: number;
    max_discount_amount: number | null;
    min_order_amount: number;
  } | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch cart items
  const { data: cartItems = [], isLoading } = useQuery({
    queryKey: ["cart-items", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: items, error } = await supabase
        .from("cart_items")
        .select("id, course_id, courses(id, title, thumbnail_url, price, sale_price, instructor_id, category_id, categories(name))")
        .eq("user_id", user.id);

      if (error) throw error;

      const courseIds = items?.map((i: any) => i.courses?.id).filter(Boolean) || [];
      const instructorIds = items?.map((i: any) => i.courses?.instructor_id).filter(Boolean) || [];

      const [profilesRes, enrollmentsRes] = await Promise.all([
        instructorIds.length > 0
          ? supabase.from("profiles").select("user_id, full_name").in("user_id", instructorIds)
          : { data: [] },
        courseIds.length > 0
          ? supabase.from("enrollments").select("course_id").eq("user_id", user.id).in("course_id", courseIds)
          : { data: [] },
      ]);

      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p.full_name]));
      const enrolledSet = new Set((enrollmentsRes.data || []).map((e: any) => e.course_id));

      const result = (items || []).map((item: any) => ({
        cart_item_id: item.id,
        course_id: item.courses?.id,
        title: item.courses?.title || "",
        thumbnail_url: item.courses?.thumbnail_url,
        price: item.courses?.price || 0,
        sale_price: item.courses?.sale_price,
        instructor_name: profileMap.get(item.courses?.instructor_id) || null,
        category_name: item.courses?.categories?.name || null,
        is_enrolled: enrolledSet.has(item.courses?.id),
      })) as CartCourse[];

      // Auto-select all purchasable items on first load
      if (!isInitialized && result.length > 0) {
        setSelectedIds(new Set(result.filter(i => !i.is_enrolled).map(i => i.cart_item_id)));
        setIsInitialized(true);
      }

      return result;
    },
    enabled: !!user,
  });

  // Remove from cart
  const removeMutation = useMutation({
    mutationFn: async (cartItemId: string) => {
      const { error } = await supabase.from("cart_items").delete().eq("id", cartItemId);
      if (error) throw error;
    },
    onMutate: async (cartItemId) => {
      await queryClient.cancelQueries({ queryKey: ["cart-items"] });
      const prev = queryClient.getQueryData(["cart-items", user?.id]);
      queryClient.setQueryData(["cart-items", user?.id], (old: CartCourse[] | undefined) =>
        (old || []).filter((i) => i.cart_item_id !== cartItemId)
      );
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(cartItemId);
        return next;
      });
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      queryClient.setQueryData(["cart-items", user?.id], ctx?.prev);
      toast({ title: "삭제 실패", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["cart-items"] });
      queryClient.invalidateQueries({ queryKey: ["cart-count"] });
    },
  });

  // Bulk delete
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("cart_items").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["cart-items"] });
      queryClient.invalidateQueries({ queryKey: ["cart-count"] });
      toast({ title: "선택한 항목이 삭제되었습니다." });
    },
    onError: () => {
      toast({ title: "삭제 실패", variant: "destructive" });
    },
  });

  // Selection helpers
  const purchasableItems = cartItems.filter((i) => !i.is_enrolled);
  const allPurchasableSelected = purchasableItems.length > 0 && purchasableItems.every(i => selectedIds.has(i.cart_item_id));

  const toggleSelectAll = () => {
    if (allPurchasableSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(purchasableItems.map(i => i.cart_item_id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Coupon validation
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsApplyingCoupon(true);
    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", couponCode.trim().toUpperCase())
        .eq("is_active", true)
        .single();

      if (error || !data) {
        toast({ title: "유효하지 않은 쿠폰 코드입니다.", variant: "destructive" });
        return;
      }

      const now = new Date();
      if (data.starts_at && new Date(data.starts_at) > now) {
        toast({ title: "아직 사용할 수 없는 쿠폰입니다.", variant: "destructive" });
        return;
      }
      if (data.ends_at && new Date(data.ends_at) < now) {
        toast({ title: "만료된 쿠폰입니다.", variant: "destructive" });
        return;
      }
      if (data.usage_limit && data.used_count >= data.usage_limit) {
        toast({ title: "소진된 쿠폰입니다.", variant: "destructive" });
        return;
      }
      if (subtotal < data.min_order_amount) {
        toast({ title: `최소 주문 금액은 ${data.min_order_amount.toLocaleString()}원입니다.`, variant: "destructive" });
        return;
      }

      setAppliedCoupon({
        id: data.id,
        code: data.code,
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        max_discount_amount: data.max_discount_amount,
        min_order_amount: data.min_order_amount,
      });
      toast({ title: "쿠폰이 적용되었습니다." });
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  // Price calculations (only selected items)
  const selectedItems = purchasableItems.filter(i => selectedIds.has(i.cart_item_id));
  const subtotal = selectedItems.reduce((sum, i) => sum + (i.sale_price ?? i.price), 0);

  let discountAmount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.discount_type === "percentage") {
      discountAmount = Math.floor(subtotal * (appliedCoupon.discount_value / 100));
      if (appliedCoupon.max_discount_amount) {
        discountAmount = Math.min(discountAmount, appliedCoupon.max_discount_amount);
      }
    } else {
      discountAmount = appliedCoupon.discount_value;
    }
  }
  const finalAmount = Math.max(0, subtotal - discountAmount);

  const handleCheckout = () => {
    if (selectedItems.length === 0) return;
    localStorage.setItem(
      "checkout_data",
      JSON.stringify({
        items: selectedItems,
        couponId: appliedCoupon?.id || null,
        discountAmount,
        totalAmount: subtotal,
        finalAmount,
      })
    );
    navigate("/checkout");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <StorefrontHeader />
        <main className="max-w-5xl mx-auto px-4 py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <StorefrontHeader />
        <main className="max-w-5xl mx-auto px-4 py-24 text-center">
          <ShoppingCart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-foreground mb-2">담긴 강의가 없습니다</h1>
          <p className="text-muted-foreground mb-6">관심있는 강의를 장바구니에 담아보세요.</p>
          <Button onClick={() => navigate("/store/courses")}>강의 탐색</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <StorefrontHeader />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-semibold text-foreground">장바구니</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart items */}
          <div className="lg:col-span-2 space-y-3">
            {/* Select all / Delete selected bar */}
            <div className="flex items-center justify-between pb-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
                <Checkbox
                  checked={allPurchasableSelected}
                  onCheckedChange={toggleSelectAll}
                />
                전체 선택 ({selectedIds.size}/{purchasableItems.length})
              </label>
              {selectedIds.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive gap-1.5"
                  onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
                  disabled={bulkDeleteMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  선택 삭제 ({selectedIds.size})
                </Button>
              )}
            </div>

            {cartItems.map((item) => (
              <Card key={item.cart_item_id} className={`p-4 flex gap-3 relative transition-colors ${selectedIds.has(item.cart_item_id) ? "border-primary/30 bg-primary/[0.02]" : ""}`}>
                {/* Checkbox */}
                {!item.is_enrolled && (
                  <div className="flex items-center shrink-0 pt-1">
                    <Checkbox
                      checked={selectedIds.has(item.cart_item_id)}
                      onCheckedChange={() => toggleSelect(item.cart_item_id)}
                    />
                  </div>
                )}

                {/* Thumbnail */}
                <div className="w-24 h-16 rounded overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
                  {item.thumbnail_url ? (
                    <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    {item.category_name && (
                      <Badge variant="secondary" className="text-xs shrink-0">{item.category_name}</Badge>
                    )}
                    {item.is_enrolled && (
                      <Badge variant="outline" className="text-xs shrink-0 text-orange-600 border-orange-300">이미 수강 중</Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground mt-1 truncate">{item.title}</p>
                  {item.instructor_name && (
                    <p className="text-xs text-muted-foreground">{item.instructor_name}</p>
                  )}
                </div>

                {/* Price + remove */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <button
                    onClick={() => removeMutation.mutate(item.cart_item_id)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="삭제"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  {item.is_enrolled ? (
                    <span className="text-xs text-muted-foreground">-</span>
                  ) : (
                    <div className="text-right">
                      {item.sale_price != null && item.sale_price < item.price ? (
                        <>
                          <p className="text-xs text-muted-foreground line-through">{item.price.toLocaleString()}원</p>
                          <p className="text-sm font-semibold text-foreground">{item.sale_price.toLocaleString()}원</p>
                        </>
                      ) : item.price === 0 ? (
                        <Badge className="bg-emerald-500 text-white dark:bg-emerald-500 dark:text-white">무료</Badge>
                      ) : (
                        <p className="text-sm font-semibold text-foreground">{item.price.toLocaleString()}원</p>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <Card className="p-6 space-y-4 sticky top-24">
              {/* Coupon */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">쿠폰 적용</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="쿠폰 코드 입력"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                  />
                  <Button variant="outline" size="sm" onClick={handleApplyCoupon} disabled={isApplyingCoupon}>
                    {isApplyingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : "적용"}
                  </Button>
                </div>
                {appliedCoupon && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-green-600">
                    <Tag className="h-3 w-3" />
                    <span>{appliedCoupon.code} 적용됨</span>
                    <button onClick={() => setAppliedCoupon(null)} className="text-muted-foreground hover:text-foreground ml-auto">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              <Separator />

              {/* Totals */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">선택 상품 ({selectedItems.length}개)</span>
                  <span className="text-foreground">{subtotal.toLocaleString()}원</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>쿠폰 할인</span>
                    <span>-{discountAmount.toLocaleString()}원</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-base font-semibold">
                  <span className="text-foreground">최종 결제액</span>
                  <span className="text-foreground">{finalAmount.toLocaleString()}원</span>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                disabled={selectedItems.length === 0}
                onClick={handleCheckout}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                {selectedItems.length > 0 ? `${selectedItems.length}개 강의 결제하기` : "상품을 선택해주세요"}
              </Button>

              {cartItems.some((i) => i.is_enrolled) && (
                <p className="text-xs text-muted-foreground text-center">
                  이미 수강 중인 강의는 결제에서 제외됩니다.
                </p>
              )}
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CartPage;