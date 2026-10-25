"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthExpiredError } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/errorMessage";
import {
  updateUsername,
  updateUsernameRequestSchema,
  type UpdateUsernameRequest,
} from "@/lib/api/users";
import { useAuthStore } from "@/store/auth";
import { t } from "@/i18n";

/** Set or change the username other people search for. */
export function UsernameForm({ current }: { current: string | null }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateUsernameRequest>({
    resolver: zodResolver(updateUsernameRequestSchema),
    defaultValues: { username: current ?? "" },
    mode: "onBlur",
  });

  async function onSubmit(values: UpdateUsernameRequest) {
    try {
      const username = await updateUsername(values);
      const { user, setUser } = useAuthStore.getState();
      if (user) setUser({ ...user, username });
      toast.success(t("me.username.success"));
    } catch (err) {
      // AppBoot already announced an expired session through auth:logout.
      if (err instanceof AuthExpiredError) return;
      toast.error(describeApiError(err, "username"));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
      <Input
        label={t("me.username")}
        hint={current ? t("auth.signup.usernameHint") : t("me.username.empty")}
        autoComplete="username"
        {...register("username")}
        error={errors.username?.message}
      />
      <Button type="submit" variant="secondary" loading={isSubmitting} fullWidth>
        {t("me.username.submit")}
      </Button>
    </form>
  );
}
