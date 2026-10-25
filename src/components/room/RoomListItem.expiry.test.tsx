import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Room } from "@/lib/api/rooms";
import { RoomListItem } from "./RoomListItem";

const group: Room = {
  id: "g1",
  type: "GROUP",
  name: "스터디",
  lastMessageAt: null,
  expiresAt: "2026-10-25T10:00:00Z",
  members: [{ userId: "u1", nickname: "Alice", profileImageUrl: null }],
};

describe("RoomListItem for a temporary room", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-25T05:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the time left", () => {
    render(<RoomListItem room={group} currentUserId="u1" active={false} expiring={false} />);

    expect(screen.getByText("5시간 남음")).toBeTruthy();
    expect(screen.queryByText("곧 만료")).toBeNull();
  });

  it("says soon for the last ten minutes, even before room_expiring comes", () => {
    render(
      <RoomListItem room={{ ...group, expiresAt: "2026-10-25T05:09:00Z" }} currentUserId="u1" active={false} expiring={false} />,
    );

    expect(screen.getByText("곧 만료")).toBeTruthy();
  });

  it("says soon past the deadline, until room_expired removes the room", () => {
    render(
      <RoomListItem room={{ ...group, expiresAt: "2026-10-25T04:59:00Z" }} currentUserId="u1" active={false} expiring={false} />,
    );

    expect(screen.getByText("곧 만료")).toBeTruthy();
  });
});
