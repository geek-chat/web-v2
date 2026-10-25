import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ verifySession: vi.fn(async () => {}) }));
vi.mock("sonner", () => ({ toast: { info: vi.fn() } }));

import { toast } from "sonner";
import { verifySession } from "@/lib/auth/session";
import { getAccessToken, setTokens } from "@/lib/auth/storage";
import { useAuthStore } from "@/store/auth";
import AppBoot from "./AppBoot";

const USER = { id: "u1", nickname: "Alice", username: "alice", profileImageUrl: null };

beforeEach(() => {
  vi.mocked(verifySession).mockClear();
  vi.mocked(toast.info).mockClear();
  useAuthStore.setState({ status: "idle", user: null });
});

describe("AppBoot", () => {
  it("verifies the stored session on mount", () => {
    render(<AppBoot />);

    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("ends the session and says so when api/client announces a logout", () => {
    setTokens({ accessToken: "a", refreshToken: "r" });
    useAuthStore.setState({ status: "authenticated", user: USER });
    render(<AppBoot />);

    act(() => {
      window.dispatchEvent(new CustomEvent("auth:logout"));
    });

    expect(useAuthStore.getState()).toMatchObject({ status: "unauthenticated", user: null });
    expect(getAccessToken()).toBeNull();
    expect(toast.info).toHaveBeenCalledTimes(1);
  });

  it("checks again when the browser comes back online while offline", () => {
    render(<AppBoot />);
    vi.mocked(verifySession).mockClear();
    useAuthStore.setState({ status: "offline" });

    window.dispatchEvent(new Event("online"));

    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("ignores the online event when the session is not offline", () => {
    render(<AppBoot />);
    vi.mocked(verifySession).mockClear();
    useAuthStore.setState({ status: "authenticated", user: USER });

    window.dispatchEvent(new Event("online"));

    expect(verifySession).not.toHaveBeenCalled();
  });

  it("stops listening once unmounted", () => {
    const { unmount } = render(<AppBoot />);
    unmount();
    vi.mocked(verifySession).mockClear();
    useAuthStore.setState({ status: "offline" });

    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new CustomEvent("auth:logout"));

    expect(verifySession).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
  });
});
