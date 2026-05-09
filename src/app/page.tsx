import Link from "next/link";
import { ShieldCheck, Lock, Flame } from "lucide-react";
import { SignupForm } from "@/components/auth/SignupForm";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { ko } from "@/i18n/ko";

/**
 * Landing page — single-screen "signup form + OAuth + privacy hero".
 * Auth-related child components are 'use client'; the page itself is RSC
 * because nothing here needs hooks at the page level.
 */
export default function LandingPage() {
  return (
    <main className="flex flex-1 flex-col lg:flex-row">
      {/* Hero */}
      <section className="flex flex-1 flex-col justify-center gap-8 px-6 py-12 lg:px-16 lg:py-20">
        <div className="flex flex-col gap-3">
          <span className="text-sm font-semibold tracking-wide text-primary">
            {ko["common.appName"]}
          </span>
          <h1 className="text-4xl font-bold leading-tight lg:text-5xl">
            {ko["landing.tagline"]}
          </h1>
          <p className="text-base text-muted-foreground lg:text-lg">
            {ko["landing.subtitle"]}
          </p>
        </div>
        <ul className="flex flex-col gap-3 text-sm">
          <li className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <span>{ko["landing.privacy"]}</span>
          </li>
          <li className="flex items-start gap-3">
            <Lock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <span>WebSocket 실시간 메시지 + 단일-플라이트 토큰 갱신</span>
          </li>
          <li className="flex items-start gap-3">
            <Flame className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <span>임시 채팅방 + 자동 삭제 메시지</span>
          </li>
        </ul>
      </section>

      {/* Auth panel */}
      <section className="flex flex-1 flex-col justify-center border-t border-border bg-muted/30 px-6 py-12 lg:border-l lg:border-t-0 lg:px-16 lg:py-20">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
          <header className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold">{ko["auth.signup.title"]}</h2>
          </header>
          <SignupForm />
          <Divider label={ko["auth.or"]} />
          <OAuthButtons />
          <p className="text-center text-sm text-muted-foreground">
            {ko["auth.haveAccount"]}{" "}
            <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
              {ko["auth.goLogin"]}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="relative flex items-center" role="separator" aria-label={label}>
      <span className="flex-1 border-t border-border" />
      <span className="px-3 text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="flex-1 border-t border-border" />
    </div>
  );
}
