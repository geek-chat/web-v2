"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { hasTokens } from "@/lib/auth/storage";
import { me } from "@/lib/api/auth";
import { AuthExpiredError } from "@/lib/api/client";
import { tError } from "@/i18n";

/**
 * Mounts once at the root via layout.tsx. Performs:
 *  1. localStorage hydration check
 *  2. /auth/me verification (rejects stale tokens)
 *  3. global 'auth:logout' listener — fired by api/client when refresh fails
 *
 * Renders nothing.
 */
export default function AppBoot() {
  const setStatus = useAuthStore((s) => s.setStatus);
  const setUser = useAuthStore((s) => s.setUser);
  const clearSession = useAuthStore((s) => s.clearSession);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (!hasTokens()) {
        if (!cancelled) setStatus("unauthenticated");
        return;
      }
      setStatus("loading");
      try {
        const user = await me();
        if (cancelled) return;
        setUser(user);
        setStatus("authenticated");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof AuthExpiredError) {
          // api/client already cleared tokens; sync store.
          clearSession();
        } else {
          // Unknown error during /auth/me. Treat as unauthenticated but keep
          // tokens for a retry — the next authed request will surface the issue.
          console.error("AppBoot /auth/me failed:", err);
          setStatus("unauthenticated");
        }
      }
    }

    void hydrate();

    function handleAuthLogout() {
      clearSession();
      toast.info(tError("TokenExpired"));
    }
    window.addEventListener("auth:logout", handleAuthLogout);

    return () => {
      cancelled = true;
      window.removeEventListener("auth:logout", handleAuthLogout);
    };
  }, [setStatus, setUser, clearSession]);

  return null;
}
