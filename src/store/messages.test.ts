import { beforeEach, describe, expect, it } from "vitest";
import {
  newestServerCreatedAt,
  toEpochMs,
  useMessagesStore,
  type ServerMessage,
} from "./messages";

const ROOM = "r1";

function server(id: string, createdAt: string, extra: Partial<ServerMessage> = {}): ServerMessage {
  return {
    id,
    senderId: "u2",
    content: id,
    type: "TEXT",
    createdAt,
    expiresAt: null,
    replyToMessageId: null,
    burnAfterRead: false,
    ...extra,
  };
}

const store = () => useMessagesStore.getState();
const rows = (roomId = ROOM) => store().byRoom[roomId] ?? [];
const ids = (roomId = ROOM) => rows(roomId).map((m) => m.id);

describe("messages store", () => {
  beforeEach(() => {
    store().reset();
  });

  it("sorts pages in either server order and dedupes by id", () => {
    // Latest page: newest first. Forward page: oldest first, overlapping one row.
    store().mergeServerMessages(ROOM, [
      server("m3", "2026-10-25T05:00:03Z", { senderNickname: "Bob" }),
      server("m2", "2026-10-25T05:00:02Z", { senderNickname: "Bob" }),
    ]);
    store().mergeServerMessages(ROOM, [
      server("m3", "2026-10-25T05:00:03Z"),
      server("m4", "2026-10-25T05:00:04Z"),
    ]);

    expect(ids()).toEqual(["m2", "m3", "m4"]);
    // new_message has no nickname: a REST row's nickname survives the update.
    expect(rows().find((m) => m.id === "m3")?.senderNickname).toBe("Bob");
  });

  it("orders by time across fraction lengths, then by id", () => {
    store().mergeServerMessages(ROOM, [
      server("b", "2026-10-25T05:00:25Z"),
      server("c", "2026-10-25T05:00:25.5Z"),
      server("a", "2026-10-25T05:00:24.999999999Z"),
      server("d", "2026-10-25T05:00:25.000Z"),
    ]);

    // String order would put "25.5Z" before "25Z"; time order does not.
    expect(ids()).toEqual(["a", "b", "d", "c"]);
  });

  it("marks a room as loaded even for an empty page", () => {
    store().mergeServerMessages(ROOM, []);

    expect(store().byRoom).toEqual({ [ROOM]: [] });
  });

  describe("sending", () => {
    const send = (clientMessageId: string) =>
      store().addPending({ roomId: ROOM, clientMessageId, senderId: "u1", content: "hi", ttlSeconds: 30 });

    it("settles to one row when the ack comes before new_message", () => {
      store().mergeServerMessages(ROOM, [server("m1", "2026-10-25T05:00:01Z")]);
      send("c1");

      store().ackMessage("c1", "m9");
      expect(rows().at(-1)).toMatchObject({ id: "m9", status: "sent", serverTime: false });

      store().mergeServerMessages(ROOM, [server("m9", "2026-10-25T05:00:09Z", { senderId: "u1" })]);
      expect(ids()).toEqual(["m1", "m9"]);
      expect(rows()[1]).toMatchObject({ clientMessageId: "c1", ttlSeconds: 30, serverTime: true });
    });

    it("settles to one row when new_message comes before the ack", () => {
      send("c1");
      store().mergeServerMessages(ROOM, [server("m9", "2026-10-25T05:00:09Z", { senderId: "u1" })]);
      expect(rows()).toHaveLength(2);

      store().ackMessage("c1", "m9");

      expect(rows()).toHaveLength(1);
      expect(rows()[0]).toMatchObject({ id: "m9", clientMessageId: "c1", status: "sent", serverTime: true });
    });

    it("confirms from the ack alone, as for an idempotent resend", () => {
      send("c1");

      store().ackMessage("c1", "m9");

      expect(rows()).toHaveLength(1);
      expect(rows()[0]).toMatchObject({ id: "m9", clientMessageId: "c1", status: "sent" });
    });

    it("keeps client-time rows at the tail and out of the backfill cursor", () => {
      send("c1");
      // A server row older than the client clock still sorts before the pending row.
      store().mergeServerMessages(ROOM, [server("m1", "2000-01-01T00:00:00.123456Z")]);
      store().ackMessage("c1", "m9");

      expect(ids()).toEqual(["m1", "m9"]);
      expect(newestServerCreatedAt(rows())).toBe("2000-01-01T00:00:00.123456Z");
    });

    it("fails only pending rows, lets a late ack win, and retries only failed rows", () => {
      send("c1");

      store().markPending("c1");
      expect(rows()[0].status).toBe("pending");
      store().failMessage("c1");
      expect(rows()[0].status).toBe("failed");
      store().markPending("c1");
      expect(rows()[0].status).toBe("pending");

      store().failMessage("c1");
      store().ackMessage("c1", "m9");
      store().failMessage("c1");
      expect(rows()[0]).toMatchObject({ id: "m9", status: "sent" });
    });

    it("ignores acks for messages it does not hold", () => {
      send("c1");
      const before = store().byRoom;

      store().ackMessage("unknown", "m9");

      expect(store().byRoom).toBe(before);
    });
  });

  it("removes messages and reports how many went", () => {
    store().mergeServerMessages(ROOM, [
      server("m1", "2026-10-25T05:00:01Z"),
      server("m2", "2026-10-25T05:00:02Z"),
    ]);

    expect(store().removeMessages(ROOM, ["m1", "missing"])).toBe(1);
    expect(ids()).toEqual(["m2"]);
    expect(store().removeMessages("other-room", ["m2"])).toBe(0);
  });

  it("removes a whole room", () => {
    store().mergeServerMessages(ROOM, [server("m1", "2026-10-25T05:00:01Z")]);

    store().removeRoom(ROOM);

    expect(store().byRoom).toEqual({});
  });

  it("jumps to the latest page and keeps local rows", () => {
    store().mergeServerMessages(ROOM, [server("old", "2026-10-25T05:00:01Z")]);
    store().addPending({ roomId: ROOM, clientMessageId: "c1", senderId: "u1", content: "hi" });

    store().replaceServerMessages(ROOM, [server("new", "2026-10-25T09:00:00Z")]);

    expect(ids()).toEqual(["new", "c1"]);
  });
});

describe("toEpochMs", () => {
  it("cuts digits past milliseconds before parsing", () => {
    expect(toEpochMs("2026-10-25T05:13:25.123456789Z")).toBe(Date.UTC(2026, 9, 25, 5, 13, 25, 123));
    expect(toEpochMs("2026-10-25T05:13:25Z")).toBe(Date.UTC(2026, 9, 25, 5, 13, 25));
  });
});

describe("messages store: loading, tombstones and ordering", () => {
  beforeEach(() => {
    store().reset();
  });

  it("marks a room loaded only through a REST page", () => {
    store().addLiveMessage(ROOM, server("m1", "2026-10-25T05:00:01Z"));
    store().addPending({ roomId: ROOM, clientMessageId: "c1", senderId: "u1", content: "hi" });
    expect(store().loaded).toEqual({});

    store().mergeServerMessages(ROOM, []);
    expect(store().loaded).toEqual({ [ROOM]: true });

    store().removeRoom(ROOM);
    expect(store().loaded).toEqual({});
  });

  it("never merges back a message that expired or burned", () => {
    store().mergeServerMessages(ROOM, [
      server("m1", "2026-10-25T05:00:01Z"),
      server("m2", "2026-10-25T05:00:02Z"),
    ]);
    store().removeMessages(ROOM, ["m1", "in-flight"]);

    // A page read before the removal arrives after it, and a stray live copy too.
    store().mergeServerMessages(ROOM, [
      server("m1", "2026-10-25T05:00:01Z"),
      server("in-flight", "2026-10-25T05:00:03Z"),
    ]);
    store().addLiveMessage(ROOM, server("m1", "2026-10-25T05:00:01Z"));

    expect(ids()).toEqual(["m2"]);
  });

  it("keeps rows that arrived live while the latest page loaded", () => {
    store().mergeServerMessages(ROOM, [server("old", "2026-10-25T05:00:01Z")]);
    store().addLiveMessage(ROOM, server("live", "2026-10-25T09:00:30Z"));

    store().replaceServerMessages(ROOM, [
      server("latest2", "2026-10-25T09:00:10Z"),
      server("latest1", "2026-10-25T09:00:00Z"),
    ]);

    expect(ids()).toEqual(["latest1", "latest2", "live"]);
  });

  it("orders rows within one millisecond by their microseconds", () => {
    store().mergeServerMessages(ROOM, [
      server("a", "2026-10-25T05:00:25.123900Z"),
      server("z", "2026-10-25T05:00:25.123100Z"),
    ]);

    expect(ids()).toEqual(["z", "a"]);
  });

  it("bumps the epoch on reset", () => {
    const before = store().epoch;

    store().reset();

    expect(store().epoch).toBe(before + 1);
  });
});

describe("compareInstants and oldestServerCreatedAt", () => {
  it("orders by time, then by the digits past milliseconds", async () => {
    const { compareInstants } = await import("./messages");

    expect(compareInstants("2026-10-25T05:00:25.5Z", "2026-10-25T05:00:25Z")).toBeGreaterThan(0);
    expect(compareInstants("2026-10-25T05:00:25.123100Z", "2026-10-25T05:00:25.1239Z")).toBeLessThan(0);
    expect(compareInstants("2026-10-25T05:00:25Z", "2026-10-25T05:00:25.000Z")).toBe(0);
  });

  it("finds the oldest server row and skips local ones", async () => {
    const { oldestServerCreatedAt } = await import("./messages");
    store().reset();
    store().addPending({ roomId: ROOM, clientMessageId: "c1", senderId: "u1", content: "hi" });
    expect(oldestServerCreatedAt(rows())).toBeNull();

    store().mergeServerMessages(ROOM, [
      server("m2", "2026-10-25T05:00:02.5Z"),
      server("m1", "2026-10-25T05:00:01.123456Z"),
    ]);
    expect(oldestServerCreatedAt(rows())).toBe("2026-10-25T05:00:01.123456Z");
  });
});
