"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { CompleteSignupForm } from "@/components/auth/CompleteSignupForm";
import { Spinner } from "@/components/ui/Spinner";
import { useOAuthHash } from "@/lib/auth/useOAuthHash";
import { t } from "@/i18n";

/** OAuth SignupRequired: /auth/oauth-complete#signup_token=...&suggested_nickname=... */
export default function OAuthCompletePage() {
  const hash = useOAuthHash();
  const router = useRouter();
  const signupToken = hash?.signup_token;

  useEffect(() => {
    if (hash && !hash.signup_token) router.replace("/auth/error?error=oauth_failed");
  }, [hash, router]);

  return (
    <AuthShell>
      {signupToken ? (
        <CompleteSignupForm
          signupToken={signupToken}
          suggestedNickname={hash?.suggested_nickname ?? ""}
        />
      ) : (
        <Spinner size={20} label={t("auth.callback.processing")} />
      )}
    </AuthShell>
  );
}
