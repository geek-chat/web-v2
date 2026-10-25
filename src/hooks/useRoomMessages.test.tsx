import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/chat/backfill", () => ({
  loadRoomMessages: vi.fn(),
  loadOlderMessages: vi.fn(),
}));

import { loadOlderMessages, loadRoomMessages } from "@/lib/chat/backfill";
import { useMessagesStore } from "@/store/messages";
import { useRoomMessages } from "./useRoomMessages";

describe("useRoomMessages", () => {
  beforeEach(() => {
    vi.mocked(loadRoomMessages).mockReset();
    vi.mocked(loadOlderMessages).mockReset();
    useMessagesStore.getState().reset();
  });

  it("loads the first page for a room that is not loaded", async () => {
    vi.mocked(loadRoomMessages).mockImplementation(async (roomId) => {
      useMessagesStore.getState().mergeServerMessages(roomId, []);
      return true;
    });

    const { result } = renderHook(() => useRoomMessages("r1"));

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(loadRoomMessages).toHaveBeenCalledWith("r1");
    expect(result.current.reachedStart).toBe(true);
  });

  it("skips the first page when the room is already loaded", () => {
    useMessagesStore.getState().mergeServerMessages("r1", []);

    renderHook(() => useRoomMessages("r1"));

    expect(loadRoomMessages).not.toHaveBeenCalled();
  });

  it("shows a failed first load and tries again on retry", async () => {
    vi.mocked(loadRoomMessages).mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(false);
    const { result } = renderHook(() => useRoomMessages("r1"));
    await waitFor(() => expect(result.current.error).toBeInstanceOf(TypeError));

    act(() => result.current.retry());

    expect(result.current.error).toBeNull();
    expect(loadRoomMessages).toHaveBeenCalledTimes(2);
  });

  it("stops offering older pages once the start is reached", async () => {
    useMessagesStore.getState().mergeServerMessages("r1", []);
    vi.mocked(loadOlderMessages).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { result } = renderHook(() => useRoomMessages("r1"));

    await act(() => result.current.loadOlder());
    expect(result.current.reachedStart).toBe(false);
    await act(() => result.current.loadOlder());
    expect(result.current.reachedStart).toBe(true);
    await act(() => result.current.loadOlder());

    expect(loadOlderMessages).toHaveBeenCalledTimes(2);
  });
});

describe("useRoomMessages first load", () => {
  beforeEach(() => {
    vi.mocked(loadRoomMessages).mockReset();
    useMessagesStore.getState().reset();
  });

  it("stays unloaded until its own first load answers, then knows the start", async () => {
    let answer: (atStart: boolean) => void = () => {};
    vi.mocked(loadRoomMessages).mockImplementation((roomId) => {
      useMessagesStore.getState().mergeServerMessages(roomId, []); // merged, the backfill still running
      return new Promise<boolean>((resolve) => {
        answer = resolve;
      });
    });

    const { result } = renderHook(() => useRoomMessages("r1"));
    expect(result.current.loaded).toBe(false);

    await act(async () => answer(true));

    expect(result.current.loaded).toBe(true);
    expect(result.current.reachedStart).toBe(true);
  });

  const bobSays = {
    id: "m1",
    senderId: "u2",
    senderNickname: "Bob",
    content: "반가워",
    type: "TEXT",
    createdAt: "2026-10-25T05:00:00Z",
    expiresAt: null,
    replyToMessageId: null,
    burnAfterRead: false,
  } as const;

  it("hands out no rows before the list shows them, so mark_read cannot see them", async () => {
    let answer: (atStart: boolean) => void = () => {};
    vi.mocked(loadRoomMessages).mockImplementation((roomId) => {
      useMessagesStore.getState().mergeServerMessages(roomId, [bobSays]);
      return new Promise<boolean>((resolve) => {
        answer = resolve;
      });
    });

    const { result } = renderHook(() => useRoomMessages("r1"));
    expect(result.current.messages).toEqual([]);

    await act(async () => answer(false));

    expect(result.current.messages.map((m) => m.id)).toEqual(["m1"]);
  });

  it("keeps a first page whose backfill failed", async () => {
    vi.mocked(loadRoomMessages).mockImplementation(async (roomId) => {
      useMessagesStore.getState().mergeServerMessages(roomId, [bobSays]);
      throw new TypeError("Failed to fetch");
    });

    const { result } = renderHook(() => useRoomMessages("r1"));

    await waitFor(() => expect(result.current.error).toBeInstanceOf(TypeError));
    expect(result.current.loaded).toBe(true);
    expect(result.current.messages.map((m) => m.id)).toEqual(["m1"]);
  });
});
