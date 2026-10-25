"use client";

import Link from "next/link";
import { useState } from "react";
import { InvitePanel } from "@/components/room/InvitePanel";
import { Button } from "@/components/ui/Button";
import type { Room } from "@/lib/api/rooms";
import type { WSStatus } from "@/lib/ws/client";
import { useWsStore } from "@/store/ws";
import { formatTime } from "./MessageItem";
import { t, type TranslationKey } from "@/i18n";

const STATUS_LABELS: Partial<Record<WSStatus, TranslationKey>> = {
  connecting: "chat.ws.connecting",
  reconnecting: "chat.ws.reconnecting",
  blocked: "chat.ws.blocked",
};

/**
 * Room title, the connection state when it is not open, the invite panel for
 * GROUP rooms (the server would also link a DIRECT room, S18), and the expiry
 * banner (R2: room_expiring).
 */
export function ChatHeader({ title, room }: { title: string; room: Room | undefined }) {
  const status = useWsStore((s) => s.status);
  const expiring = useWsStore((s) => (room ? s.expiringRooms[room.id] : undefined));
  const statusLabel = STATUS_LABELS[status];
  const [inviting, setInviting] = useState(false);

  return (
    <header className="flex flex-col border-b border-border">
      <div className="flex items-center gap-3 px-4 py-3">
        <Link href="/rooms" className="text-sm text-primary md:hidden">
          {t("room.back")}
        </Link>
        <h2 className="truncate text-base font-semibold">{title}</h2>
        {room?.type === "GROUP" && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {t("rooms.members", { count: String(room.members.length) })}
          </span>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {statusLabel && (
            <span role="status" className="text-xs text-muted-foreground">
              {t(statusLabel)}
            </span>
          )}
          {room?.type === "GROUP" && (
            <Button variant="ghost" size="sm" aria-expanded={inviting} onClick={() => setInviting((open) => !open)}>
              {t("invite.open")}
            </Button>
          )}
        </div>
      </div>
      {inviting && room?.type === "GROUP" && <InvitePanel roomId={room.id} onClose={() => setInviting(false)} />}
      {expiring && (
        <p role="alert" className="bg-destructive/15 px-4 py-2 text-xs text-destructive">
          {t("chat.room.expiresAt", { time: formatTime(expiring.expiresAt) })}
        </p>
      )}
    </header>
  );
}
