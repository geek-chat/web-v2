"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/errorMessage";
import { isInviteCode, joinInvite } from "@/lib/api/invite";
import { useRoomsStore } from "@/store/rooms";
import { t } from "@/i18n";

/**
 * The invite page. Joining waits for a click, so opening a link never adds
 * anyone to a room by itself, and a double-run effect in dev cannot join
 * twice. The server has no preview endpoint, so the room cannot be named first.
 */
export function JoinInvite({ code }: { code: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 404, 409 and 410 will answer the same way again: stop offering the button.
  const [settled, setSettled] = useState(false);
  const valid = isInviteCode(code);

  async function join() {
    setPending(true);
    setError(null);
    try {
      const room = await joinInvite(code);
      const rooms = useRoomsStore.getState();
      rooms.upsertRoom(room);
      rooms.markStale(); // a list fetched before the join would lack the room
      router.replace(`/rooms/${room.id}`);
    } catch (err) {
      setSettled(err instanceof ApiError && [404, 409, 410].includes(err.status));
      setError(describeApiError(err, "invite"));
      setPending(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="text-xl font-semibold">{t("invite.title")}</h1>
      {valid ? (
        <p className="text-sm text-muted-foreground">{t("invite.prompt")}</p>
      ) : (
        <p role="alert" className="text-sm text-destructive">
          {t("invite.invalid")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {valid && !settled && (
        <Button size="lg" fullWidth loading={pending} onClick={() => void join()}>
          {t("invite.join")}
        </Button>
      )}
      <Link href="/rooms" className="text-center text-sm text-primary underline-offset-4 hover:underline">
        {t("invite.toRooms")}
      </Link>
    </AuthShell>
  );
}
