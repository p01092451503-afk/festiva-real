import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import "vitest-axe/extend-expect";
import UrlFallbackCard, { type UrlFallbackInfo } from "./UrlFallbackCard";

const baseFallback: UrlFallbackInfo = {
  failedUrl: "https://news.example.com/article/12345",
  reason: "Site blocked the request (HTTP 403)",
  code: "BLOCKED",
  httpStatus: 403,
};

// jsdom has no canvas, so disable axe rules that depend on it.
const AXE_OPTIONS = {
  rules: {
    "color-contrast": { enabled: false },
  },
};

async function runAxe(container: HTMLElement) {
  return axe(container, AXE_OPTIONS);
}

function renderCard(overrides: Partial<React.ComponentProps<typeof UrlFallbackCard>> = {}) {
  const props: React.ComponentProps<typeof UrlFallbackCard> = {
    fallback: baseFallback,
    isEn: true,
    retryCount: 0,
    maxRetries: 3,
    retryWaitMs: 0,
    canRetry: true,
    isPending: false,
    onRetry: vi.fn(),
    onSwitchToPaste: vi.fn(),
    onDismiss: vi.fn(),
    ...overrides,
  };
  const utils = render(<UrlFallbackCard {...props} />);
  return { ...utils, props };
}

describe("UrlFallbackCard accessibility", () => {
  beforeEach(() => {
    cleanup();
    vi.useFakeTimers();
  });
  afterEach(() => {
    if (vi.isFakeTimers()) {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    }
    cleanup();
  });

  it("has no axe-core violations (BLOCKED state)", async () => {
    vi.useRealTimers();
    const { container } = renderCard();
    await new Promise((r) => setTimeout(r, 50));
    const results = await runAxe(container);
    (expect(results) as any).toHaveNoViolations();
  });

  it("has no axe-core violations during retry countdown", async () => {
    vi.useRealTimers();
    const { container } = renderCard({ retryWaitMs: 4000, retryCount: 1 });
    await new Promise((r) => setTimeout(r, 50));
    const results = await runAxe(container);
    (expect(results) as any).toHaveNoViolations();
  });

  it("has no axe-core violations when retry exhausted", async () => {
    vi.useRealTimers();
    const { container } = renderCard({
      retryCount: 3,
      canRetry: false,
    });
    await new Promise((r) => setTimeout(r, 50));
    const results = await runAxe(container);
    (expect(results) as any).toHaveNoViolations();
  });

  it("exposes correct ARIA on the live region", () => {
    renderCard();
    const region = screen.getByTestId("url-fallback-card");
    expect(region).toHaveAttribute("role", "region");
    expect(region).toHaveAttribute("aria-live", "assertive");
    expect(region).toHaveAttribute("aria-atomic", "true");
    // labelledby/describedby point to in-card elements
    const labelledBy = region.getAttribute("aria-labelledby");
    const describedBy = region.getAttribute("aria-describedby");
    expect(labelledBy && document.getElementById(labelledBy)).toBeTruthy();
    expect(describedBy && document.getElementById(describedBy)).toBeTruthy();
  });

  it("auto-focuses the first enabled action button on mount", () => {
    renderCard();
    vi.advanceTimersByTime(50);
    // Retry is the first action and is enabled in default props
    const retryBtn = screen.getByRole("button", {
      name: /Retry URL extraction, attempt 1 of 3/i,
    });
    expect(document.activeElement).toBe(retryBtn);
  });

  it("skips disabled retry button and focuses next enabled action", () => {
    renderCard({ canRetry: false, retryCount: 3 });
    vi.advanceTimersByTime(50);
    // Retry is disabled → should focus "Open article" instead
    const openBtn = screen.getByRole("button", {
      name: /Open the failed article URL in a new tab/i,
    });
    expect(document.activeElement).toBe(openBtn);
  });

  it("calls onDismiss when Escape is pressed inside the card", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { props } = renderCard();
    vi.advanceTimersByTime(50);
    await user.keyboard("{Escape}");
    expect(props.onDismiss).toHaveBeenCalledTimes(1);
  });

  it("Tab on last button loops focus back to first (focus trap)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderCard();
    vi.advanceTimersByTime(50);

    const retryBtn = screen.getByRole("button", { name: /Retry URL extraction/i });
    const dismissBtn = screen.getByRole("button", { name: /Dismiss the failure notice/i });

    // Move focus to last button manually
    dismissBtn.focus();
    expect(document.activeElement).toBe(dismissBtn);

    await user.tab();
    expect(document.activeElement).toBe(retryBtn);
  });

  it("Shift+Tab on first button loops focus to last (reverse trap)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderCard();
    vi.advanceTimersByTime(50);

    const retryBtn = screen.getByRole("button", { name: /Retry URL extraction/i });
    const dismissBtn = screen.getByRole("button", { name: /Dismiss the failure notice/i });

    retryBtn.focus();
    expect(document.activeElement).toBe(retryBtn);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(dismissBtn);
  });

  it("retry button announces countdown via aria-label during backoff", () => {
    renderCard({ retryWaitMs: 4000, retryCount: 1 });
    vi.advanceTimersByTime(50);
    const btn = screen.getByRole("button", {
      name: /Retrying in 4 seconds/i,
    });
    expect(btn).toBeDisabled();
  });

  it("retry button announces limit reached when over max", () => {
    renderCard({ canRetry: false, retryCount: 3 });
    vi.advanceTimersByTime(50);
    const btn = screen.getByRole("button", {
      name: /Retry limit reached \(3 attempts\)/i,
    });
    expect(btn).toBeDisabled();
  });

  it("retry button announces non-retryable for INVALID_URL", () => {
    renderCard({
      canRetry: false,
      fallback: { ...baseFallback, code: "INVALID_URL", httpStatus: null },
    });
    vi.advanceTimersByTime(50);
    const btn = screen.getByRole("button", {
      name: /This error type cannot be retried/i,
    });
    expect(btn).toBeDisabled();
  });

  it("error code badge has descriptive aria-label including HTTP status", () => {
    renderCard();
    vi.advanceTimersByTime(50);
    expect(
      screen.getByLabelText(/Error code BLOCKED, HTTP 403/i),
    ).toBeInTheDocument();
  });

  it("renders Korean labels when isEn=false and remains accessible", async () => {
    vi.useRealTimers();
    const { container } = renderCard({ isEn: false });
    await new Promise((r) => setTimeout(r, 50));
    expect(
      screen.getByRole("button", { name: /URL 추출 다시 시도/ }),
    ).toBeInTheDocument();
    const results = await runAxe(container);
    (expect(results) as any).toHaveNoViolations();
  });

  it("clicking retry triggers onRetry callback", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { props } = renderCard();
    vi.advanceTimersByTime(50);
    await user.click(screen.getByRole("button", { name: /Retry URL extraction/i }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });
});
