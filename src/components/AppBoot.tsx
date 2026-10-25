"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { verifySession } from "@/lib/auth/session";
import { t } from "@/i18n";

/**
 * Mounts once at the root via layout.tsx. Performs:
 *  1. session verification against /auth/me (src/lib/auth/session.ts)
 *  2. a retry when the browser comes back online while the session is offline
 *  3. global 'auth:logout' listener — fired by api/client when refresh fails
 *
 * Renders nothing.
 */
export default function AppBoot() {
  const clearSession = useAuthStore((s) => s.clearSession);

  useEffect(() => {
    void verifySession();

    function handleAuthLogout() {
      clearSession();
      toast.info(t("auth.error.TokenExpired"));
    }
    function handleOnline() {
      if (useAuthStore.getState().status === "offline") void verifySession();
    }
    window.addEventListener("auth:logout", handleAuthLogout);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("auth:logout", handleAuthLogout);
      window.removeEventListener("online", handleOnline);
    };
  }, [clearSession]);

  return null;
}
