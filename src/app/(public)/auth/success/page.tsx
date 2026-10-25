"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { Spinner } from "@/components/ui/Spinner";
import { startSession } from "@/lib/auth/session";
import { useOAuthHash } from "@/lib/auth/useOAuthHash";
import { t } from "@/i18n";

/** OAuth LoggedIn: /auth/success#access_token=...&refresh_token=... */
export default function OAuthSuccessPage() {
  const hash = useOAuthHash();
  const router = useRouter();
  // Strict Mode runs effects twice in development; start the session once.
  const handled = useRef(false);

  useEffect(() => {
    if (!hash || handled.current) return;
    handled.current = true;
    const { access_token: accessToken, refresh_token: refreshToken } = hash;
    if (!accessToken || !refreshToken) {
      router.replace("/auth/error?error=oauth_failed");
      return;
    }
    void startSession({ accessToken, refreshToken }).then(() => router.replace("/rooms"));
  }, [hash, router]);

  return (
    <AuthShell>
      <Spinner size={20} label={t("auth.callback.processing")} />
    </AuthShell>
  );
}
