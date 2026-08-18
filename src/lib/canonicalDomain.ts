/**
 * Canonical production domain for this app.
 * All auth redirects (password reset, email verification, OAuth callbacks)
 * and all user-facing entry links should use this origin in production.
 */
// TODO(festcert): 고객사 도메인 확정 후 아래 값을 실제 도메인으로 교체.
//   export const PRODUCTION_ORIGIN = "https://festcert.co.kr";
//   export const PRODUCTION_HOST = "festcert.co.kr";
// 확정 전까지는 현재 접속 중인 오리진을 그대로 사용한다(리다이렉트 없음).
export const PRODUCTION_ORIGIN = "";
export const PRODUCTION_HOST = "";

/**
 * Hosts that should automatically redirect to PRODUCTION_HOST when a real
 * end-user lands on them. Empty until the festcert domain is confirmed.
 */
const REDIRECTABLE_HOSTS = new Set<string>([]);

/**
 * Origin used for auth-related redirect URLs embedded in emails
 * (password reset, magic link, etc.). Falls back to the current origin while
 * no canonical production domain is configured.
 */
export const getAuthRedirectOrigin = (): string => {
  if (typeof window === "undefined") return PRODUCTION_ORIGIN;
  if (!PRODUCTION_ORIGIN) return window.location.origin;
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
