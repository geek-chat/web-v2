import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTokens } from "@/lib/auth/storage";
import { FakeWebSocket, makeJwt } from "@/test/fakeWebSocket";

vi.mock("@/lib/chat/backfill", () => ({ backfillLoadedRooms: vi.fn(async () => {}) }));
vi.mock("@/lib/auth/session", () => ({ verifySession: vi.fn(async () => {}) }));

// connection.ts keeps module state, so every test loads a fresh copy.
async function load() {
  vi.resetModules();
  const connection = await import("./connection");
  const { verifySession } = await import("@/lib/auth/session");
  const { useMessagesStore } = await import("@/store/messages");
  return { ...connection, verifySession, useMessagesStore };
}

const inOneHour = () => Math.floor(Date.now() / 1000) + 3600;
const ui = { notify: vi.fn() };

describe("chat connection and the signed-in account", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.stubGlobal("WebSocket", FakeWebSocket);
    FakeWebSocket.instances = [];
    setTokens({ accessToken: makeJwt(inOneHour(), "u1"), refreshToken: "r1" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts a new client, with empty stores, when the user changes", async () => {
    const chat = await load();
    chat.acquireChat(ui, "u1");
    const first = FakeWebSocket.latest();
    first.open();
    first.emit("new_message", {
      id: "m1",
      roomId: "r1",
      senderId: "u2",
      content: "hi",
      type: "TEXT",
      createdAt: "2026-10-25T05:00:01Z",
      expiresAt: null,
      replyToMessageId: null,
      burnAfterRead: false,
    });

    setTokens({ accessToken: makeJwt(inOneHour(), "u2"), refreshToken: "r2" });
    chat.releaseChat();
    chat.acquireChat(ui, "u2");

    expect(first.closedWith).toBe(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(chat.useMessagesStore.getState().byRoom).toEqual({});
  });

  it("verifies the session again when another account's token shows up", async () => {
    const chat = await load();
    chat.acquireChat(ui, "u1");
    FakeWebSocket.latest().open();
    FakeWebSocket.latest().drop(1006);

    setTokens({ accessToken: makeJwt(inOneHour(), "u2"), refreshToken: "r2" });
    await vi.advanceTimersByTimeAsync(2000);

    expect(chat.verifySession).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("does not verify again when the session simply ended", async () => {
    const chat = await load();
    chat.acquireChat(ui, "u1");
    FakeWebSocket.latest().drop(1006);

    window.localStorage.clear(); // e.g. a logout elsewhere
    await vi.advanceTimersByTimeAsync(2000);

    expect(chat.verifySession).not.toHaveBeenCalled();
  });
});
