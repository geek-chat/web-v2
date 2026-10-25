import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, AuthExpiredError } from "./client";
import { getAccessToken, getRefreshToken, setTokens } from "@/lib/auth/storage";

const API = "http://localhost:8080";

function makeJwt(expSec: number): string {
  const enc = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: "u1", exp: expSec })}.sig`;
}

const oneHourFromNow = () => Math.floor(Date.now() / 1000) + 3600;
const OLD_ACCESS = makeJwt(oneHourFromNow());
const NEW_ACCESS = makeJwt(oneHourFromNow() + 60);

// Minimal Response stand-in: client.ts only reads status, ok, text() and json().
function jsonResponse(status: number, body?: unknown): Response {
  const text = body === undefined ? "" : JSON.stringify(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => text,
    json: async () => JSON.parse(text),
  } as unknown as Response;
}

const unauthorized = () =>
  jsonResponse(401, { statusCode: 401, message: "Token expired", error: "Unauthorized" });

interface FakeServer {
  refreshStatus: number;
  acceptNewToken: boolean;
}

function installFetch(server: FakeServer) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === `${API}/auth/refresh`) {
      return server.refreshStatus === 200
        ? jsonResponse(200, { accessToken: NEW_ACCESS, refreshToken: "refresh-2" })
        : jsonResponse(server.refreshStatus, {
            statusCode: server.refreshStatus,
            message: "Invalid refresh token",
            error: "Unauthorized",
          });
    }
    const bearer = new Headers(init?.headers).get("Authorization");
    if (server.acceptNewToken && bearer === `Bearer ${NEW_ACCESS}`) {
      return jsonResponse(200, { ok: true });
    }
    return unauthorized();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const refreshCalls = (fetchMock: ReturnType<typeof installFetch>) =>
  fetchMock.mock.calls.filter(([input]) => String(input) === `${API}/auth/refresh`).length;

describe("apiFetch single-flight refresh", () => {
  beforeEach(() => {
    setTokens({ accessToken: OLD_ACCESS, refreshToken: "refresh-1" });
  });

  it("refreshes once for concurrent 401s and retries each request with the new token", async () => {
    const fetchMock = installFetch({ refreshStatus: 200, acceptNewToken: true });

    const results = await Promise.all([
      apiFetch("/api/a"),
      apiFetch("/api/b"),
      apiFetch("/api/c"),
    ]);

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(refreshCalls(fetchMock)).toBe(1);
    expect(getAccessToken()).toBe(NEW_ACCESS);
    expect(getRefreshToken()).toBe("refresh-2");
  });

  it("clears tokens and announces logout when the refresh is rejected", async () => {
    const fetchMock = installFetch({ refreshStatus: 401, acceptNewToken: true });
    const onLogout = vi.fn();
    window.addEventListener("auth:logout", onLogout);

    const outcomes = await Promise.allSettled([apiFetch("/api/a"), apiFetch("/api/b")]);

    window.removeEventListener("auth:logout", onLogout);
    for (const outcome of outcomes) {
      expect(outcome.status).toBe("rejected");
      expect((outcome as PromiseRejectedResult).reason).toBeInstanceOf(AuthExpiredError);
    }
    expect(refreshCalls(fetchMock)).toBe(1);
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(onLogout).toHaveBeenCalled();
  });

  it("gives up after one retry when the refreshed token is still rejected", async () => {
    const fetchMock = installFetch({ refreshStatus: 200, acceptNewToken: false });

    await expect(apiFetch("/api/a")).rejects.toBeInstanceOf(AuthExpiredError);

    expect(refreshCalls(fetchMock)).toBe(1);
    // original request + one retry, never a second refresh round
    expect(fetchMock.mock.calls.filter(([input]) => String(input) === `${API}/api/a`)).toHaveLength(2);
    expect(getAccessToken()).toBeNull();
  });

  it("does not hit the network for an authed call without a token", async () => {
    window.localStorage.clear();
    const fetchMock = installFetch({ refreshStatus: 200, acceptNewToken: true });

    await expect(apiFetch("/api/a")).rejects.toBeInstanceOf(AuthExpiredError);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// A boot check on the old tokens can still be refreshing when an OAuth callback
// or a login stores a new pair. The old request's outcome must not touch it.
describe("apiFetch when a new session is stored mid-request", () => {
  const expired = () => makeJwt(Math.floor(Date.now() / 1000) - 10);

  function installSlowRefresh() {
    let respond!: (res: Response) => void;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === `${API}/auth/refresh`) {
        return new Promise<Response>((resolve) => {
          respond = resolve;
        });
      }
      return Promise.resolve(jsonResponse(200, { ok: true }));
    });
    vi.stubGlobal("fetch", fetchMock);
    return { respondToRefresh: (res: Response) => respond(res) };
  }

  beforeEach(() => {
    setTokens({ accessToken: expired(), refreshToken: "old-refresh" });
  });

  it("keeps the new session when the old session's refresh is rejected", async () => {
    const { respondToRefresh } = installSlowRefresh();
    const onLogout = vi.fn();
    window.addEventListener("auth:logout", onLogout);

    const oldRequest = apiFetch("/api/a"); // expired token: refresh with old-refresh starts
    setTokens({ accessToken: NEW_ACCESS, refreshToken: "new-refresh" });
    respondToRefresh(unauthorized());

    await expect(oldRequest).rejects.toBeInstanceOf(AuthExpiredError);
    window.removeEventListener("auth:logout", onLogout);
    expect(getAccessToken()).toBe(NEW_ACCESS);
    expect(getRefreshToken()).toBe("new-refresh");
    expect(onLogout).not.toHaveBeenCalled();
  });

  it("does not overwrite the new session with the old session's rotated pair", async () => {
    const { respondToRefresh } = installSlowRefresh();

    const oldRequest = apiFetch("/api/a");
    setTokens({ accessToken: NEW_ACCESS, refreshToken: "new-refresh" });
    respondToRefresh(jsonResponse(200, { accessToken: "rotated-old", refreshToken: "rotated-old-refresh" }));

    await expect(oldRequest).resolves.toEqual({ ok: true });
    expect(getAccessToken()).toBe(NEW_ACCESS);
    expect(getRefreshToken()).toBe("new-refresh");
  });
});
