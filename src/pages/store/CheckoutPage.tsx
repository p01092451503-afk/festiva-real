import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import StorefrontHeader from "@/components/StorefrontHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { CreditCard, Loader2, BookOpen, AlertTriangle, X, Trash2 } from "lucide-react";
import type { TossPaymentsWidgets, WidgetAgreementWidget, WidgetPaymentMethodWidget } from "@tosspayments/tosspayments-sdk";

interface CheckoutItem {
  course_id: string;
  title: string;
  thumbnail_url: string | null;
  price: number;
  sale_price: number | null;
}

interface CheckoutData {
  items: CheckoutItem[];
  couponId: string | null;
  discountAmount: number;
  totalAmount: number;
  finalAmount: number;
  existingOrderId?: string;
  existingTossOrderId?: string;
}

const TOSS_WIDGET_CLIENT_KEY = "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";

const waitForWidgetRender = async (selector: string) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const element = document.querySelector(selector);
    const isRendered = Boolean(element?.querySelector("iframe")) || Boolean(element?.firstElementChild);

    if (isRendered) {
      return true;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }

  return false;
};

const CheckoutPage = () => {
  const { user, profile } = useUser();
  const navigate = useNavigate();
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [tossOrderId, setTossOrderId] = useState<string | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(true);
  const [isPaymentReady, setIsPaymentReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const widgetsRef = useRef<TossPaymentsWidgets | null>(null);
  const paymentMethodWidgetRef = useRef<WidgetPaymentMethodWidget | null>(null);
  const agreementWidgetRef = useRef<WidgetAgreementWidget | null>(null);
  const initSequenceRef = useRef(0);
  const [tossError, setTossError] = useState<string | null>(null);

  const handleClose = () => {
    navigate("/cart");
  };

  const handleRemoveItem = async (courseId: string) => {
    if (!checkoutData || checkoutData.items.length <= 1) return;
    const updatedItems = checkoutData.items.filter(i => i.course_id !== courseId);
    const newTotal = updatedItems.reduce((sum, i) => sum + (i.sale_price ?? i.price), 0);
    const newDiscount = Math.min(checkoutData.discountAmount, newTotal);
    const newFinal = Math.max(0, newTotal - newDiscount);
    const updated = { ...checkoutData, items: updatedItems, totalAmount: newTotal, discountAmount: newDiscount, finalAmount: newFinal };
    setCheckoutData(updated);
    localStorage.setItem("checkout_data", JSON.stringify(updated));

    // Remove order_item from DB if order exists
    if (orderId) {
      await supabase.from("order_items").delete().eq("order_id", orderId).eq("course_id", courseId);
      await supabase.from("orders").update({ total_amount: newTotal, discount_amount: newDiscount, final_amount: newFinal }).eq("id", orderId);
    }

    toast({ title: "상품이 제거되었습니다." });
  };

  const destroyRenderedWidgets = async () => {
    await Promise.allSettled([
      paymentMethodWidgetRef.current?.destroy(),
      agreementWidgetRef.current?.destroy(),
    ]);

    paymentMethodWidgetRef.current = null;
    agreementWidgetRef.current = null;
    widgetsRef.current = null;

    const paymentMethodContainer = document.querySelector("#payment-method");
    const agreementContainer = document.querySelector("#agreement");

    if (paymentMethodContainer) paymentMethodContainer.innerHTML = "";
    if (agreementContainer) agreementContainer.innerHTML = "";
  };

  // Load checkout data
  useEffect(() => {
    const raw = localStorage.getItem("checkout_data");
    if (!raw) {
      toast({ title: "결제 정보가 없습니다.", variant: "destructive" });
      navigate("/cart");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as CheckoutData;
      if (!parsed.items || parsed.items.length === 0) {
        navigate("/cart");
        return;
      }
      setCheckoutData(parsed);
    } catch {
      navigate("/cart");
    }
  }, []);

  // Create pending order (skip if reusing existing order)
  useEffect(() => {
    if (!checkoutData || !user) return;

    // If we have an existing order (from "결제하기" on pending order), reuse it
    if (checkoutData.existingOrderId && checkoutData.existingTossOrderId) {
      setOrderId(checkoutData.existingOrderId);
      setTossOrderId(checkoutData.existingTossOrderId);
      setIsCreatingOrder(false);
      return;
    }

    const createOrder = async () => {
      try {
        // 중복 체크: 이미 수강 중이거나 pending 주문이 있는 과목 필터링
        const courseIds = checkoutData.items.map(i => i.course_id);

        const [enrollRes, pendingOrdersRes] = await Promise.all([
          supabase.from("enrollments").select("course_id").eq("user_id", user.id).in("course_id", courseIds).eq("status", "approved"),
          supabase.from("orders").select("id, order_items(course_id)").eq("user_id", user.id).eq("status", "pending"),
        ]);

        const enrolledCourseIds = new Set((enrollRes.data || []).map((e: any) => e.course_id));
        const pendingCourseIds = new Set(
          (pendingOrdersRes.data || []).flatMap((o: any) => (o.order_items || []).map((oi: any) => oi.course_id))
        );

        const validItems = checkoutData.items.filter(
          item => !enrolledCourseIds.has(item.course_id) && !pendingCourseIds.has(item.course_id)
        );

        if (validItems.length === 0) {
          toast({ title: "이미 수강 중이거나 결제 대기 중인 강의입니다.", variant: "destructive" });
          navigate("/cart");
          return;
        }

        // 필터링된 항목으로 데이터 갱신
        if (validItems.length < checkoutData.items.length) {
          const removed = checkoutData.items.length - validItems.length;
          toast({ title: `${removed}개의 중복 강의가 제외되었습니다.` });
          const newTotal = validItems.reduce((sum, i) => sum + (i.sale_price ?? i.price), 0);
          const newFinal = Math.max(0, newTotal - checkoutData.discountAmount);
          setCheckoutData({ ...checkoutData, items: validItems, totalAmount: newTotal, finalAmount: newFinal });
        }

        const newTossOrderId = crypto.randomUUID();
        const { data: orderNumber, error: rpcError } = await supabase.rpc("generate_order_number");
        if (rpcError) throw rpcError;

        const recalcTotal = validItems.reduce((sum, i) => sum + (i.sale_price ?? i.price), 0);
        const recalcFinal = Math.max(0, recalcTotal - checkoutData.discountAmount);

        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert({
            user_id: user.id,
            order_number: orderNumber,
            toss_order_id: newTossOrderId,
            status: "pending",
            total_amount: recalcTotal,
            discount_amount: checkoutData.discountAmount,
            final_amount: recalcFinal,
            coupon_id: checkoutData.couponId,
          })
          .select("id")
          .single();

        if (orderError) throw orderError;

        const orderItems = validItems.map((item) => ({
          order_id: order.id,
          course_id: item.course_id,
          price_at_purchase: item.sale_price ?? item.price,
        }));

        const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
        if (itemsError) throw itemsError;

        setOrderId(order.id);
        setTossOrderId(newTossOrderId);
      } catch (e: any) {
        console.error("Order creation failed:", e);
        toast({ title: "주문 생성에 실패했습니다.", description: e.message, variant: "destructive" });
        navigate("/cart");
      } finally {
        setIsCreatingOrder(false);
      }
    };

    createOrder();
  }, [checkoutData, user]);

  // Initialize Toss Payments widget (V2 SDK)
  useEffect(() => {
    if (!orderId || !tossOrderId || !checkoutData || !user) return;

    let cancelled = false;
    const currentSequence = ++initSequenceRef.current;

    const initToss = async () => {
      try {
        setTossError(null);
        setIsPaymentReady(false);
        await destroyRenderedWidgets();

        const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
        const tossPayments = await loadTossPayments(TOSS_WIDGET_CLIENT_KEY);

        if (cancelled || currentSequence !== initSequenceRef.current) return;

        const widgets = tossPayments.widgets({ customerKey: user.id });
        widgetsRef.current = widgets;

        await widgets.setAmount({ currency: "KRW", value: checkoutData.finalAmount });

        const paymentMethodWidget = await widgets.renderPaymentMethods({
          selector: "#payment-method",
          variantKey: "DEFAULT",
        });

        if (cancelled || currentSequence !== initSequenceRef.current) {
          await paymentMethodWidget.destroy();
          return;
        }

        paymentMethodWidgetRef.current = paymentMethodWidget;

        try {
          const agreementWidget = await widgets.renderAgreement({
            selector: "#agreement",
            variantKey: "AGREEMENT",
          });
          agreementWidgetRef.current = agreementWidget;
        } catch (agreementError) {
          console.warn("Toss agreement widget skipped:", agreementError);
        }

        paymentMethodWidget.on("paymentMethodSelect", () => {
          setIsPaymentReady(true);
        });

        const didRender = await waitForWidgetRender("#payment-method");

        if (!cancelled && currentSequence === initSequenceRef.current) {
          if (didRender) {
            setIsPaymentReady(true);
          } else {
            setTossError("결제 위젯이 렌더링되지 않았습니다. 위젯 키 또는 상점 설정을 확인해 주세요.");
          }
        }
      } catch (e: any) {
        console.error("Toss init error:", e);
        if (!cancelled) {
          setTossError(e?.message || "결제 위젯 로드에 실패했습니다.");
        }
      }
    };

    initToss();

    return () => {
      cancelled = true;
      void destroyRenderedWidgets();
    };
  }, [orderId, tossOrderId, checkoutData, user]);

  const isInIframe = typeof window !== "undefined" && window.self !== window.top;

  const handlePayment = async () => {
    if (!widgetsRef.current || !tossOrderId || !orderId || !checkoutData) return;

    // Lovable 미리보기(iframe) 환경에서는 Toss SDK가 부모 프레임 redirect 권한이 없어 실패함.
    // 게시된(published) URL을 새 탭에서 열도록 안내.
    if (isInIframe) {
      const publishedOrigin = "https://webheads-class.lovable.app";
      window.open(`${publishedOrigin}/checkout`, "_blank", "noopener");
      toast({
        title: "미리보기에서는 결제 테스트가 제한됩니다",
        description: "게시된 사이트가 새 탭에서 열렸습니다. 그곳에서 결제를 진행해 주세요.",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const orderName =
        checkoutData.items.length === 1
          ? checkoutData.items[0].title
          : `${checkoutData.items[0].title} 외 ${checkoutData.items.length - 1}개`;

      await widgetsRef.current.requestPayment({
        orderId: tossOrderId,
        orderName,
        customerEmail: user?.email,
        customerName: profile?.full_name ?? undefined,
        successUrl: `${window.location.origin}/checkout/success?internalOrderId=${orderId}`,
        failUrl: `${window.location.origin}/checkout/fail`,
      });
    } catch (e: any) {
      console.error("Payment request error:", e);
      const msg = String(e?.message || "");
      if (msg.includes("permission to navigate") || msg.includes("Failed to set a named property 'href'")) {
        toast({
          title: "미리보기 환경 제한",
          description: "결제 redirect가 차단되었습니다. 게시된 URL에서 다시 시도해 주세요.",
          variant: "destructive",
        });
      } else if (e.code !== "USER_CANCEL") {
        toast({ title: "결제 요청 실패", description: e.message, variant: "destructive" });
      }
    } finally {
      setIsProcessing(false);
    }
  };


  if (isCreatingOrder) {
    return (
      <div className="min-h-screen bg-background">
        <StorefrontHeader />
        <main className="max-w-5xl mx-auto px-4 py-24 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">주문을 생성하는 중...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <StorefrontHeader />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleClose}
        aria-label="결제 페이지 닫기"
        className="fixed right-4 top-24 z-[1200] rounded-full bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80"
      >
        <X className="h-4 w-4" />
      </Button>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold text-foreground mb-6">결제</h1>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left: Order summary + Payment widget */}
          <div className="lg:col-span-3 space-y-6">
            {/* Order items */}
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">주문 상품</h2>
              <div className="space-y-3">
                {checkoutData?.items.map((item) => (
                  <div key={item.course_id} className="flex gap-3 items-center">
                    <div className="w-16 h-11 rounded overflow-hidden bg-muted flex items-center justify-center shrink-0">
                      {item.thumbnail_url ? (
                        <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-sm text-foreground flex-1 truncate">{item.title}</p>
                    <p className="text-sm font-medium text-foreground shrink-0">
                      {(item.sale_price ?? item.price).toLocaleString()}원
                    </p>
                    {checkoutData.items.length > 1 && (
                      <button
                        onClick={() => handleRemoveItem(item.course_id)}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        aria-label="상품 삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Toss Payment Widget */}
            {tossError ? (
              <Card className="p-6 text-center">
                <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">{tossError}</p>
                <p className="text-xs text-muted-foreground mt-2">관리자에게 문의하세요.</p>
              </Card>
            ) : (
              <Card className="p-5 space-y-4">
                {!isPaymentReady && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>결제 수단을 불러오는 중...</span>
                  </div>
                )}
                <div id="payment-method" className="min-h-[280px]" />
                <div id="agreement" className="min-h-[80px]" />
              </Card>
            )}
          </div>

          {/* Right: Price summary */}
          <div className="lg:col-span-2">
            <Card className="p-6 space-y-4 sticky top-24">
              <h2 className="text-sm font-semibold text-foreground">결제 금액</h2>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">상품 금액</span>
                  <span className="text-foreground">{checkoutData?.totalAmount.toLocaleString()}원</span>
                </div>
                {(checkoutData?.discountAmount ?? 0) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>쿠폰 할인</span>
                    <span>-{checkoutData?.discountAmount.toLocaleString()}원</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-semibold">
                  <span className="text-foreground">총 결제액</span>
                  <span className="text-foreground">{checkoutData?.finalAmount.toLocaleString()}원</span>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                disabled={!isPaymentReady || isProcessing || !!tossError}
                onClick={handlePayment}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                {checkoutData?.finalAmount.toLocaleString()}원 결제하기
              </Button>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CheckoutPage;
