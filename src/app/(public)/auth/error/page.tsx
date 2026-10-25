"use client";
import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { Spinner } from "@/components/ui/Spinner";
import { endOAuthFlow } from "@/lib/auth/oauthFlow";
import { oauthErrorMessage } from "@/lib/auth/oauthText";
import { t } from "@/i18n";

/** /auth/error?error=<code>. A query string, not a fragment (AuthController.kt). */
export default function OAuthErrorPage() {
  // A failed flow is still a finished one; don't leave its mark for a later link.
  useEffect(() => {
    endOAuthFlow();
  }, []);

  // useSearchParams on a prerendered route needs a Suspense boundary
  // (next docs: 01-app/03-api-reference/04-functions/use-search-params.md).
  return (
    <AuthShell>
      <Suspense fallback={<Spinner size={20} />}>
        <OAuthErrorDetails />
      </Suspense>
    </AuthShell>
  );
}

function OAuthErrorDetails() {
  const code = useSearchParams().get("error");
  return (
    <>
      <header className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold">{t("auth.callbackError.title")}</h2>
        <p className="text-sm text-muted-foreground" role="alert">
          {oauthErrorMessage(code)}
        </p>
      </header>
      <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
        {t("auth.callbackError.back")}
      </Link>
    </>
  );
}
