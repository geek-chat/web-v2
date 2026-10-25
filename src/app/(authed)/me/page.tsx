"use client";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { UsernameForm } from "@/components/me/UsernameForm";
import { WithdrawSection } from "@/components/me/WithdrawSection";
import { Button } from "@/components/ui/Button";
import { logout } from "@/lib/api/auth";
import { getRefreshToken } from "@/lib/auth/storage";
import { useAuthStore } from "@/store/auth";
import { t } from "@/i18n";

/** Profile, username, logout and account withdrawal. */
export default function MePage() {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout(getRefreshToken());
    } catch {
      // Best effort: an unrevoked refresh token still expires on the server (14 days).
    }
    clearSession(); // AuthGuard then sends the user to /login
    toast.success(t("me.logout.success"));
  }

  // AuthGuard renders this page only once the session has a user.
  if (!user) return null;

  return (
    <main className="flex flex-1 justify-center px-6 py-12">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <header className="flex flex-col gap-1">
          <Link href="/rooms" className="text-sm text-primary underline-offset-4 hover:underline">
            ← {t("me.back")}
          </Link>
          <h2 className="text-2xl font-semibold">{t("me.title")}</h2>
        </header>
        <section className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">{t("me.nickname")}</p>
          <p className="text-base">{user.nickname}</p>
        </section>
        <UsernameForm current={user.username} />
        <Button
          variant="secondary"
          fullWidth
          loading={loggingOut}
          onClick={() => void handleLogout()}
        >
          {t("common.logout")}
        </Button>
        <WithdrawSection />
      </div>
    </main>
  );
}
