import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTokens } from "@/lib/auth/storage";
import { FakeWebSocket, makeJwt } from "@/test/fakeWebSocket";

vi.mock("@/lib/chat/backfill", () => ({ backfillLoadedRooms: vi.fn(async () => {}) }));

// connection.ts keeps module state (holders, timers), so every test loads a fresh copy.
async function load() {
  vi.resetModules();
  const connection = await import("./connection");
  const { useMessagesStore } = await import("@/store/messages");
  const { useRoomsStore } = await import("@/store/rooms");
  const { useWsStore } = await import("@/store/ws");
  const { backfillLoadedRooms } = await import("@/lib/chat/backfill");
  return { ...connection, useMessagesStore, useRoomsStore, useWsStore, backfillLoadedRooms };
}

const server = (id: string, roomId: string, createdAt: string) => ({
  id,
  roomId,
  senderId: "u2",
  content: id,
  type: "TEXT",
  createdAt,
  expiresAt: null,
  replyToMessageId: null,
  burnAfterRead: false,
});

describe("chat connection", () => {
  const notify = vi.fn();
  const ui = { notify };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.stubGlobal("WebSocket", FakeWebSocket);
    FakeWebSocket.instances = [];
    notify.mockClear();
    setTokens({ accessToken: makeJwt(Math.floor(Date.now() / 1000) + 3600), refreshToken: "r1" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Acquires and accepts the connection, then returns its socket. */
  async function connected(chat: Awaited<ReturnType<typeof load>>) {
    chat.acquireChat(ui);
    const socket = FakeWebSocket.latest();
    socket.open();
    await vi.advanceTimersByTimeAsync(1000);
    return socket;
  }

  it("keeps one socket through Strict Mode's mount, unmount, mount", async () => {
    const chat = await load();

    chat.acquireChat(ui);
    chat.releaseChat();
    chat.acquireChat(ui);
    await vi.advanceTimersByTimeAsync(0);

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.latest().closedWith).toBeUndefined();
  });

  it("closes the socket and empties the chat stores after the last release", async () => {
    const chat = await load();
    const socket = await connected(chat);
    socket.emit("new_message", server("m1", "r1", "2026-10-25T05:00:01Z"));

    chat.releaseChat();
    await vi.advanceTimersByTimeAsync(0);

    expect(socket.closedWith).toBe(1000);
    expect(chat.useMessagesStore.getState().byRoom).toEqual({});
    expect(chat.useWsStore.getState()).toMatchObject({ client: null, status: "idle" });
  });

  it("backfills each time the server accepts the connection", async () => {
    const chat = await load();

    await connected(chat);
    expect(chat.backfillLoadedRooms).toHaveBeenCalledTimes(1);

    FakeWebSocket.latest().drop(1006);
    await vi.advanceTimersByTimeAsync(2000);
    FakeWebSocket.latest().open();
    await vi.advanceTimersByTimeAsync(1000);
    expect(chat.backfillLoadedRooms).toHaveBeenCalledTimes(2);
  });

  it("stores new messages and flags a room the list does not have", async () => {
    const chat = await load();
    chat.useRoomsStore.getState().setRooms([]);
    const socket = await connected(chat);

    socket.emit("new_message", server("m1", "r9", "2026-10-25T05:00:01Z"));

    expect(chat.useMessagesStore.getState().byRoom.r9.map((m) => m.id)).toEqual(["m1"]);
    expect(chat.useRoomsStore.getState().stale).toBe(true);
  });

  describe("sending", () => {
    const input = { roomId: "r1", senderId: "u1", content: "hi", ttlSeconds: 30 };
    const row = (chat: Awaited<ReturnType<typeof load>>) => chat.useMessagesStore.getState().byRoom.r1[0];

    it("sends a pending message and settles it on the ack", async () => {
      const chat = await load();
      const socket = await connected(chat);

      const clientMessageId = chat.sendChatMessage(input);

      expect(row(chat)).toMatchObject({ id: clientMessageId, status: "pending" });
      expect(socket.frames()).toEqual([
        { type: "send_message", data: { roomId: "r1", content: "hi", clientMessageId, ttlSeconds: 30 } },
      ]);
      socket.emit("message_ack", { clientMessageId, serverId: "m9" });
      await vi.advanceTimersByTimeAsync(5000); // the ack cleared the timeout
      expect(row(chat)).toMatchObject({ id: "m9", status: "sent" });
    });

    it("fails at once when no socket is open", async () => {
      const chat = await load();
      chat.acquireChat(ui); // still connecting

      chat.sendChatMessage(input);

      expect(row(chat).status).toBe("failed");
      expect(FakeWebSocket.latest().sent).toEqual([]);
    });

    it("fails after 5s without an ack", async () => {
      const chat = await load();
      await connected(chat);

      chat.sendChatMessage(input);
      await vi.advanceTimersByTimeAsync(4999);
      expect(row(chat).status).toBe("pending");
      await vi.advanceTimersByTimeAsync(1);
      expect(row(chat).status).toBe("failed");
    });

    it("fails on SEND_FAILED and retries with the same clientMessageId", async () => {
      const chat = await load();
      const socket = await connected(chat);
      const clientMessageId = chat.sendChatMessage(input);

      await vi.advanceTimersByTimeAsync(1000);
      socket.emit("error", { code: "SEND_FAILED", message: "Not a member", clientMessageId });
      expect(row(chat).status).toBe("failed");
      expect(notify).toHaveBeenCalledWith({ kind: "sendFailed", code: "SEND_FAILED" });

      chat.retryChatMessage(clientMessageId);
      expect(socket.frames().map((f) => f.data.clientMessageId)).toEqual([clientMessageId, clientMessageId]);
      // The first attempt's timeout (sent at 1s, due at 6s) must not fail the retry (due at 7s).
      await vi.advanceTimersByTimeAsync(4500);
      expect(row(chat).status).toBe("pending");
    });

    it("ignores a send error for a message it no longer waits on", async () => {
      const chat = await load();
      const socket = await connected(chat);

      socket.emit("error", { code: "SEND_FAILED", message: "Not a member", clientMessageId: "unknown" });

      expect(notify).not.toHaveBeenCalled();
    });
  });

  it("removes expired and burned messages, and says so only when something went", async () => {
    const chat = await load();
    const socket = await connected(chat);
    socket.emit("new_message", server("m1", "r1", "2026-10-25T05:00:01Z"));
    socket.emit("new_message", server("m2", "r1", "2026-10-25T05:00:02Z"));

    socket.emit("message_expired", { roomId: "r1", messageIds: ["m1"] });
    socket.emit("message_expired", { roomId: "r1", messageIds: ["gone"] });
    socket.emit("message_burned", { roomId: "r1", messageId: "m2" });

    expect(chat.useMessagesStore.getState().byRoom.r1).toEqual([]);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith({ kind: "messagesExpired", roomId: "r1", count: 1 });
  });

  it("tracks an expiring room and drops it when it expires", async () => {
    const chat = await load();
    chat.useRoomsStore.getState().setRooms([
      { id: "r1", type: "GROUP", name: "study", lastMessageAt: null, expiresAt: "2026-10-25T05:10:00Z", members: [] },
    ]);
    const socket = await connected(chat);
    socket.emit("new_message", server("m1", "r1", "2026-10-25T05:00:01Z"));

    socket.emit("room_expiring", { roomId: "r1", roomName: "study", expiresAt: "2026-10-25T05:10:00Z" });
    expect(chat.useWsStore.getState().expiringRooms).toEqual({
      r1: { roomName: "study", expiresAt: "2026-10-25T05:10:00Z" },
    });

    socket.emit("room_expired", { roomId: "r1", roomName: "study" });
    expect(chat.useRoomsStore.getState().rooms).toEqual([]);
    expect(chat.useMessagesStore.getState().byRoom).toEqual({});
    expect(chat.useWsStore.getState().expiringRooms).toEqual({});
    expect(notify).toHaveBeenLastCalledWith({ kind: "roomExpired", roomId: "r1", roomName: "study" });
  });

  it("asks for a manual retry at MAX_CONNECTIONS", async () => {
    const chat = await load();
    chat.acquireChat(ui);

    FakeWebSocket.latest().reject("MAX_CONNECTIONS");
    expect(notify).toHaveBeenCalledWith({ kind: "tooManyConnections" });
    expect(chat.useWsStore.getState().status).toBe("blocked");

    chat.retryChat();
    expect(FakeWebSocket.instances).toHaveLength(2);
  });
});

describe("chat connection: read receipts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeWebSocket);
    FakeWebSocket.instances = [];
    setTokens({ accessToken: makeJwt(Math.floor(Date.now() / 1000) + 3600), refreshToken: "r1" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("records read_update as the member's read point", async () => {
    const chat = await load();
    chat.acquireChat({ notify: vi.fn() });
    const socket = FakeWebSocket.latest();
    socket.open();

    socket.emit("read_update", { roomId: "r1", userId: "u2", lastReadAt: "2026-10-25T05:00:01Z" });

    expect(chat.useRoomsStore.getState().reads).toEqual({ r1: { u2: "2026-10-25T05:00:01Z" } });
  });
});
