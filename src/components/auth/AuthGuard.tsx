"use client";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { rememberReturnPath, takeReturnPath } from "@/lib/auth/returnPath";
import { verifySession } from "@/lib/auth/session";
import { useAuthStore } from "@/store/auth";
import { t } from "@/i18n";

/**
 * Renders its children only for an authenticated session. Every status has
 * its own branch, checked for exhaustiveness at compile time: v1 got stuck on
 * an authed screen with no user after /auth/me failed.
 *
 * An invite link opened while signed out survives the trip through /login
 * (src/lib/auth/returnPath.ts). The path comes from window.location rather
 * than usePathname: sign-in lands on /rooms, and only the guard sees both ends.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      rememberReturnPath(window.location.pathname);
      router.replace("/login");
    } else if (status === "authenticated") {
      const path = takeReturnPath();
      if (path && path !== window.location.pathname) router.replace(path);
    }
  }, [status, router]);

  switch (status) {
    case "authenticated":
      return <>{children}</>;
    case "offline":
      return <OfflineNotice />;
    case "idle":
    case "loading":
    case "unauthenticated": // the effect above is redirecting to /login
      return (
        <main className="flex flex-1 items-center justify-center">
          <Spinner size={20} label={t("common.loading")} />
        </main>
      );
    default:
      return assertNever(status);
  }
}

function OfflineNotice() {
  return (
    <AuthShell>
      <div className="flex flex-col gap-2" role="alert">
        <h2 className="text-xl font-semibold">{t("session.offline.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("session.offline.body")}</p>
      </div>
      <Button size="lg" fullWidth onClick={() => void verifySession()}>
        {t("common.retry")}
      </Button>
    </AuthShell>
  );
}

function assertNever(status: never): never {
  throw new Error(`Unhandled auth status: ${String(status)}`);
}
