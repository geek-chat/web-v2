/**
 * After the server accepts a connection, fetch what each loaded room missed
 * while no socket was open (RULES.md R2, server docs/WEBSOCKET.md §6).
 *
 * The cursor is the newest createdAt the server gave us, passed back as the
 * exact string. Forward pages come oldest first, and paging stops at a short
 * page. Live new_message events can overlap; the store merges by id.
 * A loaded room with no server rows yet (an empty room) takes its latest page
 * instead. A room more than MAX_FORWARD_PAGES behind jumps to its latest page
 * instead of paging through everything it missed.
 */
import { listMessages, MESSAGE_PAGE_MAX } from "@/lib/api/rooms";
import { newestServerCreatedAt, useMessagesStore } from "@/store/messages";
import { useWsStore } from "@/store/ws";

export const MAX_FORWARD_PAGES = 5;

/** Failures are left for the next acceptance or the room view's own load to repair. */
export async function backfillLoadedRooms(): Promise<void> {
  const roomIds = Object.keys(useMessagesStore.getState().loaded);
  await Promise.allSettled(roomIds.map((roomId) => backfillRoom(roomId)));
}

export async function backfillRoom(roomId: string): Promise<void> {
  // Not loaded: the room view loads its first page itself (loadRoomMessages).
  if (!isLoaded(roomId)) return;
  let cursor = newestServerCreatedAt(useMessagesStore.getState().byRoom[roomId] ?? []);
  if (cursor === null) {
    const latest = await listMessages(roomId, { limit: MESSAGE_PAGE_MAX });
    if (isLoaded(roomId)) useMessagesStore.getState().mergeServerMessages(roomId, latest);
    return;
  }

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

/**
 * First page of a room view. If the socket is already accepted, backfill once
 * more: the page may have been read before the server joined this connection
 * to the room, and anything sent in between would arrive neither way.
 */
export async function loadRoomMessages(roomId: string): Promise<void> {
  const { epoch } = useMessagesStore.getState();
  const latest = await listMessages(roomId, { limit: MESSAGE_PAGE_MAX });
  // The session ended meanwhile: don't refill the emptied store with its messages.
  if (useMessagesStore.getState().epoch !== epoch) return;
  useMessagesStore.getState().mergeServerMessages(roomId, latest);
  if (useWsStore.getState().status === "open") await backfillRoom(roomId);
}

function isLoaded(roomId: string): boolean {
  return Object.hasOwn(useMessagesStore.getState().loaded, roomId);
}
