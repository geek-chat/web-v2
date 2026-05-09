/**
 * OAuth callback hash parsing.
 *
 * The backend assembles redirects like:
 *   /auth/success#access_token=...&refresh_token=...
 *   /auth/oauth-link#link_token=...&existing_nickname=...&new_provider=GOOGLE
 *   /auth/oauth-complete#signup_token=...&suggested_nickname=...
 *
 * Note: hash params use snake_case (browser URL fragment convention),
 * while REST JSON DTOs use camelCase. Translation happens in the callback
 * page components — see RULES.md R1.
 *
 * `nickname` fields are URL-encoded server-side via URLEncoder.encode(s, UTF-8).
 * URLSearchParams handles the decode.
 *
 * Hash MUST be cleared from the URL on mount via clearHash() to prevent
 * referer leakage of tokens to third-party scripts.
 */

export type OAuthHash = Record<string, string>;

export function parseHash(): OAuthHash {
  if (typeof window === "undefined") return {};
  const raw = window.location.hash.slice(1);
  if (!raw) return {};
  const out: OAuthHash = {};
  // URLSearchParams decodes percent-encoding for us.
  new URLSearchParams(raw).forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/**
 * Replace the URL with the same path stripped of hash + (optionally) query.
 * Uses replaceState so back-button doesn't return to the token URL.
 */
export function clearHash(targetPath?: string): void {
  if (typeof window === "undefined") return;
  const path = targetPath ?? window.location.pathname + window.location.search;
  window.history.replaceState(null, "", path);
}
