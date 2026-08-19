import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import StorefrontHeader from "@/components/StorefrontHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

const CheckoutSuccess = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [orderInfo, setOrderInfo] = useState<{
    orderNumber: string;
    finalAmount: number;
    courses: string[];
  } | null>(null);

  useEffect(() => {
    const confirmPayment = async () => {
      const paymentKey = searchParams.get("paymentKey");
      const amount = searchParams.get("amount");
      const orderId = searchParams.get("orderId"); // toss order id
      const internalOrderId = searchParams.get("internalOrderId");

      if (!paymentKey || !amount || !orderId || !internalOrderId) {
        setErrorMessage("결제 정보가 올바르지 않습니다.");
        setStatus("error");
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("toss-payment-confirm", {
          body: {
            paymentKey,
            amount: Number(amount),
            tossOrderId: orderId,
            internalOrderId,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(JSON.stringify(data.error));

        // Fetch order details for display
        const { data: order } = await supabase
          .from("orders")
          .select("order_number, final_amount, order_items(courses(title))")
          .eq("id", internalOrderId)
          .single();

        if (order) {
          setOrderInfo({
            orderNumber: order.order_number,
            finalAmount: order.final_amount,
            courses: (order.order_items || []).map((oi: any) => oi.courses?.title || ""),
          });
        }

        // Clear checkout data
        localStorage.removeItem("checkout_data");

        setStatus("success");
      } catch (e: any) {
        console.error("Payment confirmation error:", e);
        setErrorMessage(e.message || "결제 확인 중 오류가 발생했습니다.");
        setStatus("error");
      }
    };

    confirmPayment();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background">
      <StorefrontHeader />
      <main className="max-w-lg mx-auto px-4 py-24">
        {status === "loading" && (
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mx-auto mb-4" />
            <h1 className="text-lg font-semibold text-foreground">결제 확인 중...</h1>
            <p className="text-sm text-muted-foreground mt-2">잠시만 기다려 주세요.</p>
          </div>
        )}

        {status === "success" && (
          <Card className="p-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-foreground mb-2">결제가 완료되었습니다!</h1>
            <p className="text-sm text-muted-foreground mb-6">수강 등록이 자동으로 처리되었습니다.</p>

            {orderInfo && (
              <div className="text-left bg-muted/50 rounded-lg p-4 mb-6 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">주문 번호</span>
                  <span className="font-medium text-foreground">{orderInfo.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">결제 금액</span>
                  <span className="font-medium text-foreground">{orderInfo.finalAmount.toLocaleString()}원</span>
                </div>
                <div>
                  <span className="text-muted-foreground">구매 강의</span>
                  <ul className="mt-1 space-y-1">
                    {orderInfo.courses.map((c, i) => (
                      <li key={i} className="text-foreground">• {c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <Button asChild variant="outline">
                <Link to="/student">학습 시작</Link>
              </Button>
              <Button asChild>
                <Link to="/store">스토어로 돌아가기</Link>
              </Button>
            </div>
          </Card>
        )}

        {status === "error" && (
          <Card className="p-8 text-center">
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-foreground mb-2">결제 처리 중 오류가 발생했습니다</h1>
            <p className="text-sm text-muted-foreground mb-6">
              {errorMessage || "문제가 지속되면 고객센터로 문의해 주세요."}
            </p>
            <div className="flex gap-3 justify-center">
              <Button asChild variant="outline">
                <Link to="/store/courses">강의 안내로 돌아가기</Link>
              </Button>
              <Button asChild>
                <Link to="/store">스토어로 돌아가기</Link>
              </Button>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
};

export default CheckoutSuccess;
