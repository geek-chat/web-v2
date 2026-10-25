"use client";

import Link from "next/link";
import type { Room } from "@/lib/api/rooms";
import { Avatar } from "@/components/ui/Avatar";
import { useNow } from "@/hooks/useNow";
import { formatLeft, ROOM_EXPIRING_SOON_MS } from "@/lib/time";
import { toEpochMs } from "@/store/messages";
import { t } from "@/i18n";

/** What a room is called for this user: the other person in a DIRECT room, the name of a GROUP room. */
export function roomTitle(room: Room, currentUserId: string | undefined): string {
  if (room.type === "DIRECT") {
    const other = room.members.find((m) => m.userId !== currentUserId) ?? room.members[0];
    return other?.nickname ?? t("chat.room.unnamed");
  }
  return room.name ?? t("chat.room.unnamed");
}

const timeFormat = new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" });
const dateFormat = new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" });

/** The time for today's activity, the date for anything older. */
export function formatActivity(iso: string, now: Date = new Date()): string {
  const at = toEpochMs(iso);
  if (Number.isNaN(at)) return "";
  const date = new Date(at);
  return date.toDateString() === now.toDateString() ? timeFormat.format(date) : dateFormat.format(date);
}

interface RoomListItemProps {
  room: Room;
  currentUserId: string | undefined;
  active: boolean;
  /** room_expiring arrived for this room. */
  expiring: boolean;
}

export function RoomListItem({ room, currentUserId, active, expiring }: RoomListItemProps) {
  const title = roomTitle(room, currentUserId);
  return (
    <Link
      href={`/rooms/${room.id}`}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted ${active ? "bg-muted" : ""}`}
    >
      <Avatar nickname={title} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{title}</span>
        {room.type === "GROUP" && (
          <span className="text-xs text-muted-foreground">
            {t("rooms.members", { count: String(room.members.length) })}
          </span>
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {room.lastMessageAt && (
          <time dateTime={room.lastMessageAt} className="text-xs text-muted-foreground">
            {formatActivity(room.lastMessageAt)}
          </time>
        )}
        {(expiring || room.expiresAt) && <RoomExpiry expiresAt={room.expiresAt} expiring={expiring} />}
      </span>
    </Link>
  );
}

/**
 * A TTL room's time left, or "곧 만료" once room_expiring arrived or ten
 * minutes remain: the server checks every 10 minutes, so its warning can come
 * late. Its own timer, so only this badge re-renders.
 */
function RoomExpiry({ expiresAt, expiring }: { expiresAt: string | null; expiring: boolean }) {
  const now = useNow(30_000);
  const leftMs = expiresAt ? toEpochMs(expiresAt) - now : Number.NaN;
  const left = formatLeft(leftMs);
  if (expiring || !left || leftMs <= ROOM_EXPIRING_SOON_MS) {
    return (
      <span className="rounded bg-destructive/20 px-1.5 text-xs text-destructive">{t("rooms.expiring")}</span>
    );
  }
  return <span className="text-xs text-muted-foreground">{t("rooms.expiresIn", { left })}</span>;
}
