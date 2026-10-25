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
