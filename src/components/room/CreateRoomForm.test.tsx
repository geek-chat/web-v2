import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  searchUsers: vi.fn(),
}));
vi.mock("@/lib/api/rooms", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/rooms")>()),
  createRoom: vi.fn(),
}));

import { ApiError } from "@/lib/api/client";
import { createRoom } from "@/lib/api/rooms";
import { searchUsers } from "@/lib/api/users";
import { useAuthStore } from "@/store/auth";
import { useRoomsStore } from "@/store/rooms";
import { CreateRoomForm } from "./CreateRoomForm";

const BOB = { id: "u2", nickname: "Bob", username: "bob", profileImageUrl: null };

function renderForm() {
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <CreateRoomForm />
    </SWRConfig>,
  );
}

async function pickBob() {
  fireEvent.change(screen.getByLabelText("닉네임 또는 @아이디로 찾기"), { target: { value: "bo" } });
  fireEvent.click(await screen.findByRole("button", { name: /Bob/ }));
}

const submit = () => fireEvent.click(screen.getByRole("button", { name: "대화 시작" }));

describe("CreateRoomForm", () => {
  beforeEach(() => {
    router.push.mockClear();
    vi.mocked(searchUsers).mockReset().mockResolvedValue([BOB]);
    vi.mocked(createRoom).mockReset();
    useAuthStore.setState({
      status: "authenticated",
      user: { id: "u1", nickname: "Alice", username: null, profileImageUrl: null },
    });
    useRoomsStore.getState().reset();
  });

  it("opens a DM with the one person picked and shows it in the list", async () => {
    vi.mocked(createRoom).mockResolvedValue({
      id: "r9",
      type: "DIRECT",
      name: null,
      expiresAt: null,
      members: [
        { userId: "u1", nickname: "Alice" },
        { userId: "u2", nickname: "Bob" },
      ],
    });
    useRoomsStore.getState().setRooms([]);
    renderForm();

    await pickBob();
    submit();

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/rooms/r9"));
    expect(searchUsers).toHaveBeenCalledWith("bo");
    expect(createRoom).toHaveBeenCalledWith({ memberIds: ["u2"], name: undefined, ttlHours: undefined });
    expect(useRoomsStore.getState().rooms?.map((r) => r.id)).toEqual(["r9"]);
  });

  it("makes a named group that expires", async () => {
    vi.mocked(createRoom).mockResolvedValue({
      id: "g1",
      type: "GROUP",
      name: "스터디",
      expiresAt: "2026-10-26T05:00:00Z",
      members: [],
    });
    renderForm();

    await pickBob();
    fireEvent.change(screen.getByLabelText("방 이름 (선택)"), { target: { value: " 스터디 " } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "24" } });
    submit();

    await waitFor(() =>
      expect(createRoom).toHaveBeenCalledWith({ memberIds: ["u2"], name: "스터디", ttlHours: 24 }),
    );
  });

  it("explains a failure and stays on the form", async () => {
    vi.mocked(createRoom).mockRejectedValue(
      new ApiError(404, { statusCode: 404, message: "User not found: u2", error: "Not Found" }, "User not found: u2"),
    );
    renderForm();

    await pickBob();
    submit();

    expect((await screen.findByRole("alert")).textContent).toBe("고른 사람을 찾을 수 없습니다");
    expect(router.push).not.toHaveBeenCalled();
  });
});
