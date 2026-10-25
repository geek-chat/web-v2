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

  /** Adds or updates server rows by id. Also marks the room as loaded, even with no rows. */
  mergeServerMessages: (roomId: string, messages: readonly ServerMessage[]) => void;
  /** Drops the room's server rows for `messages` (jump to the latest page); local rows stay. */
  replaceServerMessages: (roomId: string, messages: readonly ServerMessage[]) => void;
  addPending: (input: PendingInput) => void;
  /** failed → pending, for a retry. */
  markPending: (clientMessageId: string) => void;
  ackMessage: (clientMessageId: string, serverId: string) => void;
  /** pending → failed. A sent row stays sent. */
  failMessage: (clientMessageId: string) => void;
  /** Returns how many rows were removed. */
  removeMessages: (roomId: string, ids: readonly string[]) => number;
  removeRoom: (roomId: string) => void;
  reset: () => void;
}

/** Epoch ms of an ISO-8601 instant. Digits past milliseconds are cut first: Instant.toString() prints up to nine. */
export function toEpochMs(iso: string): number {
  return Date.parse(iso.replace(/(\.\d{3})\d+/, "$1"));
}

function compareRows(a: ChatMessage, b: ChatMessage): number {
  if (a.serverTime !== b.serverTime) return a.serverTime ? -1 : 1;
  if (!a.serverTime) return 0; // stable sort keeps the order they were added
  const byTime = toEpochMs(a.createdAt) - toEpochMs(b.createdAt);
  if (byTime) return byTime;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
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
): ChatMessage[] {
  const rows = new Map(list.map((row) => [row.id, row]));
  for (const message of messages) rows.set(message.id, toRow(roomId, message, rows.get(message.id)));
  return [...rows.values()].sort(compareRows);
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

    mergeServerMessages: (roomId, messages) =>
      set((state) => ({
        byRoom: { ...state.byRoom, [roomId]: merge(state.byRoom[roomId] ?? [], roomId, messages) },
      })),

    replaceServerMessages: (roomId, messages) =>
      set((state) => {
        const local = (state.byRoom[roomId] ?? []).filter((row) => !row.serverTime);
        return { byRoom: { ...state.byRoom, [roomId]: merge(local, roomId, messages) } };
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
      const list = get().byRoom[roomId];
      if (!list) return 0;
      const drop = new Set(ids);
      const next = list.filter((row) => !drop.has(row.id));
      const removed = list.length - next.length;
      if (removed > 0) set((state) => ({ byRoom: { ...state.byRoom, [roomId]: next } }));
      return removed;
    },

    removeRoom: (roomId) =>
      set((state) => {
        if (!Object.hasOwn(state.byRoom, roomId)) return state;
        const rest = { ...state.byRoom };
        delete rest[roomId];
        return { byRoom: rest };
      }),

    reset: () => set({ byRoom: {} }),
  };
});
