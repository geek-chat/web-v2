/**
 * Session lifecycle: verify the stored tokens with /auth/me and keep the auth
 * store in sync.
 *
 * Only a definitive auth failure ends the session. Anything else (network
 * error, 5xx, a Render free instance waking up) keeps the tokens and reports
 * "offline", so the UI can offer a retry instead of silently logging the user
 * out (RULES.md R1).
 */
import { me } from "@/lib/api/auth";
import { ApiError, AuthExpiredError } from "@/lib/api/client";
import { hasTokens, setTokens, type TokenPair } from "@/lib/auth/storage";
import { useAuthStore } from "@/store/auth";

// 401 survived a refresh, 403 withdrawn account, 404 the user is gone.
const TERMINAL_STATUSES = new Set([401, 403, 404]);

export function isTerminalAuthError(err: unknown): boolean {
  if (err instanceof AuthExpiredError) return true;
  return err instanceof ApiError && TERMINAL_STATUSES.has(err.status);
}

/** Never throws; the outcome lands in the auth store. */
export async function verifySession(): Promise<void> {
  const store = useAuthStore.getState();
  if (!hasTokens()) {
    store.clearSession();
    return;
  }
  store.setStatus("loading");
  try {
    const user = await me();
    store.setUser(user);
    store.setStatus("authenticated");
  } catch (err) {
    if (isTerminalAuthError(err)) {
      store.clearSession();
    } else {
      store.setStatus("offline");
    }
  }
}

/** Use after login, signup, or an OAuth callback hands over a token pair. */
export async function startSession(tokens: TokenPair): Promise<void> {
  setTokens(tokens);
  await verifySession();
}
