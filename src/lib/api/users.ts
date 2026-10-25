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

/** PATCH /api/users/me/username. Resolves to the username the server stored. */
export async function updateUsername(req: UpdateUsernameRequest): Promise<string> {
  const body = updateUsernameRequestSchema.parse(req);
  const res = await apiFetch<unknown>("/api/users/me/username", { method: "PATCH", body });
  return updateUsernameResponseSchema.parse(res).username;
}
