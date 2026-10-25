"use client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { completeOAuthSignup, nicknameSchema } from "@/lib/api/auth";
import { describeApiError } from "@/lib/api/errorMessage";
import { startSession } from "@/lib/auth/session";
import { t } from "@/i18n";

const formSchema = z.object({ nickname: nicknameSchema });
type FormValues = z.infer<typeof formSchema>;

interface CompleteSignupFormProps {
  /** One-time OAuth signup token. Kept in memory only, never stored (RULES.md R1). */
  signupToken: string;
  suggestedNickname: string;
}

/** Last step of an OAuth signup: pick a nickname, then the account is created. */
export function CompleteSignupForm({ signupToken, suggestedNickname }: CompleteSignupFormProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { nickname: suggestedNickname },
    mode: "onBlur",
  });

  async function onSubmit({ nickname }: FormValues) {
    try {
      const tokens = await completeOAuthSignup({ signupToken, nickname });
      await startSession(tokens);
      router.replace("/rooms");
    } catch (err) {
      toast.error(describeApiError(err, "oauthComplete"));
    }
  }

  return (
    <>
      <header className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold">{t("auth.complete.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("auth.complete.description")}</p>
      </header>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
        <Input
          label={t("auth.signup.nickname")}
          hint={t("auth.signup.nicknameHint")}
          {...register("nickname")}
          error={errors.nickname?.message}
        />
        <Button type="submit" loading={isSubmitting} fullWidth size="lg">
          {t("auth.complete.submit")}
        </Button>
      </form>
    </>
  );
}
