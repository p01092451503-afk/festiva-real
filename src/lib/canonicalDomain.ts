/**
 * Canonical production domain for this app.
 * All auth redirects (password reset, email verification, OAuth callbacks)
 * and all user-facing entry links should use this origin in production.
 */
export const PRODUCTION_ORIGIN = "https://demo.webheads.co.kr";
export const PRODUCTION_HOST = "demo.webheads.co.kr";

/**
 * Hosts that should automatically redirect to PRODUCTION_HOST when a real
 * end-user lands on them. The internal preview host is intentionally excluded
 * — it is used by editors/admins to QA the app and must remain accessible.
 */
const REDIRECTABLE_HOSTS = new Set<string>([
  "webheads-saas.lovable.app", // published preview fallback
  "www.demo.webheads.co.kr",   // www variant of canonical domain
]);

/**
 * Returns the origin that should be used for any auth-related redirect URL
 * that will be embedded in an email (password reset, magic link, etc.).
 *
 * - On localhost / 127.0.0.1: return the current origin so local dev still works.
 * - On the internal preview host: return PRODUCTION_ORIGIN so emails always
 *   point to the real production domain (preview links can't be opened by
 *   end users anyway).
 * - Everywhere else: return PRODUCTION_ORIGIN.
 */
export const getAuthRedirectOrigin = (): string => {
  if (typeof window === "undefined") return PRODUCTION_ORIGIN;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return window.location.origin;
  return PRODUCTION_ORIGIN;
};

/**
 * If the current page is being viewed on a host that should be unified to
 * the canonical production domain, redirect there preserving the current
 * path, query string, and hash. No-op for localhost and the internal
 * preview/editor host.
 */
export const enforceCanonicalDomain = (): void => {
  if (typeof window === "undefined") return;
  const host = window.location.hostname;
  if (!REDIRECTABLE_HOSTS.has(host)) return;
  const target = `${PRODUCTION_ORIGIN}${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(target);
};
