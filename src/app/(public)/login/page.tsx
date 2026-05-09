import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { ko } from "@/i18n/ko";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <Link
            href="/"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            ← {ko["common.appName"]}
          </Link>
          <h2 className="text-2xl font-semibold">{ko["auth.login.title"]}</h2>
        </header>
        <LoginForm />
        <Divider label={ko["auth.or"]} />
        <OAuthButtons />
        <p className="text-center text-sm text-muted-foreground">
          {ko["auth.noAccount"]}{" "}
          <Link
            href="/signup"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {ko["auth.goSignup"]}
          </Link>
        </p>
      </div>
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
