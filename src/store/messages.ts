/**
 * Messages store: one list per room, oldest first (RULES.md R6).
 *
 * Rows arrive from three places, in any order:
 *  - REST pages: server time and senderNickname, no clientMessageId
 *  - new_message: server time and roomId, no senderNickname, no clientMessageId
 *  - this tab's sends: a pending row keyed by its clientMessageId, client time
 * The server sends message_ack and new_message from different threads
 * (ChatWebSocketHandler.handleSendMessage, ChatEventListener.onMessageSent),
 * so either can come first, and an idempotent resend gets the ack and no
 * new_message at all. The ack is the only link between a pending row and its
 * server message.
 *
 * Order: rows with a server createdAt sort by time, then id. Rows with only a
 * client time (pending, failed, acked but not seen from the server yet) stay
 * at the tail in the order they were added.
 *
 * `loaded` marks rooms whose history a REST page brought in; only those are
 * backfilled. A live new_message alone does not load a room.
 * Ids removed by message_expired or message_burned stay as tombstones for
 * the session, so a REST page fetched before the removal cannot bring them
 * back (the server may send message_expired before its delete commits).
 */
import { create } from "zustand";
import type { MessageDto, MessageType } from "@/lib/api/rooms";

export type MessageStatus = "pending" | "sent" | "failed";

export interface ChatMessage {
  /** Server id, or the clientMessageId until the ack arrives. */
  id: string;
  roomId: string;
  senderId: string;
  /** Only REST rows carry it; resolve it from the room's members otherwise. */
  senderNickname?: string;
  content: string;
  type: MessageType;
  createdAt: string;
  /** createdAt came from the server. Only such rows are ordered by time and feed the backfill cursor. */
  serverTime: boolean;
  expiresAt: string | null;
  replyToMessageId: string | null;
  burnAfterRead: boolean;
  status: MessageStatus;
  /** Set on rows this tab sent. Use `clientMessageId ?? id` as the React key so it survives the ack. */
  clientMessageId?: string;
  /** Kept on rows this tab sent so a retry resends the same payload. */
  ttlSeconds?: number;
}

/** A message as the server describes it: a REST row, or new_message data (which has no nickname). */
export type ServerMessage = Omit<MessageDto, "senderNickname"> & { senderNickname?: string };

export interface PendingInput {
  roomId: string;
  clientMessageId: string;
  senderId: string;
  content: string;
  ttlSeconds?: number;
}

interface MessagesState {
  byRoom: Record<string, ChatMessage[]>;
  /** Rooms whose history a REST page loaded. */
  loaded: Record<string, true>;
  /** Tombstones: ids removed per room, never merged back. */
  removed: Record<string, Record<string, true>>;
  /** Bumped by reset(). A request started before a reset drops its result. */
  epoch: number;

  /** Adds or updates rows from a REST page by id, and marks the room loaded, even with no rows. */
  mergeServerMessages: (roomId: string, messages: readonly ServerMessage[]) => void;
  /** Adds or updates one row from new_message. Does not mark the room loaded. */
  addLiveMessage: (roomId: string, message: ServerMessage) => void;
  /**
   * Jumps to the latest page: drops server rows older than the page, which would
   * leave a hole before it. Newer rows (they arrived live while it loaded) and
   * local rows stay.
   */
  replaceServerMessages: (roomId: string, messages: readonly ServerMessage[]) => void;
  addPending: (input: PendingInput) => void;
  /** failed → pending, for a retry. */
  markPending: (clientMessageId: string) => void;
  ackMessage: (clientMessageId: string, serverId: string) => void;
  /** pending → failed. A sent row stays sent. */
  failMessage: (clientMessageId: string) => void;
  /** Removes rows and keeps their ids as tombstones. Returns how many rows were removed. */
  removeMessages: (roomId: string, ids: readonly string[]) => number;
  removeRoom: (roomId: string) => void;
  reset: () => void;
}

/** Epoch ms of an ISO-8601 instant. Digits past milliseconds are cut first: Instant.toString() prints up to nine. */
export function toEpochMs(iso: string): number {
  return Date.parse(iso.replace(/(\.\d{3})\d+/, "$1"));
}

/** The fraction of an ISO-8601 instant as nine digits, to order rows within one millisecond. */
function fractionDigits(iso: string): string {
  return (/\.(\d+)/.exec(iso)?.[1] ?? "").padEnd(9, "0").slice(0, 9);
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareRows(a: ChatMessage, b: ChatMessage): number {
  if (a.serverTime !== b.serverTime) return a.serverTime ? -1 : 1;
  if (!a.serverTime) return 0; // stable sort keeps the order they were added
  const byTime = toEpochMs(a.createdAt) - toEpochMs(b.createdAt);
  if (byTime) return byTime;
  // Same millisecond: the server keeps microseconds, so compare those before the id.
  return (
    compareStrings(fractionDigits(a.createdAt), fractionDigits(b.createdAt)) ||
    compareStrings(a.id, b.id)
  );
}

function toRow(roomId: string, message: ServerMessage, existing?: ChatMessage): ChatMessage {
  return {
    id: message.id,
    roomId,
    senderId: message.senderId,
    senderNickname: message.senderNickname ?? existing?.senderNickname,
    content: message.content,
    type: message.type,
    createdAt: message.createdAt,
    serverTime: true,
    expiresAt: message.expiresAt,
    replyToMessageId: message.replyToMessageId,
    burnAfterRead: message.burnAfterRead,
    status: "sent",
    clientMessageId: existing?.clientMessageId,
    ttlSeconds: existing?.ttlSeconds,
  };
}

function merge(
  list: readonly ChatMessage[],
  roomId: string,
  messages: readonly ServerMessage[],
  removed: Record<string, true> = {},
): ChatMessage[] {
  const rows = new Map(list.map((row) => [row.id, row]));
  for (const message of messages) {
    if (Object.hasOwn(removed, message.id)) continue; // expired or burned: never back
    rows.set(message.id, toRow(roomId, message, rows.get(message.id)));
  }
  return [...rows.values()].sort(compareRows);
}

/** Copies a record without one key. */
function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  const rest = { ...record };
  delete rest[key];
  return rest;
}

/** Finds the row this tab sent with `clientMessageId`, in any room. */
export function findByClientMessageId(
  byRoom: Record<string, ChatMessage[]>,
  clientMessageId: string,
): ChatMessage | undefined {
  for (const list of Object.values(byRoom)) {
    const row = list.find((m) => m.clientMessageId === clientMessageId);
    if (row) return row;
  }
  return undefined;
}

/** The newest createdAt the server gave for this list, as its exact string: the backfill cursor. */
export function newestServerCreatedAt(list: readonly ChatMessage[]): string | null {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i].serverTime) return list[i].createdAt;
  }
  return null;
}

export const useMessagesStore = create<MessagesState>((set, get) => {
  /** Replaces one row of a room, found by clientMessageId, with what `update` returns. */
  const updateOwnRow = (
    clientMessageId: string,
    update: (row: ChatMessage, list: ChatMessage[]) => ChatMessage[] | null,
  ) =>
    set((state) => {
      const row = findByClientMessageId(state.byRoom, clientMessageId);
      if (!row) return state;
      const next = update(row, state.byRoom[row.roomId]);
      return next ? { byRoom: { ...state.byRoom, [row.roomId]: next } } : state;
    });

  return {
    byRoom: {},
    loaded: {},
    removed: {},
    epoch: 0,

    mergeServerMessages: (roomId, messages) =>
      set((state) => ({
        byRoom: {
          ...state.byRoom,
          [roomId]: merge(state.byRoom[roomId] ?? [], roomId, messages, state.removed[roomId]),
        },
        loaded: { ...state.loaded, [roomId]: true },
      })),

    addLiveMessage: (roomId, message) =>
      set((state) => ({
        byRoom: {
          ...state.byRoom,
          [roomId]: merge(state.byRoom[roomId] ?? [], roomId, [message], state.removed[roomId]),
        },
      })),

    replaceServerMessages: (roomId, messages) =>
      set((state) => {
        const oldest = Math.min(...messages.map((m) => toEpochMs(m.createdAt)));
        const kept = (state.byRoom[roomId] ?? []).filter(
          (row) => !row.serverTime || toEpochMs(row.createdAt) >= oldest,
        );
        return {
          byRoom: { ...state.byRoom, [roomId]: merge(kept, roomId, messages, state.removed[roomId]) },
          loaded: { ...state.loaded, [roomId]: true },
        };
      }),

    addPending: ({ roomId, clientMessageId, senderId, content, ttlSeconds }) =>
      set((state) => {
        const row: ChatMessage = {
          id: clientMessageId,
          roomId,
          senderId,
          content,
          type: "TEXT",
          createdAt: new Date().toISOString(),
          serverTime: false,
          expiresAt: null,
          replyToMessageId: null,
          burnAfterRead: false,
          status: "pending",
          clientMessageId,
          ttlSeconds,
        };
        // Client-time rows sort to the tail, so appending keeps the list sorted.
        return { byRoom: { ...state.byRoom, [roomId]: [...(state.byRoom[roomId] ?? []), row] } };
      }),

    markPending: (clientMessageId) =>
      updateOwnRow(clientMessageId, (row, list) =>
        row.status === "failed"
          ? list.map((m) => (m === row ? { ...m, status: "pending" } : m))
          : null,
      ),

    ackMessage: (clientMessageId, serverId) =>
      updateOwnRow(clientMessageId, (row, list) => {
        const serverCopy = list.find((m) => m.id === serverId && m !== row);
        if (!serverCopy) {
          return list.map((m) => (m === row ? { ...m, id: serverId, status: "sent" } : m));
        }
        // new_message came first: keep its server time, hand it this row's key, drop this row.
        return list
          .filter((m) => m !== row)
          .map((m) =>
            m === serverCopy
              ? { ...m, clientMessageId, ttlSeconds: row.ttlSeconds, status: "sent" }
              : m,
          );
      }),

    failMessage: (clientMessageId) =>
      updateOwnRow(clientMessageId, (row, list) =>
        row.status === "pending"
          ? list.map((m) => (m === row ? { ...m, status: "failed" } : m))
          : null,
      ),

    removeMessages: (roomId, ids) => {
      const list = get().byRoom[roomId] ?? [];
      const drop = new Set(ids);
      const next = list.filter((row) => !drop.has(row.id));
      // Tombstone every id, held or not: a page already in flight may still carry it.
      set((state) => {
        const tombstones = { ...state.removed[roomId] };
        for (const id of ids) tombstones[id] = true;
        const removed = { ...state.removed, [roomId]: tombstones };
        return next.length === list.length
          ? { removed }
          : { removed, byRoom: { ...state.byRoom, [roomId]: next } };
      });
      return list.length - next.length;
    },

    removeRoom: (roomId) =>
      set((state) => ({
        byRoom: without(state.byRoom, roomId),
        loaded: without(state.loaded, roomId),
        removed: without(state.removed, roomId),
      })),

    reset: () =>
      set((state) => ({ byRoom: {}, loaded: {}, removed: {}, epoch: state.epoch + 1 })),
  };
});
