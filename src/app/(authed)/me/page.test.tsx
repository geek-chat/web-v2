import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/auth")>()),
  logout: vi.fn(),
}));
vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  updateUsername: vi.fn(),
}));

import { logout } from "@/lib/api/auth";
import { updateUsername } from "@/lib/api/users";
import { getRefreshToken, setTokens } from "@/lib/auth/storage";
import { useAuthStore } from "@/store/auth";
import MePage from "./page";

const USER = { id: "u1", nickname: "Alice", username: "alice", profileImageUrl: null };

beforeEach(() => {
  vi.mocked(logout).mockReset();
  vi.mocked(updateUsername).mockReset();
  useAuthStore.setState({ status: "authenticated", user: USER });
  setTokens({ accessToken: "a", refreshToken: "r1" });
});

describe("/me", () => {
  it("shows the nickname and the current username", () => {
    render(<MePage />);

    expect(screen.getByText("Alice")).toBeDefined();
    expect(screen.getByDisplayValue("alice")).toBeDefined();
  });

  it("saves a new username into the session", async () => {
    vi.mocked(updateUsername).mockResolvedValue("alice_2");
    render(<MePage />);

    fireEvent.change(screen.getByLabelText("사용자명"), { target: { value: "alice_2" } });
    fireEvent.click(screen.getByRole("button", { name: "사용자명 저장" }));

    await waitFor(() => expect(useAuthStore.getState().user?.username).toBe("alice_2"));
    expect(updateUsername).toHaveBeenCalledWith({ username: "alice_2" });
  });

  it("logs out locally even when the server call fails", async () => {
    vi.mocked(logout).mockRejectedValue(new TypeError("Failed to fetch"));
    render(<MePage />);

    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));

    await waitFor(() => expect(useAuthStore.getState().status).toBe("unauthenticated"));
    expect(logout).toHaveBeenCalledWith("r1");
    expect(getRefreshToken()).toBeNull();
  });
});
