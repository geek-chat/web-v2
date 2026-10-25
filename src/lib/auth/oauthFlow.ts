/**
 * Marks that this tab started an OAuth flow, so the callback pages can tell a
 * redirect from a flow the user began apart from a crafted link carrying
 * someone else's tokens. sessionStorage is per tab and per origin: another site
 * cannot set it, and the provider round trip returns to the same tab.
 */
import { oauthStartUrl, type OAuthProvider } from "@/lib/api/auth";

const KEY = "oauth_flow_started_at";
// The backend's link and signup tokens live 10 minutes, so an older flow cannot finish anyway.
const TTL_MS = 10 * 60 * 1000;

/** Mark the flow and return the backend URL to navigate to. */
export function startOAuthFlow(provider: OAuthProvider): string {
  window.sessionStorage.setItem(KEY, String(Date.now()));
  return oauthStartUrl(provider);
}

/** True when this tab started an OAuth flow less than 10 minutes ago. */
export function hasPendingOAuthFlow(): boolean {
  if (typeof window === "undefined") return false;
  const startedAt = Number(window.sessionStorage.getItem(KEY));
  const age = Date.now() - startedAt;
  return startedAt > 0 && age >= 0 && age < TTL_MS;
}

/** One flow, one callback: drop the mark once a callback page has used it. */
export function endOAuthFlow(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(KEY);
}
