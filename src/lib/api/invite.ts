/**
 * Invite links (server-v2 docs/API.md §4, InviteLinkController).
 *
 * Any member can make a link and every call makes a new one. The server does
 * not check the room type (reported as S18), so the UI offers links in GROUP
 * rooms only.
 */
import { z } from "zod";
import { apiFetch } from "./client";
import { createdRoomSchema, toRoom, type Room } from "./rooms";

// The server's codes are 8 letters and digits (InviteLink.generateCode).
// Anything else did not come from it, and must not reshape the API path.
const INVITE_CODE = /^[A-Za-z0-9]{1,64}$/;

export function isInviteCode(code: string): boolean {
  return INVITE_CODE.test(code);
}

/** Omitted fields take the server defaults: 24 hours, unlimited uses. */
export const createInviteLinkRequestSchema = z.object({
  ttlHours: z.number().int().positive().optional(),
  maxUses: z.number().int().positive().nullable().optional(),
});
export type CreateInviteLinkRequest = z.infer<typeof createInviteLinkRequestSchema>;

export const inviteLinkSchema = z.object({
  code: z.string(),
  roomId: z.string(),
  expiresAt: z.string(),
  maxUses: z.number().int().nullable(),
  currentUses: z.number().int(),
});
export type InviteLink = z.infer<typeof inviteLinkSchema>;

export async function createInviteLink(
  roomId: string,
  req: CreateInviteLinkRequest = {},
): Promise<InviteLink> {
  const body = createInviteLinkRequestSchema.parse(req);
  const res = await apiFetch<unknown>(`/api/rooms/${encodeURIComponent(roomId)}/invite-link`, {
    method: "POST",
    body,
  });
  return inviteLinkSchema.parse(res);
}

/**
 * Joins the room behind `code` and returns it as a list row. Errors: 404 no
 * such link, 410 expired or used up, 409 already a member (the body names no
 * room), 400 room full.
 */
export async function joinInvite(code: string): Promise<Room> {
  if (!isInviteCode(code)) throw new Error(`Not an invite code: ${code}`);
  const res = await apiFetch<unknown>(`/api/invite/${encodeURIComponent(code)}/join`, {
    method: "POST",
  });
  return toRoom(createdRoomSchema.parse(res));
}

/** The address to share: this app's invite page for `code`. */
export function inviteUrl(code: string, origin: string = window.location.origin): string {
  return `${origin}/invite/${encodeURIComponent(code)}`;
}
