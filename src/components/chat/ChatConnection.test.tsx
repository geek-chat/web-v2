import { StrictMode } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { router } = vi.hoisted(() => ({ router: { replace: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sonner", () => ({ toast: { info: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import { setTokens } from "@/lib/auth/storage";
import { useRoomsStore } from "@/store/rooms";
import { FakeWebSocket, makeJwt } from "@/test/fakeWebSocket";
import { ChatConnection } from "./ChatConnection";

/** Lets the deferred close after the last release run. */
const nextTask = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

describe("ChatConnection", () => {
  beforeEach(() => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    FakeWebSocket.instances = [];
    router.replace.mockClear();
    vi.mocked(toast.info).mockClear();
    vi.mocked(toast.warning).mockClear();
    vi.mocked(toast.error).mockClear();
    setTokens({ accessToken: makeJwt(Math.floor(Date.now() / 1000) + 3600), refreshToken: "r1" });
  });

  afterEach(async () => {
    cleanup();
    await nextTask(); // close this test's connection before the next test acquires one
  });

  it("opens one socket under Strict Mode and closes it on unmount", async () => {
    const { unmount } = render(
      <StrictMode>
        <ChatConnection />
      </StrictMode>,
    );
    expect(FakeWebSocket.instances).toHaveLength(1);

    unmount();
    await nextTask();

    expect(FakeWebSocket.latest().closedWith).toBe(1000);
  });

  it("leaves an expired room that is on screen, and only that one", () => {
    render(<ChatConnection />);
    useRoomsStore.getState().setCurrentRoom("r1");
    const socket = FakeWebSocket.latest();
    socket.open();

    socket.emit("room_expired", { roomId: "r2", roomName: null });
    expect(router.replace).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();

    socket.emit("room_expired", { roomId: "r1", roomName: "study" });
    expect(router.replace).toHaveBeenCalledWith("/rooms");
    expect(toast.info).toHaveBeenCalledWith("'study' 방이 만료되어 목록으로 돌아왔습니다");
  });

  it("warns before a room expires", () => {
    render(<ChatConnection />);
    const socket = FakeWebSocket.latest();
    socket.open();

    socket.emit("room_expiring", {
      roomId: "r1",
      roomName: null,
      expiresAt: "2026-10-25T05:10:00.123456Z",
    });

    expect(toast.warning).toHaveBeenCalledWith(expect.stringMatching(/^'이름 없는 방' 방이 .+에 만료됩니다$/));
  });

  it("offers a manual retry at MAX_CONNECTIONS", () => {
    render(<ChatConnection />);

    FakeWebSocket.latest().reject("MAX_CONNECTIONS");

    const [message, options] = vi.mocked(toast.error).mock.calls[0];
    expect(message).toBe("다른 탭에서 채팅이 열려 있어 연결하지 못했습니다. 탭 하나를 닫고 다시 시도하세요");
    expect(options).toMatchObject({ duration: Infinity });
    const action = options?.action as { onClick: (event: unknown) => void } | undefined;
    action?.onClick(undefined);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });
});
