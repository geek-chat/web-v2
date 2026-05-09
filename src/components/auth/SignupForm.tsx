"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  signup,
  signupRequestSchema,
  type SignupRequest,
} from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth";
import { t, tError } from "@/i18n";

// Form-only schema: empty email becomes undefined before submit.
const formSchema = signupRequestSchema.extend({
  email: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
    .pipe(z.email("이메일 형식이 올바르지 않습니다").optional()),
});
type FormValues = z.input<typeof formSchema>;

export function SignupForm() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const req: SignupRequest = signupRequestSchema.parse(values);
      const tokens = await signup(req);
      setSession(tokens);
      toast.success(t("auth.signup.success"));
      router.replace("/rooms");
    } catch (err) {
      if (err instanceof ApiError && err.body?.error) {
        toast.error(tError(err.body.error));
      } else if (err instanceof Error) {
        toast.error(err.message || tError(undefined));
      } else {
        toast.error(tError(undefined));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
      <Input
        label={t("auth.signup.username")}
        hint={t("auth.signup.usernameHint")}
        autoComplete="username"
        {...register("username")}
        error={errors.username?.message}
      />
      <Input
        label={t("auth.signup.password")}
        hint={t("auth.signup.passwordHint")}
        type="password"
        autoComplete="new-password"
        {...register("password")}
        error={errors.password?.message}
      />
      <Input
        label={t("auth.signup.nickname")}
        hint={t("auth.signup.nicknameHint")}
        {...register("nickname")}
        error={errors.nickname?.message}
      />
      <Input
        label={t("auth.signup.email")}
        type="email"
        autoComplete="email"
        {...register("email")}
        error={errors.email?.message}
      />
      <Button type="submit" loading={submitting} fullWidth size="lg">
        {t("auth.signup.submit")}
      </Button>
    </form>
  );
}
