import { useState, useEffect, memo } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail, ArrowRight, Building2, AlertCircle, Image as ImageIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import LanguageToggle from "@/components/LanguageToggle";
import LoginVisualPanel from "@/components/auth/LoginVisualPanel";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useDemoPreset } from "@/contexts/DemoPresetContext";
import { getAuthRedirectOrigin } from "@/lib/canonicalDomain";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const SAVED_EMAIL_KEY = "webheads_saved_email";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { data: siteSettings } = useSiteSettings();
  const { activePreset } = useDemoPreset();
  const b2cDisabled = siteSettings?.b2c_enabled === false;
  const [email, setEmail] = useState("test@test.co.kr");
  const [password, setPassword] = useState("test1234");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [authError, setAuthError] = useState<{
    title: string;
    message: string;
    showForgotPassword?: boolean;
  } | null>(null);

  type AuthContext = "login" | "signup" | "reset";

  const mapAuthError = (
    error: any,
    context: AuthContext = "login"
  ): { title: string; message: string; showForgotPassword?: boolean } => {
    const raw = (error?.message || "").toString();
    const code = (error?.code || "").toString();
    const status: number | undefined = error?.status;
    const lower = raw.toLowerCase();

    const titleByContext =
      context === "signup"
        ? t("auth.errorTitleSignUp")
        : context === "reset"
        ? t("auth.errorTitleReset")
        : t("auth.errorTitle");

    // Network / fetch — check first because it's transport-level
    if (
      lower.includes("failed to fetch") ||
      lower.includes("networkerror") ||
      lower.includes("network request failed") ||
      lower.includes("load failed")
    ) {
      return { title: titleByContext, message: t("auth.errorNetwork") };
    }

    // Server-side outage (5xx)
    if (typeof status === "number" && status >= 500 && status < 600) {
      return { title: titleByContext, message: t("auth.errorServer") };
    }

    // Rate limit
    if (status === 429 || code === "over_request_rate_limit" || lower.includes("too many")) {
      return { title: titleByContext, message: t("auth.errorTooManyRequests") };
    }

    // Sign-up disabled by admin policy
    if (code === "signup_disabled" || lower.includes("signups not allowed") || lower.includes("signup is disabled")) {
      return { title: titleByContext, message: t("auth.errorSignupDisabled") };
    }

    // Sign-up: email already registered
    if (
      code === "user_already_exists" ||
      lower.includes("user already registered") ||
      lower.includes("already registered") ||
      lower.includes("already been registered")
    ) {
      return {
        title: titleByContext,
        message: t("auth.errorEmailExists"),
        showForgotPassword: true,
      };
    }

    // Email not confirmed
    if (code === "email_not_confirmed" || lower.includes("email not confirmed")) {
      return { title: titleByContext, message: t("auth.errorEmailNotConfirmed") };
    }

    // Weak password
    if (
      code === "weak_password" ||
      lower.includes("password should be") ||
      lower.includes("weak password") ||
      lower.includes("password is too short")
    ) {
      return { title: titleByContext, message: t("auth.errorWeakPassword") };
    }

    // Invalid email format
    if (
      code === "validation_failed" ||
      code === "email_address_invalid" ||
      lower.includes("unable to validate email") ||
      lower.includes("invalid email") ||
      lower.includes("email address") && lower.includes("invalid")
    ) {
      return { title: titleByContext, message: t("auth.errorEmailInvalid") };
    }

    // Reset-password: user not found
    if (
      context === "reset" &&
      (code === "user_not_found" || lower.includes("user not found") || lower.includes("no user"))
    ) {
      return { title: titleByContext, message: t("auth.errorResetEmailNotFound") };
    }

    // Invalid credentials — Supabase doesn't distinguish wrong password vs. no user for security.
    if (
      code === "invalid_credentials" ||
      lower.includes("invalid login credentials") ||
      lower.includes("invalid credentials")
    ) {
      return {
        title: titleByContext,
        message: t("auth.errorInvalidCredentials"),
        showForgotPassword: true,
      };
    }

    return { title: titleByContext, message: raw || t("auth.errorGeneric") };
  };

  useEffect(() => {
    supabase.from("departments").select("id, name, name_en, is_active").eq("is_active", true).order("display_order").order("name").then(({ data }) => {
      if (data) setBranches(data);
    });
  }, []);

  useEffect(() => {
    const savedEmail = localStorage.getItem(SAVED_EMAIL_KEY);
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);




  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    // Clear any prior error so the notice slot returns to its default state
    // before we evaluate the new submission.
    setAuthError(null);
    if (!email.trim() || !password) {
      setAuthError({
        title: isSignUp ? t("auth.errorTitleSignUp") : t("auth.errorTitle"),
        message: t("auth.errorMissingFields"),
      });
      return;
    }
    setIsLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: fullName, department_id: selectedBranch || undefined } },
        });
        if (error) throw error;
        toast({ title: t("auth.signUpComplete"), description: t("auth.checkEmail") });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (rememberMe) {
          localStorage.setItem(SAVED_EMAIL_KEY, email);
        } else {
          localStorage.removeItem(SAVED_EMAIL_KEY);
        }
        navigate("/dashboard");
      }
    } catch (error: any) {
      setAuthError(mapAuthError(error, isSignUp ? "signup" : "login"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-[100dvh]"
      style={{
        // Respect iOS notch / status-bar so the form's logo + heading
        // don't sit underneath the system clock when launched as a PWA
        // ("Add to Home Screen") on iPhones.
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Left - Visual Panel */}
      <LoginVisualPanel
        brandName="festcert"
        tagline={t("auth.heroTitle")}
        accentColor="223 69% 33%"
      />

      {/* Right - Form */}
      <div className="flex-1 flex items-start lg:items-center justify-center px-6 lg:px-16 py-10 lg:py-0 bg-white relative">
        {/* Language toggle */}
        <div className="absolute top-4 right-4">
          <LanguageToggle />
        </div>

        <div className="w-full max-w-md space-y-10">
          {activePreset?.login_form_logo_url ? (
            <img
              src={activePreset.login_form_logo_url}
              alt={activePreset.login_form_brand_name || activePreset.brand_name || "Brand"}
              className="h-[2.6rem] w-auto object-contain mx-auto"
            />
          ) : activePreset?.login_form_brand_name || activePreset?.brand_name ? (
            <div className="h-[2.6rem] flex items-center justify-center text-2xl font-semibold tracking-wide text-foreground">
              {activePreset.login_form_brand_name || activePreset.brand_name}
            </div>
          ) : (
            <div className="h-[2.6rem] flex items-baseline justify-center text-3xl font-bold tracking-tight">
              <span className="text-navy">fest</span>
              <span className="text-brand-orange">cert</span>
            </div>
          )}

          <div className="space-y-2 !mt-20">
            <h2 className="text-2xl font-semibold text-foreground">
              {isSignUp ? t("auth.createAccount") : t("auth.login")}
            </h2>
          </div>

          {/*
           * Status banner rules:
           * - idle  : show internal-only notice (when b2c is disabled, login mode)
           * - loading: hide entirely to reduce noise
           * - error  : reuse the same slot with destructive tone for consistent feedback
           * - success: page navigates away, no banner needed
           */}
          {!isSignUp && !isLoading && authError && (
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-destructive/5 border border-destructive/30"
            >
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs font-medium text-destructive">
                  {authError.title}
                </p>
                <p className="text-xs text-destructive/80 leading-relaxed break-words">
                  {authError.message}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-4">
              {isSignUp && (
                <div className="space-y-2">
                  <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("auth.name")}</label>
                  <Input type="text" name="name" autoComplete="name" placeholder={t("auth.namePlaceholder")} value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-12 bg-white border border-border rounded-xl text-sm placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-foreground/20" required />
                </div>
              )}
              {isSignUp && branches.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("auth.branch")}</label>
                  <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className="flex h-12 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/20">
                    <option value="">{t("auth.selectBranch")}</option>
                    {branches.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("auth.email")}</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    name="email"
                    id="auth-email"
                    autoComplete={isSignUp ? "email" : "username"}
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 pl-11 bg-white border border-border rounded-xl text-sm placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-foreground/20"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("auth.password")}</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    id="auth-password"
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    placeholder={t("auth.passwordPlaceholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 pl-11 pr-11 bg-white border border-border rounded-xl text-sm placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-foreground/20"
                    required
                    minLength={6}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {!isSignUp && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-border text-foreground focus:ring-foreground/20" />
                  <span className="text-sm text-muted-foreground">{t("auth.rememberMe")}</span>
                </label>
                <button type="button" onClick={() => { setShowForgotPassword(true); setResetEmail(email); }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {t("auth.forgotPassword")}
                </button>
              </div>
            )}

            <Button type="submit" variant="login" size="xl" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  {t("common.processing")}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {isSignUp ? t("auth.signUp") : t("auth.login")}
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="text-center space-y-3">
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {isSignUp ? t("auth.haveAccount") : t("auth.noAccount")}
            </button>
            <p className="text-xs text-muted-foreground/60">{t("auth.platformFooter")}</p>
          </div>
        </div>
      </div>

      {showForgotPassword && (
        <ForgotPasswordModal
          resetEmail={resetEmail}
          setResetEmail={setResetEmail}
          isResetting={isResetting}
          onClose={() => setShowForgotPassword(false)}
          onSubmit={async () => {
            if (!resetEmail.trim()) {
              setAuthError({
                title: t("auth.errorTitleReset"),
                message: t("auth.errorMissingFields"),
              });
              return;
            }
            setIsResetting(true);
            try {
              const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                redirectTo: `${getAuthRedirectOrigin()}/reset-password`,
              });
              if (error) throw error;
              toast({ title: t("auth.emailSent"), description: t("auth.resetLinkSent") });
              setShowForgotPassword(false);
            } catch (error: any) {
              setShowForgotPassword(false);
              setAuthError(mapAuthError(error, "reset"));
            } finally {
              setIsResetting(false);
            }
          }}
        />
      )}

      {/*
       * Dialog is reserved for errors that need a follow-up action
       * (e.g. invalid credentials → "Forgot password?"). All other errors
       * surface as an inline banner above the form to avoid blocking the
       * user with a modal.
       */}
      <AlertDialog
        open={!!authError?.showForgotPassword}
        onOpenChange={(open) => !open && setAuthError(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-destructive/30 bg-gradient-to-br from-destructive/15 to-background">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1 space-y-2">
                <AlertDialogTitle>{authError?.title}</AlertDialogTitle>
                <AlertDialogDescription className="whitespace-pre-line leading-relaxed">
                  {authError?.message}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            {authError?.showForgotPassword && (
              <AlertDialogCancel
                onClick={() => {
                  setAuthError(null);
                  setResetEmail(email);
                  setShowForgotPassword(true);
                }}
              >
                {t("auth.errorForgotPasswordCta")}
              </AlertDialogCancel>
            )}
            <AlertDialogAction onClick={() => setAuthError(null)}>
              {t("auth.errorTryAgain")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const ForgotPasswordModal = ({ resetEmail, setResetEmail, isResetting, onClose, onSubmit }: {
  resetEmail: string; setResetEmail: (v: string) => void; isResetting: boolean; onClose: () => void; onSubmit: () => void;
}) => {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-background rounded-2xl p-8 w-full max-w-sm space-y-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-foreground">{t("auth.forgotPassword")}</h3>
          <p className="text-sm text-muted-foreground">{t("auth.forgotPasswordDesc")}</p>
        </div>
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="email"
            name="reset-email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="name@example.com"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            className="h-12 pl-11 bg-white border border-border rounded-xl text-sm placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-foreground/20"
            required
          />
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1 rounded-full" onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="button" variant="login" size="xl" className="flex-1" disabled={isResetting || !resetEmail} onClick={onSubmit}>
            {isResetting ? t("auth.sending") : t("auth.sendResetLink")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
