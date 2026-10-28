/**
 * WebSocket event contract. Source: geek-chat-server-v2 docs/WEBSOCKET.md
 * and, where the two differ, the code (ChatWebSocketHandler,
 * ChatEventListener). Every frame is `{ type, data }` in both directions.
 */
import { z } from "zod";
import { messageTypeSchema } from "@/lib/api/rooms";

const serverEventSchemas = {
  message_ack: z.object({ clientMessageId: z.string(), serverId: z.string() }),
  new_message: z.object({
    id: z.string(),
    roomId: z.string(),
    senderId: z.string(),
    content: z.string(),
    type: messageTypeSchema,
    createdAt: z.string(),
    expiresAt: z.string().nullable(),
    replyToMessageId: z.string().nullable(),
    burnAfterRead: z.boolean(),
  }),
  typing_indicator: z.object({ roomId: z.string(), userId: z.string() }),
  read_update: z.object({ roomId: z.string(), userId: z.string(), lastReadAt: z.string() }),
  room_expiring: z.object({
    roomId: z.string(),
    roomName: z.string().nullable(),
    expiresAt: z.string(),
  }),
  room_expired: z.object({ roomId: z.string(), roomName: z.string().nullable() }),
  message_expired: z.object({ roomId: z.string(), messageIds: z.array(z.string()) }),
  message_burned: z.object({ roomId: z.string(), messageId: z.string() }),
  // clientMessageId comes only with send_message failures (WEBSOCKET.md §4.9).
  error: z.object({
    code: z.string(),
    message: z.string(),
    clientMessageId: z.string().optional(),
  }),
};

export type ServerEventMap = {
  [K in keyof typeof serverEventSchemas]: z.infer<(typeof serverEventSchemas)[K]>;
};
export type ServerEventType = keyof ServerEventMap;
export type ServerEvent = {
  [K in ServerEventType]: { type: K; data: ServerEventMap[K] };
}[ServerEventType];

const envelopeSchema = z.object({ type: z.string(), data: z.unknown() });

function isServerEventType(type: string): type is ServerEventType {
  return Object.hasOwn(serverEventSchemas, type);
}

/** Parses one frame. An unknown type or a shape outside the contract comes back as null. */
export function parseServerEvent(raw: unknown): ServerEvent | null {
  if (typeof raw !== "string") return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const envelope = envelopeSchema.safeParse(json);
  if (!envelope.success || !isServerEventType(envelope.data.type)) return null;
  const type = envelope.data.type;
  const data = serverEventSchemas[type].safeParse(envelope.data.data);
  return data.success ? ({ type, data: data.data } as ServerEvent) : null;
}

/** What web-v2 sends (ChatWebSocketHandler.handleTextMessage). */
export interface ClientEventMap {
  send_message: {
    roomId: string;
    content: string;
    /** Idempotency key: a retry must send the same value. */
    clientMessageId: string;
    ttlSeconds?: number;
    replyToMessageId?: string | null;
  };
  typing_start: { roomId: string };
  mark_read: { roomId: string; lastReadMessageId: string };
}
export type ClientEventType = keyof ClientEventMap;

/**
 * Codes of the `error` frame that ends a connection. The server sends one
 * right before it closes a connection it rejects in the handshake
 * (ChatWebSocketHandler.reject), and ACCOUNT_WITHDRAWN also to the open
 * connections of an account that has just been withdrawn
 * (WithdrawnUserDisconnector). Send failures use other codes.
 */
export const CONNECT_REJECTION_CODES = [
  "NO_TOKEN",
  "TOKEN_EXPIRED",
  "INVALID_TOKEN",
  "RATE_LIMITED",
  "MAX_CONNECTIONS",
  "ACCOUNT_WITHDRAWN",
] as const;
export type ConnectRejectionCode = (typeof CONNECT_REJECTION_CODES)[number];

export function isConnectRejectionCode(code: string): code is ConnectRejectionCode {
  return (CONNECT_REJECTION_CODES as readonly string[]).includes(code);
}
