import { afterEach, describe, expect, it, vi } from "vitest";
import { devLogin, passwordSchema } from "./auth";

describe("devLogin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refuses to run in a production build", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(devLogin("alice")).rejects.toThrow("only available in development");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

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
