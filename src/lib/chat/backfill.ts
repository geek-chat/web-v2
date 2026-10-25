/**
 * After the server accepts a connection, fetch what each loaded room missed
 * while no socket was open (RULES.md R2, server docs/WEBSOCKET.md §6). This
 * also covers the gap between a room's first REST page and the first
 * acceptance.
 *
 * The cursor is the newest createdAt the server gave us, passed back as the
 * exact string. Forward pages come oldest first, and paging stops at a short
 * page. Live new_message events can overlap; the store merges by id.
 * A room more than MAX_FORWARD_PAGES behind jumps to its latest page instead
 * of paging through everything it missed.
 */
import { listMessages, MESSAGE_PAGE_MAX } from "@/lib/api/rooms";
import { newestServerCreatedAt, useMessagesStore } from "@/store/messages";

export const MAX_FORWARD_PAGES = 5;

/** Failures are left for the next acceptance or the room view's own load to repair. */
export async function backfillLoadedRooms(): Promise<void> {
  const roomIds = Object.keys(useMessagesStore.getState().byRoom);
  await Promise.allSettled(roomIds.map((roomId) => backfillRoom(roomId)));
}

export async function backfillRoom(roomId: string): Promise<void> {
  let cursor = newestServerCreatedAt(useMessagesStore.getState().byRoom[roomId] ?? []);
  // Nothing from the server yet: the room view loads its first page itself.
  if (cursor === null) return;

  for (let page = 0; page < MAX_FORWARD_PAGES; page += 1) {
    const batch = await listMessages(roomId, {
      direction: "forward",
      cursor,
      limit: MESSAGE_PAGE_MAX,
    });
    if (!isLoaded(roomId)) return; // the room expired or the session ended meanwhile
    useMessagesStore.getState().mergeServerMessages(roomId, batch);
    if (batch.length < MESSAGE_PAGE_MAX) return;
    cursor = batch[batch.length - 1].createdAt;
  }

  const latest = await listMessages(roomId, { limit: MESSAGE_PAGE_MAX });
  if (!isLoaded(roomId)) return;
  useMessagesStore.getState().replaceServerMessages(roomId, latest);
}

function isLoaded(roomId: string): boolean {
  return Object.hasOwn(useMessagesStore.getState().byRoom, roomId);
}
