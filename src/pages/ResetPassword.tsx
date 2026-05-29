import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, ArrowRight, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type SessionStatus = "checking" | "valid" | "invalid";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<SessionStatus>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      try {
        // 1) Hash error (e.g., expired/invalid link)
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const queryParams = new URLSearchParams(window.location.search);
        const hashError = hashParams.get("error_description") || hashParams.get("error");
        const queryError = queryParams.get("error_description") || queryParams.get("error");
        if (hashError || queryError) {
          setErrorMessage(decodeURIComponent(hashError || queryError || ""));
          setStatus("invalid");
          return;
        }

        // 2) PKCE flow: ?code=xxx — exchange for a session
        const code = queryParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (cancelled) return;
          if (error) {
            setErrorMessage(error.message);
            setStatus("invalid");
            return;
          }
          // Clean URL
          window.history.replaceState({}, "", window.location.pathname);
          setStatus("valid");
          return;
        }

        // 3) Implicit/recovery hash flow: #access_token=...&type=recovery
        const type = hashParams.get("type");
        if (type === "recovery" && hashParams.get("access_token")) {
          // Supabase client automatically picks up hash session; just confirm
          const { data } = await supabase.auth.getSession();
          if (cancelled) return;
          if (data.session) {
            window.history.replaceState({}, "", window.location.pathname);
            setStatus("valid");
            return;
          }
        }

        // 4) Already authenticated via PASSWORD_RECOVERY (existing session)
        const { data: sessionData } = await supabase.auth.getSession();
        if (cancelled) return;
        if (sessionData.session) {
          setStatus("valid");
          return;
        }

        setStatus("invalid");
      } catch (err: any) {
        if (cancelled) return;
        setErrorMessage(err?.message || "");
        setStatus("invalid");
      }
    };

    verify();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setStatus("valid");
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({
        title: t("common.error"),
        description: t("auth.resetPasswordMismatch", "비밀번호가 일치하지 않습니다."),
        variant: "destructive",
      });
      return;
    }
    if (password.length < 6) {
      toast({
        title: t("common.error"),
        description: t("auth.errorWeakPassword"),
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({
        title: t("auth.resetPasswordSuccessTitle", "변경 완료"),
        description: t("auth.resetPasswordSuccessDesc", "비밀번호가 성공적으로 변경되었습니다."),
      });
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">{t("auth.resetPasswordVerifying", "재설정 링크를 확인하는 중...")}</p>
        </div>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center space-y-4 max-w-sm">
          <h2 className="text-xl font-semibold text-foreground">{t("auth.resetPassword")}</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-line">
            {t(
              "auth.resetPasswordInvalidLink",
              "유효하지 않거나 만료된 재설정 링크입니다.\n비밀번호 찾기를 다시 진행해 주세요."
            )}
          </p>
          {errorMessage && (
            <p className="text-xs text-muted-foreground/60 break-all">{errorMessage}</p>
          )}
          <Button variant="login" size="xl" onClick={() => navigate("/auth")} className="rounded-full">
            {t("auth.resetPasswordBackToLogin", "로그인으로 돌아가기")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-foreground">
            {t("auth.resetPasswordTitle", "새 비밀번호 설정")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("auth.resetPasswordSubtitle", "새로운 비밀번호를 입력해 주세요.")}
          </p>
        </div>

        <form onSubmit={handleReset} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="password"
              placeholder={t("auth.resetPasswordNewPlaceholder", "새 비밀번호 (6자 이상)")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 pl-11 bg-white border border-border rounded-xl text-sm placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-foreground/20"
              required
              minLength={6}
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="password"
              placeholder={t("auth.resetPasswordConfirmPlaceholder", "비밀번호 확인")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-12 pl-11 bg-white border border-border rounded-xl text-sm placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-foreground/20"
              required
              minLength={6}
            />
          </div>
          <Button type="submit" variant="login" size="xl" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                {t("common.processing")}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                {t("auth.resetPasswordSubmit", "비밀번호 변경")}
                <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
