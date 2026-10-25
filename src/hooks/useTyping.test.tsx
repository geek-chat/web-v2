import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWsStore } from "@/store/ws";
import { fakeChatClient } from "@/test/fakeChatClient";
import { TYPING_SEND_INTERVAL_MS, TYPING_SHOW_MS, useTyping } from "./useTyping";

const newMessage = (senderId: string) => ({
  id: "m1",
  roomId: "r1",
  senderId,
  content: "hi",
  type: "TEXT" as const,
  createdAt: "2026-10-25T05:00:00Z",
  expiresAt: null,
  replyToMessageId: null,
  burnAfterRead: false,
});

describe("useTyping", () => {
  let fake: ReturnType<typeof fakeChatClient>;

  beforeEach(() => {
    vi.useFakeTimers();
    fake = fakeChatClient();
    useWsStore.setState({ client: fake.client, status: "open" });
  });

  afterEach(() => {
    useWsStore.getState().reset();
    vi.useRealTimers();
  });

  it("shows another member typing for 3s after their last event", () => {
    const { result } = renderHook(() => useTyping("r1", "u1"));

    act(() => fake.emit("typing_indicator", { roomId: "r1", userId: "u2" }));
    expect(result.current.typingUserIds).toEqual(["u2"]);
    act(() => vi.advanceTimersByTime(TYPING_SHOW_MS - 1));
    act(() => fake.emit("typing_indicator", { roomId: "r1", userId: "u2" })); // still typing
    act(() => vi.advanceTimersByTime(TYPING_SHOW_MS - 1));
    expect(result.current.typingUserIds).toEqual(["u2"]);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.typingUserIds).toEqual([]);
  });

  it("ignores me and other rooms, and stops showing someone once their message lands", () => {
    const { result } = renderHook(() => useTyping("r1", "u1"));

    act(() => {
      fake.emit("typing_indicator", { roomId: "r1", userId: "u1" });
      fake.emit("typing_indicator", { roomId: "r2", userId: "u3" });
      fake.emit("typing_indicator", { roomId: "r1", userId: "u2" });
    });
    expect(result.current.typingUserIds).toEqual(["u2"]);

    act(() => fake.emit("new_message", newMessage("u2")));
    expect(result.current.typingUserIds).toEqual([]);
  });

  it("sends typing_start at most every 2s", () => {
    const { result } = renderHook(() => useTyping("r1", "u1"));

    act(() => {
      result.current.notifyTyping();
      result.current.notifyTyping();
    });
    expect(fake.send).toHaveBeenCalledTimes(1);
    expect(fake.send).toHaveBeenCalledWith("typing_start", { roomId: "r1" });

    act(() => vi.advanceTimersByTime(TYPING_SEND_INTERVAL_MS));
    act(() => result.current.notifyTyping());
    expect(fake.send).toHaveBeenCalledTimes(2);
  });

  it("lets go of its listeners on unmount", () => {
    const { unmount } = renderHook(() => useTyping("r1", "u1"));
    expect(fake.listeners("typing_indicator")).toBe(1);

    unmount();

    expect(fake.listeners("typing_indicator")).toBe(0);
    expect(fake.listeners("new_message")).toBe(0);
  });
});
