import { useEffect, useState, useSyncExternalStore } from "react";
import { clearHash, parseHash, type OAuthHash } from "./oauthCallback";
import { endOAuthFlow, hasPendingOAuthFlow } from "./oauthFlow";

const subscribeNever = () => () => {};

/**
 * Reads the OAuth callback fragment once and strips it from the URL
 * (RULES.md R1). Callback pages use this instead of calling parseHash()
 * themselves, so none of them can forget to clear the tokens from the URL.
 *
 * A fragment counts only when this tab started an OAuth flow (oauthFlow.ts).
 * Otherwise it may be a crafted link carrying someone else's tokens, so the
 * hook returns an empty object and the page goes to /auth/error.
 *
 * Returns null on the server and during hydration, so the prerendered HTML and
 * the first client render match. The state initializer captures the fragment
 * on that first client render, before the effect below clears it and ends the
 * flow. Strict Mode running the initializer or the effect twice is harmless:
 * one only reads, the other is idempotent.
 */
export function useOAuthHash(): OAuthHash | null {
  const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false);
  const [hash] = useState<OAuthHash>(() => (hasPendingOAuthFlow() ? parseHash() : {}));
  useEffect(() => {
    clearHash();
    endOAuthFlow();
  }, []);
  return hydrated ? hash : null;
}
