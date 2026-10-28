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
  // When the member last read the room (the createdAt of the message read),
  // null until they read. Only GET /api/rooms carries it (server-v2 bf2c85d);
  // older servers leave it out, and it only seeds read receipts.
  lastReadAt: z.string().nullish(),
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

/** Room lifetimes the UI offers, in hours (API.md). The server applies ttlHours to GROUP rooms only. */
export const ROOM_TTL_HOURS = [24, 168, 720] as const;
/** ChatRoom.MAX_GROUP_MEMBERS, the creator included. */
export const MAX_GROUP_MEMBERS = 100;

export const createRoomRequestSchema = z.object({
  memberIds: z.array(z.string().min(1)).min(1).max(MAX_GROUP_MEMBERS - 1),
  name: z.string().trim().min(1).optional(),
  ttlHours: z.union([z.literal(24), z.literal(168), z.literal(720)]).optional(),
});
export type CreateRoomRequest = z.infer<typeof createRoomRequestSchema>;

/** CreateRoomResponse: no lastMessageAt and no member avatars, unlike a list row. */
export const createdRoomSchema = z.object({
  id: z.string(),
  type: roomTypeSchema,
  name: z.string().nullable(),
  expiresAt: z.string().nullable(),
  members: z.array(z.object({ userId: z.string(), nickname: z.string() })),
});
export type CreatedRoom = z.infer<typeof createdRoomSchema>;

/** A create response shaped as a list row; the missing fields are empty, for the store to fill from what it holds. */
export function toRoom(created: CreatedRoom): Room {
  return {
    ...created,
    lastMessageAt: null,
    members: created.members.map((member) => ({ ...member, profileImageUrl: null })),
  };
}

/**
 * POST /api/rooms (ChatRoomService.createRoom). One member and no name opens a
 * DIRECT room, or returns the one that already exists; anything else creates a
 * GROUP room (named "Group" when the name is left out).
 */
export async function createRoom(req: CreateRoomRequest): Promise<CreatedRoom> {
  const body = createRoomRequestSchema.parse(req);
  const res = await apiFetch<unknown>("/api/rooms", { method: "POST", body });
  return createdRoomSchema.parse(res);
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
