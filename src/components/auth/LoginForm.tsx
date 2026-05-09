"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { login, loginRequestSchema, type LoginRequest } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth";
import { t, tError } from "@/i18n";

export function LoginForm() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    mode: "onBlur",
  });

  async function onSubmit(values: LoginRequest) {
    setSubmitting(true);
    try {
      const tokens = await login(values);
      setSession(tokens);
      toast.success(t("auth.login.success"));
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
        label={t("auth.login.username")}
        autoComplete="username"
        {...register("username")}
        error={errors.username?.message}
      />
      <Input
        label={t("auth.login.password")}
        type="password"
        autoComplete="current-password"
        {...register("password")}
        error={errors.password?.message}
      />
      <Button type="submit" loading={submitting} fullWidth size="lg">
        {t("auth.login.submit")}
      </Button>
    </form>
  );
}
