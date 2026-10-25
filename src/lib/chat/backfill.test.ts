import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/rooms", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/rooms")>()),
  listMessages: vi.fn(),
}));

import { listMessages, MESSAGE_PAGE_MAX, type MessageDto } from "@/lib/api/rooms";
import { useMessagesStore } from "@/store/messages";
import { backfillLoadedRooms, backfillRoom, MAX_FORWARD_PAGES } from "./backfill";

const list = vi.mocked(listMessages);
const store = () => useMessagesStore.getState();
const ids = (roomId: string) => (store().byRoom[roomId] ?? []).map((m) => m.id);

function dto(id: string, second: number): MessageDto {
  return {
    id,
    senderId: "u2",
    senderNickname: "Bob",
    content: id,
    type: "TEXT",
    // Six fraction digits, as Instant.toString() prints for a Postgres timestamp.
    createdAt: `2026-10-25T05:00:${String(second).padStart(2, "0")}.123456Z`,
    expiresAt: null,
    replyToMessageId: null,
    burnAfterRead: false,
  };
}

/** A full forward page after second `from`, oldest first like the server's (two rows per second). */
const fullPage = (prefix: string, from: number) =>
  Array.from({ length: MESSAGE_PAGE_MAX }, (_, i) => dto(`${prefix}${i}`, from + 1 + Math.floor(i / 2)));

describe("backfill", () => {
  beforeEach(() => {
    list.mockReset();
    store().reset();
  });

  it("skips a room that holds nothing from the server yet", async () => {
    store().addPending({ roomId: "r1", clientMessageId: "c1", senderId: "u1", content: "hi" });

    await backfillRoom("r1");

    expect(list).not.toHaveBeenCalled();
  });

  it("pages forward from the exact newest server createdAt until a short page", async () => {
    store().mergeServerMessages("r1", [dto("m1", 1)]);
    store().addPending({ roomId: "r1", clientMessageId: "c1", senderId: "u1", content: "hi" });
    const page1 = fullPage("a", 1);
    list.mockResolvedValueOnce(page1).mockResolvedValueOnce([dto("b0", 59)]);

    await backfillRoom("r1");

    expect(list).toHaveBeenNthCalledWith(1, "r1", {
      direction: "forward",
      cursor: "2026-10-25T05:00:01.123456Z",
      limit: MESSAGE_PAGE_MAX,
    });
    expect(list).toHaveBeenNthCalledWith(2, "r1", {
      direction: "forward",
      cursor: page1[page1.length - 1].createdAt,
      limit: MESSAGE_PAGE_MAX,
    });
    expect(ids("r1")).toHaveLength(1 + MESSAGE_PAGE_MAX + 1 + 1);
    expect(ids("r1").at(-1)).toBe("c1"); // the pending row stays last
  });

  it("stops when the room goes away mid-backfill", async () => {
    store().mergeServerMessages("r1", [dto("m1", 1)]);
    list.mockImplementationOnce(async () => {
      store().removeRoom("r1"); // e.g. room_expired arrived meanwhile
      return fullPage("a", 1);
    });

    await backfillRoom("r1");

    expect(list).toHaveBeenCalledTimes(1);
    expect(store().byRoom).toEqual({});
  });

  it("jumps to the latest page when the room is too far behind", async () => {
    store().mergeServerMessages("r1", [dto("old", 1)]);
    store().addPending({ roomId: "r1", clientMessageId: "c1", senderId: "u1", content: "hi" });
    for (let page = 0; page < MAX_FORWARD_PAGES; page += 1) list.mockResolvedValueOnce(fullPage(`p${page}`, 1));
    list.mockResolvedValueOnce([dto("latest", 59)]);

    await backfillRoom("r1");

    expect(list).toHaveBeenLastCalledWith("r1", { limit: MESSAGE_PAGE_MAX });
    expect(ids("r1")).toEqual(["latest", "c1"]);
  });

  it("backfills every loaded room and lets one failure pass", async () => {
    store().mergeServerMessages("r1", [dto("m1", 1)]);
    store().mergeServerMessages("r2", [dto("m2", 2)]);
    list.mockImplementation(async (roomId) => {
      if (roomId === "r1") throw new TypeError("Failed to fetch");
      return [dto("m3", 3)];
    });

    await expect(backfillLoadedRooms()).resolves.toBeUndefined();

    expect(ids("r2")).toEqual(["m2", "m3"]);
  });
});
