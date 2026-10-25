import { describe, expect, it } from "vitest";
import { passwordSchema } from "./auth";

// Mirrors geek-chat-server-v2 AuthService.validatePassword: 8+ chars, a digit, a letter.
describe("passwordSchema", () => {
  it.each(["abcd1234", "한글비밀번호12", "Passw0rd!"])("accepts %s", (password) => {
    expect(passwordSchema.safeParse(password).success).toBe(true);
  });

  it.each([
    ["too short", "abc123"],
    ["no digit", "abcdefgh"],
    ["no letter", "12345678"],
  ])("rejects a password with %s", (_reason, password) => {
    expect(passwordSchema.safeParse(password).success).toBe(false);
  });
});
