"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRooms } from "@/hooks/useRooms";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useAuthStore } from "@/store/auth";
import { useWsStore } from "@/store/ws";
import { RoomListItem } from "./RoomListItem";
import { t } from "@/i18n";

/** The signed-in user's rooms, most recent activity first, with loading, error and empty states. */
export function RoomList() {
  const { rooms, error, refresh } = useRooms();
  const userId = useAuthStore((s) => s.user?.id);
  const expiringRooms = useWsStore((s) => s.expiringRooms);
  const pathname = usePathname();

  if (error) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 px-3 py-8 text-center">
        <p className="text-sm text-muted-foreground">{t("rooms.loadError")}</p>
        <Button variant="secondary" size="sm" onClick={() => void refresh()}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }
  if (!rooms) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size={20} label={t("common.loading")} />
      </div>
    );
  }
  if (rooms.length === 0) {
    return (
      <div className="flex flex-col gap-1 px-3 py-8 text-center">
        <p className="text-sm font-medium">{t("rooms.empty.title")}</p>
        <p className="text-xs text-muted-foreground">{t("rooms.empty.body")}</p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-1">
      {rooms.map((room) => (
        <li key={room.id}>
          <RoomListItem
            room={room}
            currentUserId={userId}
            active={pathname === `/rooms/${room.id}`}
            expiring={Object.hasOwn(expiringRooms, room.id)}
          />
        </li>
      ))}
    </ul>
  );
}

/** The list with its title bar: the desktop sidebar and the mobile /rooms page. */
export function RoomsPanel() {
  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <header className="flex items-center justify-between px-1">
        <h2 className="text-lg font-semibold">{t("rooms.title")}</h2>
        <nav className="flex items-center gap-3">
          <Link href="/me" className="text-sm text-muted-foreground hover:text-foreground">
            {t("rooms.me")}
          </Link>
          <Link
            href="/rooms/new"
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
          >
            {t("rooms.new")}
          </Link>
        </nav>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <RoomList />
      </div>
    </div>
  );
}
