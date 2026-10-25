/**
 * Auth store — single source of truth for the current session in the UI.
 *
 * Lives in Zustand (slice file, no Provider tree per RULES.md R6).
 * The WebSocket and api/client modules read tokens directly from
 * `@/lib/auth/storage` so they don't need to subscribe to this store —
 * keeping non-React code free of React deps.
 *
 * `src/lib/auth/session.ts` drives the status from /auth/me; logout and
 * withdraw call `clearSession()`. Components subscribe to render auth-aware UI.
 */
import { create } from "zustand";
import type { UserMe } from "@/lib/api/auth";
import * as storage from "@/lib/auth/storage";

export type AuthStatus =
  | "idle" // pre-hydration
  | "loading" // verifying via /auth/me
  | "authenticated"
  | "unauthenticated"
  | "offline"; // tokens kept, but /auth/me failed for a non-auth reason (network, 5xx)

interface AuthState {
  status: AuthStatus;
  user: UserMe | null;

  setStatus: (status: AuthStatus) => void;
  setUser: (user: UserMe | null) => void;
  /** Local-only logout (clears storage + state). Backend POST happens in caller. */
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "idle",
  user: null,

  setStatus: (status) => set({ status }),

  setUser: (user) => set({ user }),

  clearSession: () => {
    storage.clearTokens();
    set({ status: "unauthenticated", user: null });
  },
}));
