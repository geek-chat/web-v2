import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/chat/backfill", () => ({
  loadRoomMessages: vi.fn(),
  loadOlderMessages: vi.fn(async () => true),
}));
vi.mock("@/lib/chat/connection", () => ({
  sendChatMessage: vi.fn(),
  retryChatMessage: vi.fn(),
}));

import { ApiError } from "@/lib/api/client";
import type { Room } from "@/lib/api/rooms";
import { loadRoomMessages } from "@/lib/chat/backfill";
import { sendChatMessage } from "@/lib/chat/connection";
import { useAuthStore } from "@/store/auth";
import { useMessagesStore } from "@/store/messages";
import { useRoomsStore } from "@/store/rooms";
import { useWsStore } from "@/store/ws";
import { fakeChatClient } from "@/test/fakeChatClient";
import { ChatRoom } from "./ChatRoom";

const dm: Room = {
  id: "r1",
  type: "DIRECT",
  name: null,
  lastMessageAt: null,
  expiresAt: null,
  members: [
    { userId: "u1", nickname: "Alice", profileImageUrl: null },
    { userId: "u2", nickname: "Bob", profileImageUrl: null },
  ],
};

describe("ChatRoom", () => {
  let fake: ReturnType<typeof fakeChatClient>;

  beforeEach(() => {
    vi.mocked(loadRoomMessages).mockReset().mockImplementation(async (roomId) => {
      useMessagesStore.getState().mergeServerMessages(roomId, [
        {
          id: "m1",
          senderId: "u2",
          senderNickname: "Bob",
          content: "반가워",
          type: "TEXT",
          createdAt: "2026-10-25T05:00:00Z",
          expiresAt: null,
          replyToMessageId: null,
          burnAfterRead: false,
        },
      ]);
      return true;
    });
    vi.mocked(sendChatMessage).mockClear();
    useAuthStore.setState({
      status: "authenticated",
      user: { id: "u1", nickname: "Alice", username: null, profileImageUrl: null },
    });
    useMessagesStore.getState().reset();
    useRoomsStore.getState().reset();
    useRoomsStore.getState().setRooms([dm]);
    fake = fakeChatClient();
    useWsStore.setState({ client: fake.client, status: "open" });
  });

  afterEach(() => {
    useWsStore.getState().reset();
  });

  it("loads the room, names it after the other member and shows the messages", async () => {
    render(<ChatRoom roomId="r1" />);

    expect(await screen.findByText("반가워")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Bob" })).toBeTruthy();
    expect(screen.getByText("대화의 처음입니다")).toBeTruthy();
  });

  it("sends a message with the signed-in user and the chosen lifetime", async () => {
    render(<ChatRoom roomId="r1" />);
    await screen.findByText("반가워");

    fireEvent.change(screen.getByLabelText("메시지"), { target: { value: "나도" } });
    fireEvent.keyDown(screen.getByLabelText("메시지"), { key: "Enter" });

    expect(sendChatMessage).toHaveBeenCalledWith({ roomId: "r1", senderId: "u1", content: "나도", ttlSeconds: undefined });
  });

  it("shows who is typing", async () => {
    render(<ChatRoom roomId="r1" />);
    await screen.findByText("반가워");

    act(() => fake.emit("typing_indicator", { roomId: "r1", userId: "u2" }));

    expect(screen.getByText("Bob 님이 입력 중")).toBeTruthy();
  });

  it("says the room is gone when the loaded list lacks it", () => {
    useRoomsStore.getState().setRooms([]);

    render(<ChatRoom roomId="r1" />);

    expect(screen.getByText("방을 찾을 수 없습니다")).toBeTruthy();
  });

  it("says the room is gone on a 404, and offers a retry on other failures", async () => {
    vi.mocked(loadRoomMessages).mockRejectedValueOnce(
      new ApiError(404, { statusCode: 404, message: "Room not found", error: "Not Found" }, "Room not found"),
    );
    const first = render(<ChatRoom roomId="r1" />);
    expect(await screen.findByText("방을 찾을 수 없습니다")).toBeTruthy();
    first.unmount();

    vi.mocked(loadRoomMessages).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<ChatRoom roomId="r1" />);
    fireEvent.click(await screen.findByRole("button", { name: "다시 시도" }));

    await waitFor(() => expect(screen.getByText("반가워")).toBeTruthy());
  });
});
