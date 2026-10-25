import { beforeEach, describe, expect, it } from "vitest";
import type { Room } from "@/lib/api/rooms";
import { useRoomsStore } from "./rooms";

const room = (id: string, lastMessageAt: string | null): Room => ({
  id,
  type: "DIRECT",
  name: null,
  lastMessageAt,
  expiresAt: null,
  members: [],
});

const store = () => useRoomsStore.getState();

describe("rooms store", () => {
  beforeEach(() => {
    store().reset();
  });

  it("ignores new messages until the list is loaded", () => {
    store().touchRoom("r1", "2026-10-25T05:00:00Z");

    expect(store()).toMatchObject({ rooms: null, stale: false });
  });

  it("moves lastMessageAt forward only", () => {
    store().setRooms([room("r1", "2026-10-25T05:00:00.5Z")]);

    store().touchRoom("r1", "2026-10-25T05:00:00Z"); // older, despite sorting after as a string
    expect(store().rooms?.[0].lastMessageAt).toBe("2026-10-25T05:00:00.5Z");
    store().touchRoom("r1", "2026-10-25T05:00:01Z");
    expect(store().rooms?.[0].lastMessageAt).toBe("2026-10-25T05:00:01Z");
  });

  it("flags the list stale for a room it does not have, until the next load", () => {
    store().setRooms([room("r1", null)]);

    store().touchRoom("r2", "2026-10-25T05:00:00Z");
    expect(store().stale).toBe(true);
    store().setRooms([room("r1", null), room("r2", "2026-10-25T05:00:00Z")]);
    expect(store().stale).toBe(false);
  });

  it("removes a room and keeps the current room id for the view to react", () => {
    store().setRooms([room("r1", null), room("r2", null)]);
    store().setCurrentRoom("r1");

    store().removeRoom("r1");

    expect(store().rooms?.map((r) => r.id)).toEqual(["r2"]);
    expect(store().currentRoomId).toBe("r1");
  });
});

describe("rooms store: merging a created room and a refetched list", () => {
  beforeEach(() => {
    store().reset();
  });

  const dm = (lastMessageAt: string | null, avatar: string | null): Room => ({
    id: "r1",
    type: "DIRECT",
    name: null,
    lastMessageAt,
    expiresAt: null,
    members: [
      { userId: "u1", nickname: "Alice", profileImageUrl: null },
      { userId: "u2", nickname: "Bob", profileImageUrl: avatar },
    ],
  });

  it("keeps the activity and avatars of a DM that already existed", () => {
    store().setRooms([dm("2026-10-25T05:00:00Z", "https://img/bob.png"), room("r2", null)]);

    store().upsertRoom(dm(null, null)); // what createRoom returns for an existing DM

    expect(store().rooms?.[0]).toEqual(dm("2026-10-25T05:00:00Z", "https://img/bob.png"));
    expect(store().rooms).toHaveLength(2);
  });

  it("puts a new room first, and waits for the first load otherwise", () => {
    store().upsertRoom(room("r9", null));
    expect(store().rooms).toBeNull();

    store().setRooms([room("r1", "2026-10-25T05:00:00Z")]);
    store().upsertRoom(room("r9", null));
    expect(store().rooms?.map((r) => r.id)).toEqual(["r9", "r1"]);
  });

  it("keeps a lastMessageAt that a live message moved past the refetched list", () => {
    store().setRooms([room("r1", "2026-10-25T05:00:00Z")]);
    store().touchRoom("r1", "2026-10-25T05:00:09Z"); // new_message during the refetch

    store().setRooms([room("r1", "2026-10-25T05:00:05Z")]);

    expect(store().rooms?.[0].lastMessageAt).toBe("2026-10-25T05:00:09Z");
  });
});

describe("rooms store: read points", () => {
  beforeEach(() => {
    store().reset();
  });

  it("moves a member's read point forward only, by time", () => {
    store().markRead("r1", "u2", "2026-10-25T05:00:00.5Z");
    store().markRead("r1", "u2", "2026-10-25T05:00:00Z"); // older, though later as a string
    expect(store().reads).toEqual({ r1: { u2: "2026-10-25T05:00:00.5Z" } });

    store().markRead("r1", "u2", "2026-10-25T05:00:01Z");
    expect(store().reads.r1.u2).toBe("2026-10-25T05:00:01Z");
  });

  it("forgets the read points of a removed room", () => {
    store().markRead("r1", "u2", "2026-10-25T05:00:00Z");
    store().markRead("r2", "u2", "2026-10-25T05:00:00Z");

    store().removeRoom("r1");

    expect(store().reads).toEqual({ r2: { u2: "2026-10-25T05:00:00Z" } });
  });
});

describe("rooms store and members who joined by invite", () => {
  const group: Room = {
    id: "g1",
    type: "GROUP",
    name: "study",
    lastMessageAt: null,
    expiresAt: null,
    members: [{ userId: "u1", nickname: "Alice", profileImageUrl: null }],
  };

  beforeEach(() => {
    store().reset();
  });

  it("refetches the list once for a sender the room does not list", () => {
    store().setRooms([group]);

    store().touchRoom("g1", "2026-10-25T05:00:00Z", "u1");
    expect(store().stale).toBe(false);

    store().touchRoom("g1", "2026-10-25T05:00:01Z", "u3");
    expect(store().stale).toBe(true);
    expect(store().rooms?.[0].lastMessageAt).toBe("2026-10-25T05:00:01Z");

    // The refetched list still lacks u3: no refetch after refetch.
    store().setRooms([group]);
    store().touchRoom("g1", "2026-10-25T05:00:02Z", "u3");
    expect(store().stale).toBe(false);
  });
});
