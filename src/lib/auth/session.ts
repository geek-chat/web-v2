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

// Bumped by every verify. A verify that finishes after a newer one started
// leaves the store alone: the latest start wins, not the latest finish. This
// matters when AppBoot's boot check is still running on the old tokens while
// an OAuth callback or a login stores and verifies a new pair.
let generation = 0;

/** Never throws; the outcome lands in the auth store. */
export async function verifySession(): Promise<void> {
  const gen = ++generation;
  const store = useAuthStore.getState();
  if (!hasTokens()) {
    store.clearSession();
    return;
  }
  store.setStatus("loading");
  try {
    const user = await me();
    // Also skip when a logout cleared the tokens while /auth/me was in flight.
    if (gen !== generation || !hasTokens()) return;
    store.setUser(user);
    store.setStatus("authenticated");
  } catch (err) {
    if (gen !== generation) return;
    if (isTerminalAuthError(err) || !hasTokens()) {
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
