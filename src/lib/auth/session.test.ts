import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth", () => ({ me: vi.fn() }));

import { me } from "@/lib/api/auth";
import { ApiError, AuthExpiredError } from "@/lib/api/client";
import { getAccessToken, getRefreshToken, setTokens } from "@/lib/auth/storage";
import { useAuthStore } from "@/store/auth";
import { startSession, verifySession } from "./session";

const meMock = vi.mocked(me);
const USER = { id: "u1", nickname: "Alice", username: "alice", profileImageUrl: null };
const TOKENS = { accessToken: "access-1", refreshToken: "refresh-1" };

beforeEach(() => {
  useAuthStore.setState({ status: "idle", user: null });
  meMock.mockReset();
});

describe("verifySession", () => {
  it("reports unauthenticated without calling the server when no tokens are stored", async () => {
    await verifySession();

    expect(useAuthStore.getState().status).toBe("unauthenticated");
    expect(meMock).not.toHaveBeenCalled();
  });

  it("loads the user and marks the session authenticated", async () => {
    setTokens(TOKENS);
    meMock.mockResolvedValue(USER);

    await verifySession();

    expect(useAuthStore.getState()).toMatchObject({ status: "authenticated", user: USER });
  });

  it("clears the session when the refresh token is rejected", async () => {
    setTokens(TOKENS);
    meMock.mockRejectedValue(new AuthExpiredError(401, null, "Refresh token rejected"));

    await verifySession();

    expect(useAuthStore.getState()).toMatchObject({ status: "unauthenticated", user: null });
    expect(getAccessToken()).toBeNull();
  });

  it("clears the session when the user no longer exists", async () => {
    setTokens(TOKENS);
    meMock.mockRejectedValue(new ApiError(404, null, "User not found"));

    await verifySession();

    expect(useAuthStore.getState().status).toBe("unauthenticated");
    expect(getRefreshToken()).toBeNull();
  });

  it("keeps the tokens and reports offline when the network fails", async () => {
    setTokens(TOKENS);
    meMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await verifySession();

    expect(useAuthStore.getState().status).toBe("offline");
    expect(getAccessToken()).toBe(TOKENS.accessToken);
    expect(getRefreshToken()).toBe(TOKENS.refreshToken);
  });

  it("keeps the tokens and reports offline on a server error", async () => {
    setTokens(TOKENS);
    meMock.mockRejectedValue(new ApiError(503, null, "Service Unavailable"));

    await verifySession();

    expect(useAuthStore.getState().status).toBe("offline");
    expect(getAccessToken()).toBe(TOKENS.accessToken);
  });
});

describe("startSession", () => {
  it("stores the tokens and then verifies them", async () => {
    meMock.mockImplementation(async () => {
      // the token pair must already be stored when /auth/me goes out
      expect(getAccessToken()).toBe(TOKENS.accessToken);
      return USER;
    });

    await startSession(TOKENS);

    expect(meMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState()).toMatchObject({ status: "authenticated", user: USER });
  });
});

describe("verifySession ordering", () => {
  const NEW_USER = { id: "u2", nickname: "Bob", username: "bob", profileImageUrl: null };

  function deferMe() {
    let settle!: { resolve: (u: typeof USER) => void; reject: (e: unknown) => void };
    meMock.mockImplementationOnce(
      () =>
        new Promise((resolve, reject) => {
          settle = { resolve, reject };
        }),
    );
    return () => settle;
  }

  it("lets the newest verify decide when an older one finishes last", async () => {
    setTokens(TOKENS);
    const oldCall = deferMe();
    const older = verifySession();
    meMock.mockResolvedValueOnce(NEW_USER);

    await verifySession();
    oldCall().resolve(USER);
    await older;

    expect(useAuthStore.getState()).toMatchObject({ status: "authenticated", user: NEW_USER });
  });

  it("ignores an older verify's failure that arrives after a newer one succeeded", async () => {
    setTokens(TOKENS);
    const oldCall = deferMe();
    const older = verifySession();
    meMock.mockResolvedValueOnce(NEW_USER);

    await verifySession();
    oldCall().reject(new AuthExpiredError(401, null, "Refresh token rejected"));
    await older;

    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(getAccessToken()).toBe(TOKENS.accessToken);
  });

  it("does not bring back a session that was cleared while /auth/me was in flight", async () => {
    setTokens(TOKENS);
    const call = deferMe();
    const pending = verifySession();

    useAuthStore.getState().clearSession(); // e.g. the user pressed logout
    call().resolve(USER);
    await pending;

    expect(useAuthStore.getState()).toMatchObject({ status: "unauthenticated", user: null });
  });
});
