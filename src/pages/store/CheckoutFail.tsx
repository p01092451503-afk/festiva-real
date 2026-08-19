import StorefrontHeader from "@/components/StorefrontHeader";
import { XCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";

const CheckoutFail = () => {
  const [params] = useSearchParams();
  const message = params.get("message") || "결제 처리 중 문제가 발생했습니다.";

  return (
    <div className="min-h-screen bg-background">
      <StorefrontHeader />
      <main className="max-w-7xl mx-auto px-4 py-24 text-center">
        <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-foreground">결제 실패</h1>
        <p className="text-muted-foreground mt-2 mb-8">{message}</p>
        <div className="flex gap-3 justify-center">
          <Button asChild variant="outline"><Link to="/store/courses">강의 안내로 돌아가기</Link></Button>
          <Button asChild><Link to="/store">스토어로 돌아가기</Link></Button>
        </div>
      </main>
    </div>
  );
};

export default CheckoutFail;
