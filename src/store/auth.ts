/**
 * Auth store — single source of truth for the current session in the UI.
 *
 * Lives in Zustand (slice file, no Provider tree per RULES.md R6).
 * The WebSocket and api/client modules read tokens directly from
 * `@/lib/auth/storage` so they don't need to subscribe to this store —
 * keeping non-React code free of React deps.
 *
 * The store reflects what `<AppBoot/>` discovered + any login/logout actions
 * the UI takes. Components subscribe to render auth-aware UI.
 */
import { create } from "zustand";
import type { UserMe, TokenPair } from "@/lib/api/auth";
import * as storage from "@/lib/auth/storage";

export type AuthStatus =
  | "idle" // pre-hydration
  | "loading" // hydrating / verifying via /auth/me
  | "authenticated"
  | "unauthenticated";

interface AuthState {
  status: AuthStatus;
  user: UserMe | null;

  /** Called by AppBoot once on mount. */
  setStatus: (status: AuthStatus) => void;
  setUser: (user: UserMe | null) => void;
  setSession: (tokens: TokenPair, user?: UserMe) => void;
  /** Local-only logout (clears storage + state). Backend POST happens in caller. */
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "idle",
  user: null,

  setStatus: (status) => set({ status }),

  setUser: (user) => set({ user }),

  setSession: (tokens, user) => {
    storage.setTokens(tokens);
    set({
      status: "authenticated",
      ...(user ? { user } : {}),
    });
  },

  clearSession: () => {
    storage.clearTokens();
    set({ status: "unauthenticated", user: null });
  },
}));
