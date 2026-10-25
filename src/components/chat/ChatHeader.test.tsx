import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Room } from "@/lib/api/rooms";
import { ChatHeader } from "./ChatHeader";

const members = [
  { userId: "u1", nickname: "Alice", profileImageUrl: null },
  { userId: "u2", nickname: "Bob", profileImageUrl: null },
];
const dm: Room = { id: "r1", type: "DIRECT", name: null, lastMessageAt: null, expiresAt: null, members };
const group: Room = { ...dm, id: "g1", type: "GROUP", name: "스터디" };

describe("ChatHeader", () => {
  it("opens and closes the invite panel in a group room", () => {
    render(<ChatHeader title="스터디" room={group} />);

    fireEvent.click(screen.getByRole("button", { name: "초대" }));
    expect(screen.getByRole("button", { name: "초대 링크 만들기" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("button", { name: "초대 링크 만들기" })).toBeNull();
  });

  it("offers no invite in a one-to-one room", () => {
    render(<ChatHeader title="Bob" room={dm} />);

    expect(screen.queryByRole("button", { name: "초대" })).toBeNull();
  });
});
