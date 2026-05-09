"use client";
import { Button } from "@/components/ui/Button";
import { oauthStartUrl, type OAuthProvider } from "@/lib/api/auth";
import { t } from "@/i18n";

/**
 * OAuth provider buttons. Click → full window navigation to the backend's
 * OAuth start URL. Backend handles state, redirects to provider, then
 * back to /auth/callback → /auth/{success|oauth-link|oauth-complete|error}.
 */
export function OAuthButtons({ disabled = false }: { disabled?: boolean }) {
  function start(provider: OAuthProvider) {
    if (typeof window !== "undefined") {
      window.location.href = oauthStartUrl(provider);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="secondary"
        fullWidth
        size="md"
        onClick={() => start("google")}
        disabled={disabled}
      >
        <GoogleIcon />
        {t("auth.oauth.google")}
      </Button>
      <Button
        type="button"
        variant="secondary"
        fullWidth
        size="md"
        onClick={() => start("naver")}
        disabled={disabled}
        className="bg-[#03c75a] text-white hover:bg-[#02b850] border-transparent"
      >
        <span aria-hidden className="font-black text-base">N</span>
        {t("auth.oauth.naver")}
      </Button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
