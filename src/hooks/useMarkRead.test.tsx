import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/store/messages";
import { useWsStore } from "@/store/ws";
import { fakeChatClient } from "@/test/fakeChatClient";
import { MARK_READ_DELAY_MS, newestFromOthers, useMarkRead } from "./useMarkRead";

const row = (id: string, senderId: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  roomId: "r1",
  senderId,
  content: id,
  type: "TEXT",
  createdAt: "2026-10-25T05:00:00Z",
  serverTime: true,
  expiresAt: null,
  replyToMessageId: null,
  burnAfterRead: false,
  status: "sent",
  ...extra,
});

describe("newestFromOthers", () => {
  it("skips my own rows and rows without server time", () => {
    const list = [row("m1", "u2"), row("m2", "u1"), row("c1", "u2", { serverTime: false })];

    expect(newestFromOthers(list, "u1")).toBe("m1");
    expect(newestFromOthers([row("m2", "u1")], "u1")).toBeNull();
  });
});

describe("useMarkRead", () => {
  let visibility: DocumentVisibilityState = "visible";
  let fake: ReturnType<typeof fakeChatClient>;

  beforeEach(() => {
    vi.useFakeTimers();
    visibility = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    fake = fakeChatClient();
    useWsStore.setState({ client: fake.client, status: "open" });
  });

  afterEach(() => {
    useWsStore.getState().reset();
    vi.useRealTimers();
  });

  const render = (messages: ChatMessage[]) =>
    renderHook(({ list }) => useMarkRead("r1", list, "u1"), { initialProps: { list: messages } });

  it("marks the newest message from someone else once, after the delay", () => {
    const { rerender } = render([row("m1", "u2")]);
    vi.advanceTimersByTime(MARK_READ_DELAY_MS - 1);
    expect(fake.send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fake.send).toHaveBeenCalledWith("mark_read", { roomId: "r1", lastReadMessageId: "m1" });

    rerender({ list: [row("m1", "u2"), row("m2", "u1")] }); // only my own message is newer
    vi.advanceTimersByTime(MARK_READ_DELAY_MS * 4);
    expect(fake.send).toHaveBeenCalledTimes(1);
  });

  it("sends nothing while the page is hidden, and marks once it is visible again", () => {
    visibility = "hidden";
    render([row("m1", "u2")]);
    vi.advanceTimersByTime(MARK_READ_DELAY_MS * 4);
    expect(fake.send).not.toHaveBeenCalled();

    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(MARK_READ_DELAY_MS);
    expect(fake.send).toHaveBeenCalledTimes(1);
  });

  it("sends nothing once the room view is gone", () => {
    const { unmount } = render([row("m1", "u2")]);

    unmount();
    vi.advanceTimersByTime(MARK_READ_DELAY_MS * 4);

    expect(fake.send).not.toHaveBeenCalled();
  });

  it("waits for an accepted connection", () => {
    useWsStore.setState({ status: "connecting" });
    render([row("m1", "u2")]);
    vi.advanceTimersByTime(MARK_READ_DELAY_MS * 4);
    expect(fake.send).not.toHaveBeenCalled();
  });
});
