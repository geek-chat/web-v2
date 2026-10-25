import { beforeEach, describe, expect, it, vi } from "vitest";
import { setTokens } from "@/lib/auth/storage";
import { createInviteLink, inviteUrl, isInviteCode, joinInvite } from "./invite";

function makeJwt(expSec: number): string {
  const enc = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: "u1", exp: expSec })}.sig`;
}

function installFetch(body: unknown) {
  const text = JSON.stringify(body);
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
    async () =>
      ({ status: 200, ok: true, text: async () => text, json: async () => JSON.parse(text) }) as unknown as Response,
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// As InviteLinkResponse and the join response (CreateRoomResponse plus HATEOAS links) serialize.
const link = { code: "AbC12dEf", roomId: "room-9", expiresAt: "2026-10-26T12:00:00.123456Z", maxUses: null, currentUses: 0 };
const joinedRoom = {
  id: "room-9",
  type: "GROUP",
  name: "스터디",
  expiresAt: null,
  members: [
    { userId: "u1", nickname: "Alice" },
    { userId: "u3", nickname: "Cara" },
  ],
  _links: { self: { href: "/api/rooms/room-9" } },
};

describe("invite REST module", () => {
  beforeEach(() => {
    setTokens({ accessToken: makeJwt(Math.floor(Date.now() / 1000) + 3600), refreshToken: "r" });
  });

  it("creates a link with the server defaults", async () => {
    const fetchMock = installFetch(link);

    await expect(createInviteLink("room-9")).resolves.toEqual(link);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("http://localhost:8080/api/rooms/room-9/invite-link");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({}); // the endpoint requires a body
  });

  it("joins by code and returns the room as a list row", async () => {
    const fetchMock = installFetch(joinedRoom);

    const room = await joinInvite("AbC12dEf");

    expect(String(fetchMock.mock.calls[0][0])).toBe("http://localhost:8080/api/invite/AbC12dEf/join");
    expect(room).toEqual({
      id: "room-9",
      type: "GROUP",
      name: "스터디",
      expiresAt: null,
      lastMessageAt: null,
      members: [
        { userId: "u1", nickname: "Alice", profileImageUrl: null },
        { userId: "u3", nickname: "Cara", profileImageUrl: null },
      ],
    });
  });

  it("refuses a code the server could not have made, without a request", async () => {
    const fetchMock = installFetch(joinedRoom);

    for (const code of ["", "../rooms", "a/b", "AbC12dEf?x=1", "한글코드"]) {
      expect(isInviteCode(code)).toBe(false);
      await expect(joinInvite(code)).rejects.toThrow();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shares this app's invite page", () => {
    expect(inviteUrl("AbC12dEf", "https://web-lac-one-89.vercel.app")).toBe(
      "https://web-lac-one-89.vercel.app/invite/AbC12dEf",
    );
  });
});
