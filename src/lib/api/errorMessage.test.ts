import { describe, expect, it } from "vitest";
import { ko } from "@/i18n/ko";
import { ApiError, AuthExpiredError } from "./client";
import { describeApiError, type ErrorContext } from "./errorMessage";

// Error bodies as geek-chat-server-v2 sends them: `error` is the reason phrase.
const apiError = (status: number, message: string, reason: string) =>
  new ApiError(status, { statusCode: status, message, error: reason }, message);

describe("describeApiError", () => {
  it.each<[string, unknown, ErrorContext, string]>([
    ["network failure", new TypeError("Failed to fetch"), "login", ko["auth.error.network"]],
    ["unexpected non-API error", new Error("boom"), "signup", ko["auth.error.unknown"]],
    ["expired session", new AuthExpiredError(401, null, "x"), "generic", ko["auth.error.TokenExpired"]],
    ["server error", apiError(503, "Service Unavailable", "Service Unavailable"), "username", ko["auth.error.server"]],
    ["wrong password", apiError(401, "Invalid username or password", "Unauthorized"), "login", ko["auth.error.InvalidCredentials"]],
    ["withdrawn account on login", apiError(403, "Account has been withdrawn", "Forbidden"), "login", ko["auth.error.AccountWithdrawn"]],
    ["taken username on signup", apiError(409, "Username already taken: alice", "Conflict"), "signup", ko["auth.error.UsernameAlreadyTaken"]],
    ["taken email on signup", apiError(409, "Email already in use: a@b.c", "Conflict"), "signup", ko["auth.error.EmailAlreadyInUse"]],
    ["weak password on signup", apiError(400, "Password must contain at least one digit", "Bad Request"), "signup", ko["auth.error.WeakPassword"]],
    ["other bad input on signup", apiError(400, "Nickname is required", "Bad Request"), "signup", ko["auth.error.invalidInput"]],
    ["taken username on change", apiError(409, "Username already taken: bob", "Conflict"), "username", ko["auth.error.UsernameAlreadyTaken"]],
    ["expired link token", apiError(401, "Invalid or expired link token", "Unauthorized"), "oauthLink", ko["auth.error.oauthTokenExpired"]],
    ["provider already linked", apiError(401, "Provider already linked", "Unauthorized"), "oauthLink", ko["auth.error.ProviderAlreadyLinked"]],
    ["expired signup token", apiError(401, "Invalid or expired signup token", "Unauthorized"), "oauthComplete", ko["auth.error.oauthTokenExpired"]],
    ["unmapped status", apiError(404, "User not found: u1", "Not Found"), "generic", ko["auth.error.unknown"]],
  ])("%s", (_name, err, context, expected) => {
    expect(describeApiError(err, context)).toBe(expected);
  });

  it("does not read the reason phrase as a domain code", () => {
    // Phase 1.1 looked up `error` ("Conflict") in the message map and always fell back to unknown.
    const err = apiError(409, "Username already taken: alice", "Conflict");
    expect(describeApiError(err, "signup")).not.toBe(ko["auth.error.unknown"]);
  });

  it("falls back on the status when the body is not the server's error shape", () => {
    // Spring's default 400 body (bean validation) has no statusCode/message, so readErrorBody yields null.
    const err = new ApiError(400, null, "HTTP 400");
    expect(describeApiError(err, "signup")).toBe(ko["auth.error.invalidInput"]);
  });
});
