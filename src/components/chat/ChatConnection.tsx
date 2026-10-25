"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { acquireChat, releaseChat, retryChat, type ChatNotice } from "@/lib/chat/connection";
import { useAuthStore } from "@/store/auth";
import { toEpochMs } from "@/store/messages";
import { useRoomsStore } from "@/store/rooms";
import { t } from "@/i18n";

/**
 * Keeps the app's WebSocket open while an authenticated screen is shown. The
 * (authed) layout renders it inside AuthGuard, so a logout unmounts it and
 * closes the connection. The connection is pinned to the signed-in user and
 * starts over when that user changes. Turns connection notices into toasts.
 * Renders nothing.
 */
export function ChatConnection() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    acquireChat(
      {
        notify: (notice) => {
          if (notice.kind === "roomExpired") {
            // R2: only the room on screen gets a toast and a way out.
            if (useRoomsStore.getState().currentRoomId !== notice.roomId) return;
            router.replace("/rooms");
          }
          showNotice(notice);
        },
      },
      userId,
    );
    return () => releaseChat();
  }, [router, userId]);

  return null;
}

const timeFormat = new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" });

function roomLabel(name: string | null): string {
  return name ?? t("chat.room.unnamed");
}

function showNotice(notice: ChatNotice): void {
  switch (notice.kind) {
    case "roomExpiring": {
      const name = roomLabel(notice.roomName);
      const at = toEpochMs(notice.expiresAt);
      toast.warning(
        Number.isNaN(at)
          ? t("chat.room.expiringSoon", { name })
          : t("chat.room.expiring", { name, time: timeFormat.format(at) }),
      );
      return;
    }
    case "roomExpired":
      toast.info(t("chat.room.expired", { name: roomLabel(notice.roomName) }));
      return;
    case "messagesExpired":
      toast.info(t("chat.message.expired", { count: String(notice.count) }));
      return;
    case "sendFailed":
      toast.error(t("chat.message.sendFailed"));
      return;
    case "tooManyConnections":
      toast.error(t("chat.ws.tooManyConnections"), {
        duration: Infinity,
        action: { label: t("common.retry"), onClick: () => retryChat() },
      });
      return;
    default:
      assertNever(notice);
  }
}

function assertNever(notice: never): never {
  throw new Error(`Unhandled chat notice: ${JSON.stringify(notice)}`);
}
