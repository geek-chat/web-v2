"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { roomTitle } from "@/components/room/RoomListItem";
import { useAuthStore } from "@/store/auth";
import { useRoomsStore } from "@/store/rooms";
import { t } from "@/i18n";

/**
 * Minimal room view until Phase 2.3 builds the chat screen. It already marks
 * the room as current, which room_expired uses to send the user back.
 */
export default function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const room = useRoomsStore((s) => s.rooms?.find((r) => r.id === id));
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    useRoomsStore.getState().setCurrentRoom(id);
    return () => useRoomsStore.getState().setCurrentRoom(null);
  }, [id]);

  return (
    <main className="flex flex-1 flex-col gap-4 p-6">
      <Link href="/rooms" className="text-sm text-primary underline-offset-4 hover:underline md:hidden">
        {t("room.back")}
      </Link>
      <h2 className="text-xl font-semibold">{room ? roomTitle(room, userId) : t("common.loading")}</h2>
      <p className="text-sm text-muted-foreground">{t("room.placeholder")}</p>
    </main>
  );
}
