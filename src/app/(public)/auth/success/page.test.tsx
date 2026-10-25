import { StrictMode } from "react";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => {
  const replace = vi.fn();
  return { replace, router: { replace } };
});
vi.mock("next/navigation", () => ({ useRouter: () => nav.router }));
vi.mock("@/lib/auth/session", () => ({ startSession: vi.fn(async () => {}) }));

import { startSession } from "@/lib/auth/session";
import OAuthSuccessPage from "./page";

const startSessionMock = vi.mocked(startSession);

beforeEach(() => {
  nav.replace.mockReset();
  startSessionMock.mockClear();
});

describe("/auth/success", () => {
  it("starts the session once with the token pair and opens the room list", async () => {
    window.history.replaceState(null, "", "/auth/success#access_token=acc&refresh_token=ref");

    render(
      <StrictMode>
        <OAuthSuccessPage />
      </StrictMode>,
    );

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/rooms"));
    expect(startSessionMock).toHaveBeenCalledTimes(1);
    expect(startSessionMock).toHaveBeenCalledWith({ accessToken: "acc", refreshToken: "ref" });
    expect(window.location.hash).toBe("");
  });

  it("does not take tokens from another callback's keys", async () => {
    window.history.replaceState(null, "", "/auth/success#link_token=lt");

    render(<OAuthSuccessPage />);

    await waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith("/auth/error?error=oauth_failed"),
    );
    expect(startSessionMock).not.toHaveBeenCalled();
  });
});
