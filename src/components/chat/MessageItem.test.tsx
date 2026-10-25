import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Room } from "@/lib/api/rooms";
import type { ChatMessage } from "@/store/messages";
import { MessageItem } from "./MessageItem";
import { readLabelFor, senderNameOf } from "./MessageList";

const row = (extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id: "m1",
  roomId: "r1",
  senderId: "u1",
  content: "안녕",
  type: "TEXT",
  createdAt: "2026-10-25T05:00:00.5Z",
  serverTime: true,
  expiresAt: null,
  replyToMessageId: null,
  burnAfterRead: false,
  status: "sent",
  ...extra,
});

const members = [
  { userId: "u1", nickname: "Alice", profileImageUrl: null },
  { userId: "u2", nickname: "Bob", profileImageUrl: null },
  { userId: "u3", nickname: "Cara", profileImageUrl: null },
];
const dm: Room = { id: "r1", type: "DIRECT", name: null, lastMessageAt: null, expiresAt: null, members: members.slice(0, 2) };
const group: Room = { ...dm, type: "GROUP", name: "스터디", members };

describe("MessageItem", () => {
  it("offers a retry for a failed message with its clientMessageId", () => {
    const onRetry = vi.fn();
    render(
      <MessageItem
        message={row({ id: "c1", clientMessageId: "c1", status: "failed", serverTime: false })}
        mine
        senderName={null}
        readLabel={null}
        onRetry={onRetry}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "다시 보내기" }));

    expect(screen.getByText("보내지 못함")).toBeTruthy();
    expect(onRetry).toHaveBeenCalledWith("c1");
  });

  it("shows the sender, the read label and the pending state", () => {
    render(
      <MessageItem
        message={row({ status: "pending" })}
        mine={false}
        senderName="Bob"
        readLabel="읽음"
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Bob")).toBeTruthy();
    expect(screen.getByText("읽음")).toBeTruthy();
    expect(screen.getByText("보내는 중")).toBeTruthy();
  });
});

describe("readLabelFor", () => {
  it("says read in a DM once the other member's read point reaches the message", () => {
    expect(readLabelFor(row(), dm, { u2: "2026-10-25T05:00:00Z" }, "u1")).toBeNull(); // read an earlier one
    expect(readLabelFor(row(), dm, { u2: "2026-10-25T05:00:00.5Z" }, "u1")).toBe("읽음");
  });

  it("counts readers in a group and ignores my own read point", () => {
    const reads = { u1: "2026-10-25T06:00:00Z", u2: "2026-10-25T06:00:00Z", u3: "2026-10-25T04:00:00Z" };

    expect(readLabelFor(row(), group, reads, "u1")).toBe("1명 읽음");
  });

  it("has nothing to say for a row the server has not timed", () => {
    expect(readLabelFor(row({ serverTime: false }), dm, { u2: "2026-10-25T09:00:00Z" }, "u1")).toBeNull();
  });
});

describe("senderNameOf", () => {
  it("prefers the room member, then the REST nickname", () => {
    expect(senderNameOf(row({ senderId: "u2" }), dm)).toBe("Bob");
    expect(senderNameOf(row({ senderId: "gone", senderNickname: "Old" }), dm)).toBe("Old");
    expect(senderNameOf(row({ senderId: "gone" }), dm)).toBe("알 수 없음");
  });
});
