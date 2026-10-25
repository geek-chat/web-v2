import { useEffect, useMemo } from "react";
import useSWR from "swr";
import { listRooms, type Room } from "@/lib/api/rooms";
import { useAuthStore } from "@/store/auth";
import { toEpochMs } from "@/store/messages";
import { useRoomsStore } from "@/store/rooms";

/**
 * The room list (RULES.md R6): SWR fetches it, the rooms store holds it, and
 * WebSocket events update the store in place. The SWR key carries the user id
 * so two accounts never share a cache, and a fetch that resolves after the
 * session changed writes nothing.
 */
export function useRooms() {
  const userId = useAuthStore((s) => s.user?.id);
  const { error, mutate } = useSWR(
    userId ? (["/api/rooms", userId] as const) : null,
    fetchRoomsFor,
  );
  const rooms = useRoomsStore((s) => s.rooms);
  const stale = useRoomsStore((s) => s.stale);

  // A new_message named a room the list lacks: the server sends no room-added event.
  useEffect(() => {
    if (stale) void mutate();
  }, [stale, mutate]);

  const sorted = useMemo(() => (rooms ? sortByActivity(rooms) : null), [rooms]);
  return {
    rooms: sorted,
    // A failed refresh keeps the list it has; only a list never loaded shows the error.
    error: sorted ? undefined : error,
    refresh: () => mutate(),
  };
}

async function fetchRoomsFor([, userId]: readonly [string, string]): Promise<Room[]> {
  const rooms = await listRooms();
  if (useAuthStore.getState().user?.id === userId) useRoomsStore.getState().setRooms(rooms);
  return rooms;
}

/** Most recent message first. Rooms without a message yet go last, in the server's order. */
export function sortByActivity(rooms: readonly Room[]): Room[] {
  return [...rooms].sort((a, b) => {
    if (!a.lastMessageAt || !b.lastMessageAt) {
      return a.lastMessageAt ? -1 : b.lastMessageAt ? 1 : 0;
    }
    return toEpochMs(b.lastMessageAt) - toEpochMs(a.lastMessageAt);
  });
}
