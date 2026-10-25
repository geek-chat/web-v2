import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ verifySession: vi.fn(async () => {}) }));
vi.mock("sonner", () => ({ toast: { info: vi.fn() } }));

import { verifySession } from "@/lib/auth/session";
import { clearTokens, setTokens } from "@/lib/auth/storage";
import { useAuthStore } from "@/store/auth";
import { makeJwt } from "@/test/fakeWebSocket";
import AppBoot from "./AppBoot";

const ALICE = { id: "u1", nickname: "Alice", username: "alice", profileImageUrl: null };
const inOneHour = () => Math.floor(Date.now() / 1000) + 3600;

/** What the browser fires in this tab when another tab writes localStorage. */
const fromAnotherTab = (key: string | null) =>
  window.dispatchEvent(new StorageEvent("storage", { key, storageArea: window.localStorage }));

describe("AppBoot across tabs", () => {
  beforeEach(() => {
    setTokens({ accessToken: makeJwt(inOneHour(), "u1"), refreshToken: "r1" });
    useAuthStore.setState({ status: "authenticated", user: ALICE });
    render(<AppBoot />);
    vi.mocked(verifySession).mockClear(); // the boot check
  });

  it("checks the session again when another tab logs out", () => {
    clearTokens();
    fromAnotherTab("access_token");

    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("checks the session again when another tab logs in as someone else", () => {
    setTokens({ accessToken: makeJwt(inOneHour(), "u2"), refreshToken: "r2" });
    fromAnotherTab("refresh_token");

    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("ignores another tab refreshing this account's tokens", () => {
    setTokens({ accessToken: makeJwt(inOneHour() + 60, "u1"), refreshToken: "r2" });
    fromAnotherTab("access_token");

    expect(verifySession).not.toHaveBeenCalled();
  });

  it("ignores keys that are not tokens", () => {
    fromAnotherTab("theme");

    expect(verifySession).not.toHaveBeenCalled();
  });
});
