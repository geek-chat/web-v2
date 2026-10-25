import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/auth")>()),
  withdraw: vi.fn(),
}));

import { withdraw } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { getAccessToken, setTokens } from "@/lib/auth/storage";
import { useAuthStore } from "@/store/auth";
import { WITHDRAW_PHRASE, WithdrawSection } from "./WithdrawSection";

const USER = { id: "u1", nickname: "Alice", username: "alice", profileImageUrl: null };

function renderSection() {
  render(<WithdrawSection />);
  return {
    input: screen.getByLabelText("확인 문구"),
    button: screen.getByRole("button", { name: "탈퇴하기" }) as HTMLButtonElement,
  };
}

beforeEach(() => {
  vi.mocked(withdraw).mockReset();
  useAuthStore.setState({ status: "authenticated", user: USER });
  setTokens({ accessToken: "a", refreshToken: "r" });
});

describe("WithdrawSection", () => {
  it("keeps the button disabled until the phrase matches exactly", () => {
    const { input, button } = renderSection();
    expect(button.disabled).toBe(true);

    fireEvent.change(input, { target: { value: "delete my account" } });
    expect(button.disabled).toBe(true);

    fireEvent.change(input, { target: { value: WITHDRAW_PHRASE } });
    expect(button.disabled).toBe(false);
  });

  it("withdraws and ends the local session", async () => {
    vi.mocked(withdraw).mockResolvedValue(undefined);
    const { input, button } = renderSection();

    fireEvent.change(input, { target: { value: WITHDRAW_PHRASE } });
    fireEvent.click(button);

    await waitFor(() => expect(useAuthStore.getState().status).toBe("unauthenticated"));
    expect(withdraw).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
  });

  it("keeps the session and re-enables the button when the server refuses", async () => {
    vi.mocked(withdraw).mockRejectedValue(new ApiError(500, null, "boom"));
    const { input, button } = renderSection();

    fireEvent.change(input, { target: { value: WITHDRAW_PHRASE } });
    fireEvent.click(button);

    await waitFor(() => expect(button.disabled).toBe(false));
    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(getAccessToken()).toBe("a");
  });
});
