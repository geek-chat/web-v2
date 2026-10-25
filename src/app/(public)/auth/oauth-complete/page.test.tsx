import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => {
  const replace = vi.fn();
  return { replace, router: { replace } };
});
vi.mock("next/navigation", () => ({ useRouter: () => nav.router }));
// Only the network calls are faked; startSession and token storage run for real.
vi.mock("@/lib/api/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/auth")>()),
  completeOAuthSignup: vi.fn(),
  me: vi.fn(),
}));

import { completeOAuthSignup, me } from "@/lib/api/auth";
import { useAuthStore } from "@/store/auth";
import OAuthCompletePage from "./page";

const USER = { id: "u1", nickname: "홍길동", username: null, profileImageUrl: null };
const storedValues = () =>
  Object.keys(window.localStorage).map((key) => window.localStorage.getItem(key));

beforeEach(() => {
  nav.replace.mockReset();
  vi.mocked(completeOAuthSignup).mockReset();
  vi.mocked(me).mockReset().mockResolvedValue(USER);
  useAuthStore.setState({ status: "idle", user: null });
});

describe("/auth/oauth-complete", () => {
  it("creates the account with the chosen nickname and opens the room list", async () => {
    window.history.replaceState(
      null,
      "",
      "/auth/oauth-complete#signup_token=st&suggested_nickname=%EA%B8%B8%EB%8F%99",
    );
    vi.mocked(completeOAuthSignup).mockResolvedValue({ accessToken: "acc", refreshToken: "ref" });

    render(<OAuthCompletePage />);
    const nickname = await screen.findByDisplayValue("길동");
    expect(window.location.hash).toBe("");
    fireEvent.change(nickname, { target: { value: "  홍길동 " } });
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/rooms"));
    expect(completeOAuthSignup).toHaveBeenCalledWith({ signupToken: "st", nickname: "홍길동" });
    expect(window.localStorage.getItem("access_token")).toBe("acc");
    expect(storedValues()).not.toContain("st");
  });

  it("sends a fragment without a signup token to the error page", async () => {
    window.history.replaceState(null, "", "/auth/oauth-complete#suggested_nickname=x");

    render(<OAuthCompletePage />);

    await waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith("/auth/error?error=oauth_failed"),
    );
    expect(completeOAuthSignup).not.toHaveBeenCalled();
  });
});
