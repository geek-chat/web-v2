import { describe, expect, it, vi } from "vitest";
import { setTokens } from "@/lib/auth/storage";
import { updateUsername } from "./users";

function makeJwt(expSec: number): string {
  const enc = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: "u1", exp: expSec })}.sig`;
}

function jsonResponse(status: number, body: unknown): Response {
  const text = JSON.stringify(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => text,
    json: async () => JSON.parse(text),
  } as unknown as Response;
}

describe("updateUsername", () => {
  it("sends a JSON PATCH and resolves to the stored username", async () => {
    setTokens({ accessToken: makeJwt(Math.floor(Date.now() / 1000) + 3600), refreshToken: "r" });
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => jsonResponse(200, { username: "alice_2" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(updateUsername({ username: "alice_2" })).resolves.toBe("alice_2");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("http://localhost:8080/api/users/me/username");
    expect(init?.method).toBe("PATCH");
    // 2026-05 review BLOCKER: a body without this header gets a 415 from Spring.
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({ username: "alice_2" });
  });

  it("rejects a username the server would refuse, before any request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(updateUsername({ username: "Bad Name" })).rejects.toThrow();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("searchUsers", () => {
  it("encodes the query and parses the results", async () => {
    setTokens({ accessToken: makeJwt(Math.floor(Date.now() / 1000) + 3600), refreshToken: "r" });
    const found = { id: "u2", nickname: "밥", username: null, profileImageUrl: null };
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => jsonResponse(200, [found]),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { searchUsers } = await import("./users");

    await expect(searchUsers("@bob 밥")).resolves.toEqual([found]);

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe("/api/users/search");
    expect(url.searchParams.get("q")).toBe("@bob 밥");
  });
});
