/**
 * Auth REST module.
 *
 * Backend contract anchors (verbatim from
 * geek-chat-server-v2/.../adapter/in/web/dto/AuthDto.kt):
 *   - REST DTOs use camelCase (`accessToken`, `refreshToken`).
 *   - OAuth URL fragments use snake_case (`access_token`, `refresh_token`) —
 *     handled in `@/lib/auth/oauthCallback`, not here.
 *   - All requests/responses validated with zod schemas defined alongside
 *     each function (request + response).
 *
 * Username regex matches backend exactly: ^[a-z0-9_]{3,20}$
 * Password length matches backend: 8..72.
 * Nickname matches backend: 1..20 chars.
 */
import { z } from "zod";
import { env } from "@/lib/env";
import { apiFetch } from "./client";

// ─── Reusable schemas ────────────────────────────────────────────────────

export const usernameSchema = z
  .string()
  .regex(/^[a-z0-9_]{3,20}$/, "사용자명은 영소문자/숫자/_ 3~20자입니다");
export const passwordSchema = z
  .string()
  .min(8, "비밀번호는 최소 8자")
  .max(72, "비밀번호는 최대 72자");
export const nicknameSchema = z
  .string()
  .min(1, "닉네임을 입력하세요")
  .max(20, "닉네임은 최대 20자");
export const emailSchema = z.email("이메일 형식이 올바르지 않습니다");

export const tokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type TokenPair = z.infer<typeof tokenPairSchema>;

export const userMeSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  username: z.string().nullable(),
  profileImageUrl: z.string().nullable(),
});
export type UserMe = z.infer<typeof userMeSchema>;

export const signupTokenSchema = z.object({
  signupToken: z.string(),
  suggestedNickname: z.string(),
});
export type SignupTokenResponse = z.infer<typeof signupTokenSchema>;

export const successSchema = z.object({ success: z.literal(true) });

// ─── Signup / Login ──────────────────────────────────────────────────────

export const signupRequestSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  nickname: nicknameSchema,
  email: emailSchema.optional(),
});
export type SignupRequest = z.infer<typeof signupRequestSchema>;

export async function signup(req: SignupRequest): Promise<TokenPair> {
  // Pass plain object; apiFetch auto-serializes + sets Content-Type: application/json.
  // Pre-stringifying drops the header → backend 415.
  const body = signupRequestSchema.parse(req);
  const res = await apiFetch<unknown>("/auth/signup", {
    method: "POST",
    body,
    auth: false,
  });
  return tokenPairSchema.parse(res);
}

export const loginRequestSchema = z.object({
  username: z.string().min(1, "사용자명을 입력하세요"),
  password: z.string().min(1, "비밀번호를 입력하세요"),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export async function login(req: LoginRequest): Promise<TokenPair> {
  const body = loginRequestSchema.parse(req);
  const res = await apiFetch<unknown>("/auth/login", {
    method: "POST",
    body,
    auth: false,
  });
  return tokenPairSchema.parse(res);
}

// ─── Refresh / Logout ────────────────────────────────────────────────────
// `refresh` lives inside client.ts because the wrapper needs to call it
// without re-entering itself. We re-export the schema for testing.

export const refreshRequestSchema = z.object({ refreshToken: z.string().min(1) });
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

export async function logout(refreshToken: string | null): Promise<void> {
  // Backend accepts logout without auth header (refresh token IS the auth here).
  await apiFetch<unknown>("/auth/logout", {
    method: "POST",
    body: { refreshToken: refreshToken ?? "" },
    auth: false,
  });
}

// ─── /auth/me + Withdraw ─────────────────────────────────────────────────

export async function me(): Promise<UserMe> {
  const res = await apiFetch<unknown>("/auth/me", { method: "GET" });
  return userMeSchema.parse(res);
}

export async function withdraw(): Promise<void> {
  await apiFetch<unknown>("/auth/withdraw", { method: "POST" });
}

// ─── OAuth: complete signup, link provider ───────────────────────────────

export const completeOAuthSignupRequestSchema = z.object({
  signupToken: z.string().min(1),
  nickname: nicknameSchema,
});
export type CompleteOAuthSignupRequest = z.infer<typeof completeOAuthSignupRequestSchema>;

export async function completeOAuthSignup(
  req: CompleteOAuthSignupRequest,
): Promise<TokenPair> {
  const body = completeOAuthSignupRequestSchema.parse(req);
  const res = await apiFetch<unknown>("/auth/oauth/complete-signup", {
    method: "POST",
    body,
    auth: false,
  });
  return tokenPairSchema.parse(res);
}

export const linkProviderRequestSchema = z.object({
  linkToken: z.string().min(1),
  confirm: z.boolean(),
});
export type LinkProviderRequest = z.infer<typeof linkProviderRequestSchema>;

/**
 * Backend can return either TokenPair (linked → logged in)
 * or SignupTokenResponse (declined → falls back to fresh signup).
 * Discriminated by presence of `accessToken`.
 */
export type LinkProviderResult =
  | { kind: "logged_in"; tokens: TokenPair }
  | { kind: "signup_required"; signupToken: string; suggestedNickname: string };

export async function linkProvider(
  req: LinkProviderRequest,
): Promise<LinkProviderResult> {
  const body = linkProviderRequestSchema.parse(req);
  const res = await apiFetch<unknown>("/auth/link-provider", {
    method: "POST",
    body,
    auth: false,
  });
  // Discriminate by shape.
  const tokens = tokenPairSchema.safeParse(res);
  if (tokens.success) return { kind: "logged_in", tokens: tokens.data };
  const signup = signupTokenSchema.parse(res);
  return {
    kind: "signup_required",
    signupToken: signup.signupToken,
    suggestedNickname: signup.suggestedNickname,
  };
}

// ─── OAuth provider URLs (full window navigation) ────────────────────────

export type OAuthProvider = "google" | "naver";

export function oauthStartUrl(provider: OAuthProvider): string {
  // Use the validated env singleton — `process.env.NEXT_PUBLIC_*` with an empty
  // fallback would silently produce a relative URL on misconfigured builds.
  return `${env.NEXT_PUBLIC_API_URL}/auth/${provider}`;
}

// ─── Dev login (development convenience) ─────────────────────────────────

export const devLoginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  message: z.string(),
});

export async function devLogin(name: string): Promise<TokenPair> {
  const res = await apiFetch<unknown>(
    `/auth/dev-login?name=${encodeURIComponent(name)}`,
    { method: "GET", auth: false },
  );
  const parsed = devLoginResponseSchema.parse(res);
  return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
}
