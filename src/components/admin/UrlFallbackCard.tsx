import { useEffect, useRef } from "react";
import {
  AlertTriangle,
  ClipboardPaste,
  ExternalLink,
  Loader2,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type UrlErrorCode =
  | "INVALID_URL"
  | "TIMEOUT"
  | "DNS_OR_NETWORK"
  | "BLOCKED"
  | "NOT_FOUND"
  | "SERVER_ERROR"
  | "HTTP_ERROR"
  | "UNSUPPORTED_TYPE"
  | "TOO_SHORT"
  | "UNKNOWN";

export interface UrlFallbackInfo {
  failedUrl: string;
  reason: string;
  code: UrlErrorCode;
  httpStatus?: number | null;
}

export interface UrlFallbackCardProps {
  fallback: UrlFallbackInfo;
  isEn: boolean;
  /** Current retry attempt count (0-based: 0 means none used yet) */
  retryCount: number;
  /** Hard cap on retries */
  maxRetries: number;
  /** Remaining backoff wait in ms; > 0 means retry button is in countdown state */
  retryWaitMs: number;
  /** Whether retry should be allowed (false for non-retryable codes / over cap) */
  canRetry: boolean;
  /** Whether outer mutation is currently in flight */
  isPending: boolean;
  onRetry: () => void;
  onSwitchToPaste: () => void;
  onDismiss: () => void;
}

const CODE_MAP: Record<
  UrlErrorCode,
  {
    ko: { title: string; hint: string; tag: string };
    en: { title: string; hint: string; tag: string };
  }
> = {
  INVALID_URL: {
    ko: { tag: "URL 형식 오류", title: "올바른 URL이 아닙니다", hint: "주소가 http:// 또는 https://로 시작하는지 확인하고 다시 시도해 주세요." },
    en: { tag: "Invalid URL", title: "URL format is invalid", hint: "Make sure the URL starts with http:// or https:// and try again." },
  },
  TIMEOUT: {
    ko: { tag: "응답 지연", title: "사이트 응답이 너무 느립니다", hint: "대상 서버가 응답하지 않습니다(12초 초과). 잠시 후 재시도하거나 본문을 직접 붙여넣어 주세요." },
    en: { tag: "Timeout", title: "The site is too slow to respond", hint: "Origin did not respond within 12s. Retry later, or paste the article body directly." },
  },
  DNS_OR_NETWORK: {
    ko: { tag: "네트워크 오류", title: "사이트에 접속할 수 없습니다", hint: "도메인 이름을 확인할 수 없거나 네트워크 오류가 발생했습니다. 주소를 다시 확인해 주세요." },
    en: { tag: "Network error", title: "Couldn't reach the site", hint: "DNS or network error. Verify the URL and try again." },
  },
  BLOCKED: {
    ko: { tag: "접근 차단", title: "사이트가 자동 수집을 차단했습니다", hint: "많은 뉴스/매체가 봇을 막습니다. 원문을 열어 본문을 복사한 뒤 텍스트로 붙여넣어 주세요." },
    en: { tag: "Blocked", title: "The site blocked automatic extraction", hint: "Many publishers block bots. Open the article, copy the body text, and paste it instead." },
  },
  NOT_FOUND: {
    ko: { tag: "페이지 없음", title: "기사를 찾을 수 없습니다", hint: "URL이 만료되었거나 잘못 입력되었을 수 있습니다. 주소를 다시 확인해 주세요." },
    en: { tag: "Not found", title: "Article not found", hint: "The URL may be expired or mistyped. Check and retry." },
  },
  SERVER_ERROR: {
    ko: { tag: "원본 서버 오류", title: "원본 사이트에서 오류가 발생했습니다", hint: "사이트 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도하거나 본문을 붙여넣어 주세요." },
    en: { tag: "Origin error", title: "The source site returned a server error", hint: "Temporary issue on the origin. Retry later or paste the body directly." },
  },
  HTTP_ERROR: {
    ko: { tag: "HTTP 오류", title: "예상치 못한 HTTP 응답", hint: "비표준 응답을 받았습니다. 본문을 직접 붙여넣어 진행하세요." },
    en: { tag: "HTTP error", title: "Unexpected HTTP response", hint: "Got a non-standard response. Paste the body to continue." },
  },
  UNSUPPORTED_TYPE: {
    ko: { tag: "지원되지 않는 형식", title: "HTML 페이지가 아닙니다", hint: "PDF·이미지·동영상 등은 URL이 아닌 PDF/이미지 탭으로 업로드해 주세요." },
    en: { tag: "Unsupported type", title: "Not an HTML page", hint: "For PDFs/images/videos, use the PDF or Image tab instead." },
  },
  TOO_SHORT: {
    ko: { tag: "본문 추출 실패", title: "본문을 충분히 가져오지 못했습니다", hint: "이 사이트는 JavaScript로 본문을 렌더링하거나 로그인이 필요한 것 같습니다. 본문을 복사해 텍스트 탭에 붙여넣어 주세요." },
    en: { tag: "Too little content", title: "Couldn't extract enough text", hint: "Likely JS-rendered or login-walled. Copy the article body and paste into the Text tab." },
  },
  UNKNOWN: {
    ko: { tag: "알 수 없는 오류", title: "URL을 처리하지 못했습니다", hint: "원인을 특정하지 못했습니다. 본문을 직접 붙여넣어 진행하세요." },
    en: { tag: "Unknown error", title: "Failed to process this URL", hint: "Couldn't identify the cause. Paste the body to continue." },
  },
};

/**
 * Accessible recovery card shown when URL crawling fails.
 *
 * A11y contract (covered by UrlFallbackCard.test.tsx):
 *  - role="region" + aria-live="assertive" + aria-atomic="true"
 *  - aria-labelledby/-describedby wired to title + hint
 *  - Auto-focuses first enabled action on mount / code change
 *  - Esc dismisses
 *  - Tab loops between focusable actions (soft focus trap)
 *  - Action buttons expose status-aware aria-label
 */
export default function UrlFallbackCard({
  fallback,
  isEn,
  retryCount,
  maxRetries,
  retryWaitMs,
  canRetry,
  isPending,
  onRetry,
  onSwitchToPaste,
  onDismiss,
}: UrlFallbackCardProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const headingId = "url-fallback-heading";
  const descId = "url-fallback-desc";

  // Focus first enabled button when fallback appears or its code changes.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const root = rootRef.current;
      if (!root) return;
      const firstBtn = root.querySelector<HTMLButtonElement>(
        "button:not([disabled])",
      );
      firstBtn?.focus();
    }, 30);
    return () => window.clearTimeout(t);
  }, [fallback.code, fallback.failedUrl]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onDismiss();
      return;
    }
    if (e.key !== "Tab") return;
    const root = rootRef.current;
    if (!root) return;
    const focusables = Array.from(
      root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute("aria-hidden"));
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const c = CODE_MAP[fallback.code]?.[isEn ? "en" : "ko"] ?? CODE_MAP.UNKNOWN[isEn ? "en" : "ko"];
  const retryDisabled = !canRetry || retryWaitMs > 0 || isPending;

  return (
    <div
      ref={rootRef}
      role="region"
      aria-label={isEn ? "URL extraction failed — recovery options" : "URL 추출 실패 — 복구 옵션"}
      aria-labelledby={headingId}
      aria-describedby={descId}
      aria-live="assertive"
      aria-atomic="true"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      data-testid="url-fallback-card"
      className="mt-3 border-2 border-border/80 rounded-md p-4 bg-muted/30 space-y-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle aria-hidden="true" className="h-4 w-4 mt-0.5 text-foreground shrink-0" />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="inline-flex items-center rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground"
              aria-label={
                isEn
                  ? `Error code ${fallback.code}${fallback.httpStatus ? `, HTTP ${fallback.httpStatus}` : ""}`
                  : `오류 코드 ${fallback.code}${fallback.httpStatus ? `, HTTP ${fallback.httpStatus}` : ""}`
              }
            >
              {fallback.code}
              {fallback.httpStatus ? ` · ${fallback.httpStatus}` : ""}
            </span>
            <span className="text-xs text-muted-foreground">{c.tag}</span>
          </div>
          <p id={headingId} className="text-sm font-semibold">{c.title}</p>
          <p className="text-xs text-muted-foreground break-all">
            <span className="sr-only">{isEn ? "Failed URL: " : "실패한 URL: "}</span>
            {fallback.failedUrl}
          </p>
          <p id={descId} className="text-xs text-muted-foreground pt-1">{c.hint}</p>
          {fallback.reason && fallback.reason !== c.title && (
            <p className="text-[11px] text-muted-foreground/80 italic pt-0.5">
              <span className="sr-only">{isEn ? "Technical detail: " : "기술적 상세: "}</span>
              — {fallback.reason}
            </p>
          )}
        </div>
      </div>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={isEn ? "Recovery actions" : "복구 작업"}
      >
        <Button
          type="button"
          size="sm"
          variant="default"
          onClick={onRetry}
          disabled={retryDisabled}
          aria-label={
            retryWaitMs > 0
              ? isEn
                ? `Retrying in ${Math.ceil(retryWaitMs / 1000)} seconds`
                : `${Math.ceil(retryWaitMs / 1000)}초 후 자동 재시도`
              : !canRetry
              ? isEn
                ? retryCount >= maxRetries
                  ? `Retry limit reached (${maxRetries} attempts)`
                  : "This error type cannot be retried"
                : retryCount >= maxRetries
                ? `재시도 한도 도달 — 최대 ${maxRetries}회`
                : "이 오류는 재시도할 수 없습니다"
              : isEn
              ? `Retry URL extraction, attempt ${retryCount + 1} of ${maxRetries}`
              : `URL 추출 다시 시도 — ${retryCount + 1}/${maxRetries}회`
          }
        >
          {retryWaitMs > 0 ? (
            <Loader2 aria-hidden="true" className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <RotateCw aria-hidden="true" className="h-3.5 w-3.5 mr-1" />
          )}
          <span aria-hidden="true">
            {retryWaitMs > 0
              ? isEn
                ? `Retrying in ${Math.ceil(retryWaitMs / 1000)}s…`
                : `${Math.ceil(retryWaitMs / 1000)}초 후 재시도…`
              : !canRetry
              ? isEn
                ? retryCount >= maxRetries
                  ? `Retry limit reached (${maxRetries})`
                  : "Not retryable"
                : retryCount >= maxRetries
                ? `재시도 한도 도달 (${maxRetries}회)`
                : "이 오류는 재시도할 수 없습니다"
              : isEn
              ? `Retry (${retryCount}/${maxRetries})`
              : `다시 시도 (${retryCount}/${maxRetries})`}
          </span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            window.open(fallback.failedUrl, "_blank", "noopener,noreferrer");
          }}
          aria-label={isEn ? "Open the failed article URL in a new tab" : "실패한 원문 URL을 새 탭에서 열기"}
        >
          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 mr-1" />
          <span aria-hidden="true">{isEn ? "Open article" : "원문 열기"}</span>
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSwitchToPaste}
          aria-label={isEn ? "Switch to text paste mode and focus the body input" : "본문 직접 붙여넣기 모드로 전환하고 입력란에 포커스"}
        >
          <ClipboardPaste aria-hidden="true" className="h-3.5 w-3.5 mr-1" />
          <span aria-hidden="true">{isEn ? "Switch to paste mode" : "본문 붙여넣기로 전환"}</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          aria-label={isEn ? "Dismiss the failure notice and return to URL input" : "실패 알림 닫고 URL 입력으로 돌아가기"}
        >
          <span aria-hidden="true">{isEn ? "Dismiss" : "닫기"}</span>
        </Button>
      </div>
    </div>
  );
}
