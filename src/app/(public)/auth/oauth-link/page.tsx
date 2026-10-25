"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { CompleteSignupForm } from "@/components/auth/CompleteSignupForm";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { linkProvider } from "@/lib/api/auth";
import { describeApiError } from "@/lib/api/errorMessage";
import { providerLabel } from "@/lib/auth/oauthText";
import { startSession } from "@/lib/auth/session";
import { useOAuthHash } from "@/lib/auth/useOAuthHash";
import { t } from "@/i18n";

// The signup token from a declined link lives in this state only (RULES.md R1).
type Step =
  | { kind: "decide" }
  | { kind: "signup"; signupToken: string; suggestedNickname: string };

/** OAuth LinkingRequired: /auth/oauth-link#link_token=...&existing_nickname=...&new_provider=... */
export default function OAuthLinkPage() {
  const hash = useOAuthHash();
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "decide" });
  const [pending, setPending] = useState<"link" | "decline" | null>(null);
  const linkToken = hash?.link_token;

  useEffect(() => {
    if (hash && !hash.link_token) router.replace("/auth/error?error=oauth_failed");
  }, [hash, router]);

  async function decide(confirm: boolean) {
    if (!linkToken) return;
    setPending(confirm ? "link" : "decline");
    try {
      const result = await linkProvider({ linkToken, confirm });
      if (result.kind === "logged_in") {
        await startSession(result.tokens);
        toast.success(t("auth.link.success"));
        router.replace("/rooms");
        return; // keep the buttons disabled while navigating
      }
      setStep({
        kind: "signup",
        signupToken: result.signupToken,
        suggestedNickname: result.suggestedNickname,
      });
    } catch (err) {
      toast.error(describeApiError(err, "oauthLink"));
    }
    setPending(null);
  }

  if (!linkToken) {
    return (
      <AuthShell>
        <Spinner size={20} label={t("auth.callback.processing")} />
      </AuthShell>
    );
  }

  if (step.kind === "signup") {
    return (
      <AuthShell>
        <CompleteSignupForm
          signupToken={step.signupToken}
          suggestedNickname={step.suggestedNickname}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <header className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold">{t("auth.link.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("auth.link.body", {
            nickname: hash?.existing_nickname ?? "",
            provider: providerLabel(hash?.new_provider ?? ""),
          })}
        </p>
      </header>
      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          fullWidth
          loading={pending === "link"}
          disabled={pending !== null}
          onClick={() => void decide(true)}
        >
          {t("auth.link.confirm")}
        </Button>
        <Button
          size="lg"
          variant="secondary"
          fullWidth
          loading={pending === "decline"}
          disabled={pending !== null}
          onClick={() => void decide(false)}
        >
          {t("auth.link.decline")}
        </Button>
      </div>
    </AuthShell>
  );
}
