/**
 * Users REST module. Contract: geek-chat-server-v2
 * user/presentation/web/UserController.kt and dto/UserDto.kt.
 */
import { z } from "zod";
import { apiFetch } from "./client";
import { usernameSchema } from "./auth";

export const updateUsernameRequestSchema = z.object({ username: usernameSchema });
export type UpdateUsernameRequest = z.infer<typeof updateUsernameRequestSchema>;

const updateUsernameResponseSchema = z.object({ username: z.string() });

export const userSearchResultSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  username: z.string().nullable(),
  profileImageUrl: z.string().nullable(),
});
export type UserSearchResult = z.infer<typeof userSearchResultSchema>;

/**
 * GET /api/users/search (UserService.searchUsers). "@name" matches one username
 * exactly; anything else matches nicknames, up to 10. The caller never appears,
 * and a blank query returns nothing.
 */
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const params = new URLSearchParams({ q: query });
  const res = await apiFetch<unknown>(`/api/users/search?${params.toString()}`);
  return z.array(userSearchResultSchema).parse(res);
}

/** PATCH /api/users/me/username. Resolves to the username the server stored. */
export async function updateUsername(req: UpdateUsernameRequest): Promise<string> {
  const body = updateUsernameRequestSchema.parse(req);
  const res = await apiFetch<unknown>("/api/users/me/username", { method: "PATCH", body });
  return updateUsernameResponseSchema.parse(res).username;
}
