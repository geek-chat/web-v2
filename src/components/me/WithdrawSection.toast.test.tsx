import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ verifySession: vi.fn(async () => {}) }));
vi.mock("sonner", () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/auth")>()),
  withdraw: vi.fn(),
}));

import { toast } from "sonner";
import AppBoot from "@/components/AppBoot";
import { withdraw } from "@/lib/api/auth";
import { SESSION_ENDED_TOAST_ID } from "@/lib/auth/notices";
import { setTokens } from "@/lib/auth/storage";
import { useAuthStore } from "@/store/auth";
import { WITHDRAW_PHRASE, WithdrawSection } from "./WithdrawSection";

const USER = { id: "u1", nickname: "Alice", username: "alice", profileImageUrl: null };

beforeEach(() => {
  vi.mocked(toast.info).mockClear();
  vi.mocked(toast.success).mockClear();
  vi.mocked(withdraw).mockReset();
  useAuthStore.setState({ status: "authenticated", user: USER });
  setTokens({ accessToken: "a", refreshToken: "r" });
});

// The server sends ACCOUNT_WITHDRAWN to this tab's socket too, and it can beat
// the withdraw response: the WebSocket client then ends the session through
// auth:logout before the section's own success path runs.
describe("withdrawing in this tab", () => {
  it("leaves one session-ended toast when the logout lands before the withdraw response", async () => {
    let respond!: () => void;
    vi.mocked(withdraw).mockReturnValue(
      new Promise<void>((resolve) => {
        respond = resolve;
      }),
    );
    render(
      <>
        <AppBoot />
        <WithdrawSection />
      </>,
    );

    fireEvent.change(screen.getByLabelText("확인 문구"), { target: { value: WITHDRAW_PHRASE } });
    fireEvent.click(screen.getByRole("button", { name: "탈퇴하기" }));
    act(() => {
      window.dispatchEvent(new CustomEvent("auth:logout"));
    });
    respond();

    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    expect(toast.info).toHaveBeenCalledWith(expect.any(String), { id: SESSION_ENDED_TOAST_ID });
    expect(toast.success).toHaveBeenCalledWith(expect.any(String), { id: SESSION_ENDED_TOAST_ID });
  });
});
