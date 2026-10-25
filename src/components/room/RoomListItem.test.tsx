import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Room } from "@/lib/api/rooms";
import { formatActivity, RoomListItem, roomTitle } from "./RoomListItem";

const members = [
  { userId: "u1", nickname: "Alice", profileImageUrl: null },
  { userId: "u2", nickname: "Bob", profileImageUrl: null },
];
const direct: Room = {
  id: "r1",
  type: "DIRECT",
  name: null,
  lastMessageAt: null,
  expiresAt: null,
  members,
};
const group: Room = {
  ...direct,
  id: "r2",
  type: "GROUP",
  name: "스터디",
  members: [...members, { userId: "u3", nickname: "Cara", profileImageUrl: null }],
};

describe("roomTitle", () => {
  it("names a DIRECT room after the other person and a GROUP room by its name", () => {
    expect(roomTitle(direct, "u1")).toBe("Bob");
    expect(roomTitle(direct, "u2")).toBe("Alice");
    expect(roomTitle(group, "u1")).toBe("스터디");
    expect(roomTitle({ ...group, name: null }, "u1")).toBe("이름 없는 방");
  });
});

describe("formatActivity", () => {
  it("shows the time for today and the date for earlier days", () => {
    const now = new Date(2026, 9, 25, 18, 30);

    expect(formatActivity(new Date(2026, 9, 25, 9, 5).toISOString(), now)).toMatch(/9:05/);
    expect(formatActivity(new Date(2026, 9, 24, 23, 0).toISOString(), now)).toMatch(/10\. 24\./);
  });
});

describe("RoomListItem", () => {
  it("links to the room and shows a group's size and an expiring badge", () => {
    render(<RoomListItem room={group} currentUserId="u1" active={false} expiring />);

    expect(screen.getByRole("link").getAttribute("href")).toBe("/rooms/r2");
    expect(screen.getByText("3명")).toBeTruthy();
    expect(screen.getByText("곧 만료")).toBeTruthy();
  });

  it("marks the open room", () => {
    render(<RoomListItem room={direct} currentUserId="u1" active expiring={false} />);

    expect(screen.getByRole("link").getAttribute("aria-current")).toBe("page");
    expect(screen.queryByText("곧 만료")).toBeNull();
  });
});
