import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Room } from "@/lib/api/rooms";
import type { ChatMessage } from "@/store/messages";
import { useWsStore } from "@/store/ws";
import { ChatHeader } from "./ChatHeader";
import { MessageItem } from "./MessageItem";

// Countdowns run on this device's clock and only change what is shown.

const message = (expiresAt: string): ChatMessage => ({
  id: "m1",
  roomId: "r1",
  senderId: "u2",
  content: "안녕",
  type: "TEXT",
  createdAt: "2026-10-25T05:00:00Z",
  serverTime: true,
  expiresAt,
  replyToMessageId: null,
  burnAfterRead: false,
  status: "sent",
});

const group: Room = {
  id: "g1",
  type: "GROUP",
  name: "스터디",
  lastMessageAt: null,
  expiresAt: null,
  members: [{ userId: "u1", nickname: "Alice", profileImageUrl: null }],
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-25T05:00:00Z"));
  useWsStore.getState().reset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("MessageItem for a disappearing message", () => {
  it("counts down, then says soon instead of hiding the row", () => {
    render(
      <MessageItem message={message("2026-10-25T05:00:03Z")} mine={false} senderName={null} readLabel={null} onRetry={vi.fn()} />,
    );
    expect(screen.getByText("3초 후 사라짐")).toBeTruthy();

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText("2초 후 사라짐")).toBeTruthy();

    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText("곧 사라짐")).toBeTruthy();
    expect(screen.getByText("안녕")).toBeTruthy(); // message_expired removes it, not the clock
  });
});

describe("ChatHeader for a temporary room", () => {
  it("shows the time left, then a countdown banner for the last ten minutes", () => {
    render(<ChatHeader title="스터디" room={{ ...group, expiresAt: "2026-10-25T05:10:05Z" }} />);
    expect(screen.getByText("임시 방, 10분 남음")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();

    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByRole("alert").textContent).toBe("이 방은 9:55 뒤 만료됩니다");

    act(() => vi.advanceTimersByTime(600_000));
    expect(screen.getByRole("alert").textContent).toBe("이 방은 곧 만료됩니다");
  });

  it("switches to the countdown as soon as room_expiring arrives", () => {
    useWsStore.getState().markRoomExpiring("g1", { roomName: "스터디", expiresAt: "2026-10-25T05:30:00Z" });

    render(<ChatHeader title="스터디" room={{ ...group, expiresAt: "2026-10-25T05:30:00Z" }} />);

    expect(screen.getByRole("alert").textContent).toBe("이 방은 30:00 뒤 만료됩니다");
  });

  it("shows nothing about expiry for a permanent room", () => {
    render(<ChatHeader title="스터디" room={group} />);

    expect(screen.queryByText(/남음|만료/)).toBeNull();
  });
});
