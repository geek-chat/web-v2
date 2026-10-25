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

  it("pages forward from 5s before the newest server createdAt until a short page", async () => {
    store().mergeServerMessages("r1", [dto("m1", 1)]);
    store().addPending({ roomId: "r1", clientMessageId: "c1", senderId: "u1", content: "hi" });
    const page1 = fullPage("a", 1);
    list.mockResolvedValueOnce(page1).mockResolvedValueOnce([dto("b0", 59)]);

    await backfillRoom("r1");

    expect(list).toHaveBeenNthCalledWith(1, "r1", {
      direction: "forward",
      cursor: "2026-10-25T04:59:56.123Z", // the newest server row minus the 5s overlap
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

describe("backfill: which rooms count as loaded", () => {
  beforeEach(async () => {
    list.mockReset();
    store().reset();
    const { useWsStore } = await import("@/store/ws");
    useWsStore.getState().reset();
  });

  it("takes the latest page for a loaded room that has no server rows", async () => {
    store().mergeServerMessages("r1", []); // an empty room the view opened
    list.mockResolvedValueOnce([dto("m1", 1)]);

    await backfillRoom("r1");

    expect(list).toHaveBeenCalledWith("r1", { limit: MESSAGE_PAGE_MAX });
    expect(ids("r1")).toEqual(["m1"]);
  });

  it("skips rooms that only received live messages", async () => {
    store().addLiveMessage("r2", dto("m1", 1));

    await backfillLoadedRooms();

    expect(list).not.toHaveBeenCalled();
  });

  it("backfills a first page that lands after the connection was accepted", async () => {
    const { useWsStore } = await import("@/store/ws");
    const { loadRoomMessages } = await import("./backfill");
    useWsStore.getState().setStatus("open");
    list.mockResolvedValueOnce([dto("m2", 2), dto("m1", 1)]).mockResolvedValueOnce([dto("m3", 3)]);

    await loadRoomMessages("r1");

    expect(list).toHaveBeenNthCalledWith(1, "r1", { limit: MESSAGE_PAGE_MAX });
    expect(list).toHaveBeenNthCalledWith(2, "r1", {
      direction: "forward",
      cursor: "2026-10-25T04:59:57.123Z", // the newest server row minus the 5s overlap
      limit: MESSAGE_PAGE_MAX,
    });
    expect(ids("r1")).toEqual(["m1", "m2", "m3"]);
  });

  it("leaves the backfill to the acceptance when the socket is not open yet", async () => {
    const { loadRoomMessages } = await import("./backfill");
    list.mockResolvedValueOnce([dto("m1", 1)]);

    await loadRoomMessages("r1");

    expect(list).toHaveBeenCalledTimes(1);
    expect(store().loaded).toEqual({ r1: true });
  });

  it("drops a first page that lands after the session ended", async () => {
    const { loadRoomMessages } = await import("./backfill");
    list.mockImplementationOnce(async () => {
      store().reset(); // logout while the page was loading
      return [dto("m1", 1)];
    });

    await loadRoomMessages("r1");

    expect(store().byRoom).toEqual({});
  });
});

describe("backfill: messages that commit out of createdAt order", () => {
  beforeEach(() => {
    list.mockReset();
    store().reset();
  });

  it("recovers an older message that committed after the newest one held", async () => {
    // B (05:00:02) arrived live; A (05:00:01) committed later, after the socket dropped.
    store().mergeServerMessages("r1", [dto("B", 2)]);
    list.mockImplementationOnce(async (_roomId, query) =>
      query?.cursor && query.cursor < dto("A", 1).createdAt ? [dto("A", 1), dto("B", 2)] : [],
    );

    await backfillRoom("r1");

    expect(ids("r1")).toEqual(["A", "B"]);
  });
});

describe("backfill: older pages and the first page's end", () => {
  beforeEach(() => {
    list.mockReset();
    store().reset();
  });

  it("asks for the page before the oldest server row and reports the start", async () => {
    const { loadOlderMessages, OLDER_PAGE_SIZE } = await import("./backfill");
    store().mergeServerMessages("r1", [dto("m5", 5)]);
    list.mockResolvedValueOnce([dto("m4", 4), dto("m3", 3)]);

    await expect(loadOlderMessages("r1")).resolves.toBe(true);

    expect(list).toHaveBeenCalledWith("r1", {
      direction: "backward",
      cursor: "2026-10-25T05:00:05.123456Z",
      limit: OLDER_PAGE_SIZE,
    });
    expect(ids("r1")).toEqual(["m3", "m4", "m5"]);
  });

  it("sends one request at a time per room", async () => {
    const { loadOlderMessages } = await import("./backfill");
    store().mergeServerMessages("r1", [dto("m5", 5)]);
    let resolvePage: (rows: MessageDto[]) => void = () => {};
    list.mockReturnValueOnce(new Promise((resolve) => (resolvePage = resolve)));

    const first = loadOlderMessages("r1");
    await expect(loadOlderMessages("r1")).resolves.toBe(false);
    resolvePage([]);
    await expect(first).resolves.toBe(true);

    expect(list).toHaveBeenCalledTimes(1);
  });

  it("drops an older page that lands after the session ended", async () => {
    const { loadOlderMessages } = await import("./backfill");
    store().mergeServerMessages("r1", [dto("m5", 5)]);
    list.mockImplementationOnce(async () => {
      store().reset();
      return [dto("m4", 4)];
    });

    await loadOlderMessages("r1");

    expect(store().byRoom).toEqual({});
  });

  it("says whether the first page already reaches the start", async () => {
    const { loadRoomMessages } = await import("./backfill");
    list.mockResolvedValueOnce([dto("m1", 1)]);

    await expect(loadRoomMessages("r1")).resolves.toBe(true);
  });
});
