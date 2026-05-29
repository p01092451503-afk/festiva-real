import { useState } from "react";
import { Download } from "lucide-react";
import { useAppVersionCheck } from "@/hooks/useAppVersionCheck";
import { Button } from "@/components/ui/button";

/**
 * Floating banner that appears once a newer build is detected on the server.
 *
 * UX rules:
 * - The app NEVER auto-reloads in the background. The new bundle only
 *   becomes active when the user explicitly taps "업데이트 적용".
 * - The banner is non-blocking: it sits above content but does not steal
 *   focus or interrupt whatever the user is doing.
 * - Once dismissed via the apply button it does not re-appear in the same
 *   tab session, even if further version polls keep returning a newer
 *   version (the reload itself resolves the mismatch on next load).
 */
const AppUpdateBanner = () => {
  const { hasUpdate, reload } = useAppVersionCheck();
  const [applying, setApplying] = useState(false);

  if (!hasUpdate) return null;

  const handleApply = () => {
    setApplying(true);
    // Defer the reload one tick so the button can show its loading state
    // before the page tears down — gives the user clear feedback that
    // their tap was received.
    window.setTimeout(reload, 50);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-[100] -translate-x-1/2 px-4 w-full max-w-md"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/95 backdrop-blur px-4 py-3 shadow-lg">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-gradient-to-br from-muted/60 to-background">
          <Download className="h-4 w-4 text-foreground/80" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            새 버전이 준비되었어요
          </p>
          <p className="text-xs text-muted-foreground">
            준비된 업데이트는 버튼을 누를 때만 적용돼요.
          </p>
        </div>
        <Button
          size="sm"
          className="rounded-full"
          onClick={handleApply}
          disabled={applying}
        >
          {applying ? "적용 중…" : "업데이트 적용"}
        </Button>
      </div>
    </div>
  );
};

export default AppUpdateBanner;