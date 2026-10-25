import { beforeEach, describe, expect, it, vi } from "vitest";
import { setTokens } from "@/lib/auth/storage";
import { listMessages, listRooms } from "./rooms";

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

function installFetch(body: unknown) {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
    async () => jsonResponse(200, body),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// Shapes as server-v2 serializes them: Jackson writes nulls, it does not omit them.
const directRoom = {
  id: "room-1",
  type: "DIRECT",
  name: null,
  lastMessageAt: "2026-10-25T05:13:25.123456Z",
  expiresAt: null,
  members: [
    { userId: "u1", nickname: "Alice", profileImageUrl: null },
    { userId: "u2", nickname: "Bob", profileImageUrl: "https://example.com/b.png" },
  ],
};

const textMessage = {
  id: "m1",
  senderId: "u2",
  senderNickname: "Bob",
  content: "hi",
  type: "TEXT",
  createdAt: "2026-10-25T05:13:25.123456Z",
  expiresAt: null,
  replyToMessageId: null,
  burnAfterRead: false,
};

describe("rooms REST module", () => {
  beforeEach(() => {
    setTokens({ accessToken: makeJwt(Math.floor(Date.now() / 1000) + 3600), refreshToken: "r" });
  });

  it("lists rooms from a plain array", async () => {
    const fetchMock = installFetch([directRoom]);

    await expect(listRooms()).resolves.toEqual([directRoom]);
    expect(String(fetchMock.mock.calls[0][0])).toBe("http://localhost:8080/api/rooms");
  });

  it("rejects a room list that is not a plain array", async () => {
    installFetch({ _embedded: { rooms: [directRoom] } });

    await expect(listRooms()).rejects.toThrow();
  });

  it("requests the latest page without a query string", async () => {
    const fetchMock = installFetch([textMessage]);

    await expect(listMessages("room-1")).resolves.toEqual([textMessage]);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "http://localhost:8080/api/rooms/room-1/messages",
    );
  });

  it("passes the cursor back exactly as the server wrote it", async () => {
    const fetchMock = installFetch([]);

    await listMessages("room/1", {
      cursor: "2026-10-25T05:13:25.123456Z",
      limit: 100,
      direction: "forward",
    });

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe("/api/rooms/room%2F1/messages");
    expect(url.searchParams.get("cursor")).toBe("2026-10-25T05:13:25.123456Z");
    expect(url.searchParams.get("limit")).toBe("100");
    expect(url.searchParams.get("direction")).toBe("forward");
  });

  it("rejects a message type the contract does not know", async () => {
    installFetch([{ ...textMessage, type: "IMAGE" }]);

    await expect(listMessages("room-1")).rejects.toThrow();
  });
});
