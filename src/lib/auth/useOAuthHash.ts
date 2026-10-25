import { useEffect, useState, useSyncExternalStore } from "react";
import { clearHash, parseHash, type OAuthHash } from "./oauthCallback";

const subscribeNever = () => () => {};

/**
 * Reads the OAuth callback fragment once and strips it from the URL
 * (RULES.md R1). Callback pages use this instead of calling parseHash()
 * themselves, so none of them can forget to clear the tokens from the URL.
 *
 * Returns null on the server and during hydration, so the prerendered HTML and
 * the first client render match. The state initializer captures the fragment
 * on that first client render, before the effect below clears it. Strict Mode
 * running the initializer or the effect twice is harmless: one is a pure read,
 * the other an idempotent replaceState.
 */
export function useOAuthHash(): OAuthHash | null {
  const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false);
  const [hash] = useState(parseHash);
  useEffect(() => {
    clearHash();
  }, []);
  return hydrated ? hash : null;
}
