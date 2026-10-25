"use client";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { t } from "@/i18n";

/** Placeholder landing after login until Phase 2 builds the room list. */
export default function RoomsPage() {
  const nickname = useAuthStore((s) => s.user?.nickname ?? "");
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">{t("rooms.placeholder.title", { nickname })}</h2>
        <p className="text-sm text-muted-foreground">{t("rooms.placeholder.body")}</p>
        <Link href="/me" className="text-sm text-primary underline-offset-4 hover:underline">
          {t("rooms.placeholder.me")}
        </Link>
      </div>
    </main>
  );
}
