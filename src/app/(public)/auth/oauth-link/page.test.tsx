import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => {
  const replace = vi.fn();
  return { replace, router: { replace } };
});
vi.mock("next/navigation", () => ({ useRouter: () => nav.router }));
// Only the network calls are faked; startSession and token storage run for real,
// so the assertions below see what actually lands in localStorage.
vi.mock("@/lib/api/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/auth")>()),
  linkProvider: vi.fn(),
  completeOAuthSignup: vi.fn(),
  me: vi.fn(),
}));

import { completeOAuthSignup, linkProvider, me } from "@/lib/api/auth";
import { startOAuthFlow } from "@/lib/auth/oauthFlow";
import { useAuthStore } from "@/store/auth";
import OAuthLinkPage from "./page";

const USER = { id: "u1", nickname: "홍길동", username: null, profileImageUrl: null };
const storedValues = () =>
  Object.keys(window.localStorage).map((key) => window.localStorage.getItem(key));

beforeEach(() => {
  nav.replace.mockReset();
  vi.mocked(linkProvider).mockReset();
  vi.mocked(completeOAuthSignup).mockReset();
  vi.mocked(me).mockReset().mockResolvedValue(USER);
  useAuthStore.setState({ status: "idle", user: null });
  startOAuthFlow("naver"); // the user pressed an OAuth button in this tab
  window.history.replaceState(
    null,
    "",
    "/auth/oauth-link#link_token=lt&existing_nickname=%ED%99%8D%EA%B8%B8%EB%8F%99&new_provider=NAVER",
  );
});

describe("/auth/oauth-link", () => {
  it("links the new login to the existing account", async () => {
    vi.mocked(linkProvider).mockResolvedValue({
      kind: "logged_in",
      tokens: { accessToken: "acc", refreshToken: "ref" },
    });

    render(<OAuthLinkPage />);
    expect(screen.getByText(/홍길동 님의 계정이 이미 있습니다/)).toBeDefined();
    expect(screen.getByText(/네이버 로그인을/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "연결하기" }));

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/rooms"));
    expect(linkProvider).toHaveBeenCalledWith({ linkToken: "lt", confirm: true });
    expect(window.localStorage.getItem("access_token")).toBe("acc");
    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(storedValues()).not.toContain("lt");
  });

  it("lets the user pick a nickname after declining, storing neither one-time token", async () => {
    vi.mocked(linkProvider).mockResolvedValue({
      kind: "signup_required",
      signupToken: "st",
      suggestedNickname: "길동",
    });
    vi.mocked(completeOAuthSignup).mockResolvedValue({ accessToken: "acc2", refreshToken: "ref2" });

    render(<OAuthLinkPage />);
    fireEvent.click(screen.getByRole("button", { name: "새 계정으로 시작" }));
    await screen.findByDisplayValue("길동");
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/rooms"));
    expect(linkProvider).toHaveBeenCalledWith({ linkToken: "lt", confirm: false });
    expect(completeOAuthSignup).toHaveBeenCalledWith({ signupToken: "st", nickname: "길동" });
    expect(window.localStorage.getItem("access_token")).toBe("acc2");
    expect(storedValues()).not.toContain("lt");
    expect(storedValues()).not.toContain("st");
  });

  it("sends a fragment without a link token to the error page", async () => {
    window.history.replaceState(null, "", "/auth/oauth-link#existing_nickname=x");

    render(<OAuthLinkPage />);

    await waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith("/auth/error?error=oauth_failed"),
    );
    expect(linkProvider).not.toHaveBeenCalled();
  });
});
