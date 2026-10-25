/**
 * After the server accepts a connection, fetch what each loaded room missed
 * while no socket was open (RULES.md R2, server docs/WEBSOCKET.md §6).
 *
 * The first cursor sits CURSOR_OVERLAP_MS before the newest createdAt the
 * server gave us: two messages sent to one room at once can commit in the
 * reverse order of their createdAt (the server stamps the time before it waits
 * on the room row), so a cursor at the newest row held could skip the one that
 * committed later. Later pages pass the last row's createdAt back as the exact
 * string. Forward pages come oldest first, and paging stops at a short page.
 * Overlapping rows and live new_message events are merged by id.
 * A loaded room with no server rows yet (an empty room) takes its latest page
 * instead. A room more than MAX_FORWARD_PAGES behind jumps to its latest page
 * instead of paging through everything it missed.
 */
import { listMessages, MESSAGE_PAGE_MAX } from "@/lib/api/rooms";
import { newestServerCreatedAt, toEpochMs, useMessagesStore } from "@/store/messages";
import { useWsStore } from "@/store/ws";

export const MAX_FORWARD_PAGES = 5;
export const CURSOR_OVERLAP_MS = 5000;

/** `iso` moved CURSOR_OVERLAP_MS earlier, as an ISO-8601 string the server's Instant.parse accepts. */
function overlapCursor(iso: string): string {
  const ms = toEpochMs(iso);
  return Number.isNaN(ms) ? iso : new Date(ms - CURSOR_OVERLAP_MS).toISOString();
}

/** Failures are left for the next acceptance or the room view's own load to repair. */
export async function backfillLoadedRooms(): Promise<void> {
  const roomIds = Object.keys(useMessagesStore.getState().loaded);
  await Promise.allSettled(roomIds.map((roomId) => backfillRoom(roomId)));
}

export async function backfillRoom(roomId: string): Promise<void> {
  // Not loaded: the room view loads its first page itself (loadRoomMessages).
  if (!isLoaded(roomId)) return;
  const newest = newestServerCreatedAt(useMessagesStore.getState().byRoom[roomId] ?? []);
  if (newest === null) {
    const latest = await listMessages(roomId, { limit: MESSAGE_PAGE_MAX });
    if (isLoaded(roomId)) useMessagesStore.getState().mergeServerMessages(roomId, latest);
    return;
  }
  let cursor = overlapCursor(newest);

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
