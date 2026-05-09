/**
 * Token storage. localStorage-backed because OAuth fragments hand the token
 * to JS first — only JS-accessible storage will see it.
 *
 * XSS surface is mitigated by the strict CSP in next.config.ts (no inline
 * scripts, no eval). RULES.md R1 is the source of truth for this trade-off.
 *
 * SSR safety: every accessor checks `typeof window` so nothing throws during
 * server rendering. Reads return null on the server.
 */

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

function isClient(): boolean {
  return typeof window !== "undefined";
}

export function getAccessToken(): string | null {
  if (!isClient()) return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (!isClient()) return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function setTokens(tokens: TokenPair): void {
  if (!isClient()) return;
  window.localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

export function clearTokens(): void {
  if (!isClient()) return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

export function hasTokens(): boolean {
  return getAccessToken() !== null && getRefreshToken() !== null;
}
