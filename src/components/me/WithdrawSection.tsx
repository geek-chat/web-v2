"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { withdraw } from "@/lib/api/auth";
import { AuthExpiredError } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/errorMessage";
import { SESSION_ENDED_TOAST_ID } from "@/lib/auth/notices";
import { useAuthStore } from "@/store/auth";
import { t } from "@/i18n";

/** Typed in full on purpose: the server anonymizes the account and it cannot be undone. */
export const WITHDRAW_PHRASE = "DELETE MY ACCOUNT";

export function WithdrawSection() {
  const clearSession = useAuthStore((s) => s.clearSession);
  const [phrase, setPhrase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const confirmed = phrase === WITHDRAW_PHRASE;

  async function handleWithdraw() {
    if (!confirmed) return;
    setSubmitting(true);
    try {
      await withdraw();
      clearSession(); // AuthGuard then sends the user to /login
      // The server's ACCOUNT_WITHDRAWN frame may have ended the session first,
      // with AppBoot's logout toast: this one replaces it (same id).
      toast.success(t("me.withdraw.success"), { id: SESSION_ENDED_TOAST_ID });
    } catch (err) {
      // AppBoot already announced an expired session through auth:logout.
      if (!(err instanceof AuthExpiredError)) toast.error(describeApiError(err, "generic"));
      setSubmitting(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border border-destructive/40 p-4">
      <h3 className="text-base font-semibold text-destructive">{t("me.withdraw.title")}</h3>
      <p className="text-sm text-muted-foreground">
        {t("me.withdraw.description", { phrase: WITHDRAW_PHRASE })}
      </p>
      <Input
        label={t("me.withdraw.label")}
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        placeholder={WITHDRAW_PHRASE}
        autoComplete="off"
        spellCheck={false}
      />
      <Button
        variant="destructive"
        fullWidth
        disabled={!confirmed}
        loading={submitting}
        onClick={() => void handleWithdraw()}
      >
        {t("me.withdraw.submit")}
      </Button>
    </section>
  );
}
