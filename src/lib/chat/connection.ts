/**
 * Chat connection lifetime: one ChatWSClient for the app, its events wired
 * into the stores, a backfill on every acceptance, and the optimistic send
 * path (RULES.md R2, R6).
 *
 * acquireChat() and releaseChat() count holders. The last release closes the
 * client on the next task instead of at once, so React Strict Mode's
 * mount → unmount → mount in development keeps one socket rather than opening
 * a second one inside the server's 2s reconnect limit. Closing also empties
 * the chat stores, so the next user of this tab starts clean.
 *
 * A client belongs to one user. If the stored token turns out to be another
 * account's (another tab logged in as someone else), the client closes and the
 * session is verified again; the new user then gets a new client.
 */
import { uuid } from "@/lib/uuid";
import { hasTokens } from "@/lib/auth/storage";
import { verifySession } from "@/lib/auth/session";
import { ChatWSClient } from "@/lib/ws/client";
import { backfillLoadedRooms } from "@/lib/chat/backfill";
import { findByClientMessageId, useMessagesStore } from "@/store/messages";
import { useRoomsStore } from "@/store/rooms";
import { useWsStore } from "@/store/ws";

/** Without an ack by then, a pending message turns failed (RULES.md R6). */
export const ACK_TIMEOUT_MS = 5000;

export type ChatNotice =
  | { kind: "roomExpiring"; roomId: string; roomName: string | null; expiresAt: string }
  | { kind: "roomExpired"; roomId: string; roomName: string | null }
  | { kind: "messagesExpired"; roomId: string; count: number }
  | { kind: "sendFailed"; code: string }
  | { kind: "tooManyConnections" };

/** What the UI does with notices. Toasts and navigation live in ChatConnection.tsx. */
export interface ChatUi {
  notify: (notice: ChatNotice) => void;
}

export interface SendInput {
  roomId: string;
  senderId: string;
  content: string;
  ttlSeconds?: number;
}

let holders = 0;
let releaseTimer: ReturnType<typeof setTimeout> | undefined;
let unbind: (() => void) | null = null;
let ui: ChatUi = { notify: () => {} };
let clientUserId: string | undefined;
const ackTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** `userId` pins the client to that account (see ChatWSClient's `userId` option). */
export function acquireChat(nextUi: ChatUi, userId?: string): void {
  holders += 1;
  ui = nextUi;
  clearTimeout(releaseTimer);
  releaseTimer = undefined;
  const current = useWsStore.getState().client;
  if (current && current.getStatus() !== "closed" && clientUserId === userId) return;
  // It closed itself (session ended, or another account's token), or the user changed.
  if (current) shutdown();
  clientUserId = userId;
  const client = new ChatWSClient({ userId });
  unbind = bindEvents(client);
  useWsStore.getState().setClient(client);
  client.start();
}

export function releaseChat(): void {
  holders = Math.max(0, holders - 1);
  if (holders > 0) return;
  clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => {
    releaseTimer = undefined;
    if (holders === 0) shutdown();
  }, 0);
}

/** Manual reconnect after MAX_CONNECTIONS. */
export function retryChat(): void {
  useWsStore.getState().client?.retry();
}

/** Shows the message at once as pending and sends it. Returns its clientMessageId. */
export function sendChatMessage(input: SendInput): string {
  const clientMessageId = uuid();
  useMessagesStore.getState().addPending({ ...input, clientMessageId });
  transmit(clientMessageId);
  return clientMessageId;
}

/** Resends a failed message with the same clientMessageId, so the server stores it at most once. */
export function retryChatMessage(clientMessageId: string): void {
  useMessagesStore.getState().markPending(clientMessageId);
  transmit(clientMessageId);
}

function transmit(clientMessageId: string): void {
  const messages = useMessagesStore.getState();
  const row = findByClientMessageId(messages.byRoom, clientMessageId);
  if (!row || row.status !== "pending") return;
  clearAckTimer(clientMessageId);
  const sent =
    useWsStore.getState().client?.send("send_message", {
      roomId: row.roomId,
      content: row.content,
      clientMessageId,
      ttlSeconds: row.ttlSeconds ?? 0,
    }) ?? false;
  if (!sent) {
    // No open socket: say so now instead of after the ack timeout.
    messages.failMessage(clientMessageId);
    return;
  }
  ackTimers.set(
    clientMessageId,
    setTimeout(() => {
      ackTimers.delete(clientMessageId);
      useMessagesStore.getState().failMessage(clientMessageId);
    }, ACK_TIMEOUT_MS),
  );
}

function clearAckTimer(clientMessageId: string): void {
  clearTimeout(ackTimers.get(clientMessageId));
  ackTimers.delete(clientMessageId);
}

function bindEvents(client: ChatWSClient): () => void {
  const messages = () => useMessagesStore.getState();
  const rooms = () => useRoomsStore.getState();
  const ws = () => useWsStore.getState();

  const offs = [
    client.onStatus((status) => {
      ws().setStatus(status);
      if (status === "open") void backfillLoadedRooms();
      if (status === "blocked") ui.notify({ kind: "tooManyConnections" });
      // Closed with tokens still stored: they belong to another account now.
      // Re-reading the session switches the screens (and this connection) to it.
      if (status === "closed" && hasTokens()) void verifySession();
    }),
    client.on("new_message", (message) => {
      messages().addLiveMessage(message.roomId, message);
      rooms().touchRoom(message.roomId, message.createdAt, message.senderId);
    }),
    client.on("message_ack", ({ clientMessageId, serverId }) => {
      clearAckTimer(clientMessageId);
      messages().ackMessage(clientMessageId, serverId);
    }),
    client.on("error", ({ code, clientMessageId }) => {
      // Connect rejections are handled inside the client (R2); only send failures name a message.
      if (!clientMessageId) return;
      if (findByClientMessageId(messages().byRoom, clientMessageId)?.status !== "pending") return;
      clearAckTimer(clientMessageId);
      messages().failMessage(clientMessageId);
      ui.notify({ kind: "sendFailed", code });
    }),
    client.on("message_expired", ({ roomId, messageIds }) => {
      const count = messages().removeMessages(roomId, messageIds);
      if (count > 0) ui.notify({ kind: "messagesExpired", roomId, count });
    }),
    client.on("message_burned", ({ roomId, messageId }) => {
      messages().removeMessages(roomId, [messageId]);
    }),
    client.on("read_update", ({ roomId, userId, lastReadAt }) => {
      rooms().markRead(roomId, userId, lastReadAt);
    }),
    client.on("room_expiring", ({ roomId, roomName, expiresAt }) => {
      ws().markRoomExpiring(roomId, { roomName, expiresAt });
      ui.notify({ kind: "roomExpiring", roomId, roomName, expiresAt });
    }),
    client.on("room_expired", ({ roomId, roomName }) => {
      rooms().removeRoom(roomId);
      messages().removeRoom(roomId);
      ws().clearRoomExpiring(roomId);
      ui.notify({ kind: "roomExpired", roomId, roomName });
    }),
  ];
  return () => offs.forEach((off) => off());
}

function shutdown(): void {
  unbind?.();
  unbind = null;
  clientUserId = undefined;
  useWsStore.getState().client?.close();
  ackTimers.forEach((timer) => clearTimeout(timer));
  ackTimers.clear();
  useWsStore.getState().reset();
  useMessagesStore.getState().reset();
  useRoomsStore.getState().reset();
}
