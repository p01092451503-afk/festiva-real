import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function OneTimeLogin() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [message, setMessage] = useState("로그인 처리 중입니다…");

  useEffect(() => {
    const token = params.get("t");
    if (!token || token.length < 32) {
      setStatus("error");
      setMessage("유효하지 않은 로그인 링크입니다.");
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("consume-otl-token", { body: { token } });
        if (error) throw error;
        if (!data?.access_token || !data?.refresh_token) {
          throw new Error(data?.error || "세션을 발급받지 못했습니다");
        }
        const { error: setErr } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        if (setErr) throw setErr;
        setStatus("success");
        setMessage("로그인 완료! 강의 페이지로 이동합니다…");
        setTimeout(() => {
          if (data.course_id) navigate(`/student/courses/${data.course_id}`, { replace: true });
          else navigate("/dashboard", { replace: true });
        }, 800);
      } catch (e: any) {
        setStatus("error");
        setMessage(e?.message || "로그인 링크가 만료되었거나 이미 사용되었습니다.");
      }
    })();
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 shadow-sm text-center space-y-4">
        {status === "loading" && <Loader2 className="w-10 h-10 mx-auto animate-spin text-muted-foreground" />}
        {status === "success" && <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" />}
        {status === "error" && <AlertCircle className="w-10 h-10 mx-auto text-destructive" />}
        <h1 className="text-lg font-semibold">자동 로그인</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        {status === "error" && (
          <button className="text-sm text-primary underline" onClick={() => navigate("/auth")}>
            로그인 페이지로 이동
          </button>
        )}
      </div>
    </div>
  );
}