/**
 * Rooms REST module. Contract: geek-chat-server-v2
 * room/presentation/web/RoomDto.kt (RoomListResponse) and
 * chat/presentation/web/MessageDto.kt (MessageResponse).
 */
import { z } from "zod";
import { apiFetch } from "./client";

export const roomTypeSchema = z.enum(["DIRECT", "GROUP"]);
export const messageTypeSchema = z.enum(["TEXT", "SYSTEM"]);
export type MessageType = z.infer<typeof messageTypeSchema>;

export const roomMemberSchema = z.object({
  userId: z.string(),
  nickname: z.string(),
  profileImageUrl: z.string().nullable(),
});

export const roomSchema = z.object({
  id: z.string(),
  type: roomTypeSchema,
  name: z.string().nullable(),
  lastMessageAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  members: z.array(roomMemberSchema),
});
export type Room = z.infer<typeof roomSchema>;

/** One row of GET /api/rooms/:id/messages. The room id is the path, not a field. */
export const messageSchema = z.object({
  id: z.string(),
  senderId: z.string(),
  senderNickname: z.string(),
  content: z.string(),
  type: messageTypeSchema,
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
  replyToMessageId: z.string().nullable(),
  burnAfterRead: z.boolean(),
});
export type MessageDto = z.infer<typeof messageSchema>;

/** GET /api/rooms. A plain array: the server skips CollectionModel on purpose (RoomController). */
export async function listRooms(): Promise<Room[]> {
  const res = await apiFetch<unknown>("/api/rooms");
  return z.array(roomSchema).parse(res);
}

/** The server clamps `limit` into 1..100 (MessageService.getMessages). */
export const MESSAGE_PAGE_MAX = 100;

export interface ListMessagesQuery {
  /** A createdAt the server sent, passed back as the exact string. Omit for the latest page. */
  cursor?: string;
  limit?: number;
  direction?: "forward" | "backward";
}

/**
 * GET /api/rooms/:id/messages. Rows come in the server's order: the latest
 * and `backward` pages newest first, `forward` pages oldest first
 * (SpringDataMessageRepository). Callers merge by id and sort.
 */
export async function listMessages(
  roomId: string,
  query: ListMessagesQuery = {},
): Promise<MessageDto[]> {
  const params = new URLSearchParams();
  if (query.cursor !== undefined) params.set("cursor", query.cursor);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.direction !== undefined) params.set("direction", query.direction);
  const qs = params.toString();
  const res = await apiFetch<unknown>(
    `/api/rooms/${encodeURIComponent(roomId)}/messages${qs ? `?${qs}` : ""}`,
  );
  return z.array(messageSchema).parse(res);
}
