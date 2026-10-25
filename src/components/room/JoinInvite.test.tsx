import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => {
  const replace = vi.fn();
  return { replace, router: { replace } };
});
vi.mock("next/navigation", () => ({ useRouter: () => nav.router }));
vi.mock("@/lib/api/invite", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/invite")>()),
  joinInvite: vi.fn(),
}));

import { ApiError } from "@/lib/api/client";
import { joinInvite } from "@/lib/api/invite";
import type { Room } from "@/lib/api/rooms";
import { useRoomsStore } from "@/store/rooms";
import { JoinInvite } from "./JoinInvite";

const joined: Room = {
  id: "room-9",
  type: "GROUP",
  name: "스터디",
  lastMessageAt: null,
  expiresAt: null,
  members: [{ userId: "u3", nickname: "Cara", profileImageUrl: null }],
};

const apiError = (status: number) =>
  new ApiError(status, { statusCode: status, message: "x", error: "x" }, "x");

describe("JoinInvite", () => {
  beforeEach(() => {
    nav.replace.mockReset();
    vi.mocked(joinInvite).mockReset();
    useRoomsStore.getState().reset();
    useRoomsStore.getState().setRooms([]);
  });

  it("joins only on a click, then shows the room and refreshes the list", async () => {
    vi.mocked(joinInvite).mockResolvedValue(joined);
    render(<JoinInvite code="AbC12dEf" />);
    expect(joinInvite).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "참여하기" }));

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/rooms/room-9"));
    expect(joinInvite).toHaveBeenCalledWith("AbC12dEf");
    expect(useRoomsStore.getState().rooms?.map((r) => r.id)).toEqual(["room-9"]);
    expect(useRoomsStore.getState().stale).toBe(true);
  });

  it("says the user is already in the room and stops offering the button", async () => {
    vi.mocked(joinInvite).mockRejectedValue(apiError(409));
    render(<JoinInvite code="AbC12dEf" />);

    fireEvent.click(screen.getByRole("button", { name: "참여하기" }));

    expect(await screen.findByText("이미 참여한 방입니다. 대화 목록에서 열어 주세요")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "참여하기" })).toBeNull();
    expect(screen.getByRole("link", { name: "대화 목록으로" }).getAttribute("href")).toBe("/rooms");
  });

  it("explains an expired or used-up link", async () => {
    vi.mocked(joinInvite).mockRejectedValue(apiError(410));
    render(<JoinInvite code="AbC12dEf" />);

    fireEvent.click(screen.getByRole("button", { name: "참여하기" }));

    expect(await screen.findByText("만료되었거나 사용 횟수를 다 쓴 초대 링크입니다")).toBeTruthy();
  });

  it("keeps the button after a network failure, so the user can try again", async () => {
    vi.mocked(joinInvite).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<JoinInvite code="AbC12dEf" />);

    fireEvent.click(screen.getByRole("button", { name: "참여하기" }));

    expect(await screen.findByText("네트워크 오류가 발생했습니다")).toBeTruthy();
    expect(screen.getByRole("button", { name: "참여하기" })).toBeTruthy();
  });

  it("rejects a malformed code without asking the server", () => {
    render(<JoinInvite code="../rooms" />);

    expect(screen.getByText("올바른 초대 링크가 아닙니다")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "참여하기" })).toBeNull();
    expect(joinInvite).not.toHaveBeenCalled();
  });
});
