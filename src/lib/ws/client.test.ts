import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api/client";
import { getAccessToken, getRefreshToken, setTokens } from "@/lib/auth/storage";
import { ChatWSClient, type WSStatus } from "./client";

const API = "http://localhost:8080";
const WS_URL = "ws://localhost:8080/ws";

function makeJwt(expSec: number, sub = "u1"): string {
  const enc = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub, exp: expSec })}.sig`;
}

function jsonResponse(status: number, body?: unknown): Response {
  const text = body === undefined ? "" : JSON.stringify(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => text,
    json: async () => JSON.parse(text),
  } as unknown as Response;
}

const inOneHour = () => Math.floor(Date.now() / 1000) + 3600;
const ACCESS_1 = makeJwt(inOneHour(), "u1");
const ACCESS_2 = makeJwt(inOneHour() + 60, "u1");

/** Stands in for the browser WebSocket; the test plays the server. */
class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  readonly sent: string[] = [];
  closedWith: number | undefined;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code?: number) {
    this.closedWith = code;
    this.readyState = FakeWebSocket.CLOSED;
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  emit(type: string, data: unknown) {
    this.onmessage?.({ data: JSON.stringify({ type, data }) });
  }

  /** What ChatWebSocketHandler.reject does: the handshake completes, then an error frame and 1008. */
  reject(code: string) {
    this.open();
    this.emit("error", { code, message: code });
    this.drop(1008);
  }

  drop(code: number) {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code });
  }
}

const sockets = () => FakeWebSocket.instances;
const latest = () => sockets()[sockets().length - 1];

type FetchMock = ReturnType<typeof vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>>;

/** /auth/refresh answers with ACCESS_2 and the next refresh token, or with `status` when it is not 200. */
function installRefresh(status = 200): FetchMock {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
    async (input) => {
      if (String(input) !== `${API}/auth/refresh`) return jsonResponse(404);
      return status === 200
        ? jsonResponse(200, { accessToken: ACCESS_2, refreshToken: "refresh-2" })
        : jsonResponse(status, { statusCode: status, message: "Invalid refresh token" });
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const refreshCalls = (fetchMock: FetchMock) =>
  fetchMock.mock.calls.filter(([input]) => String(input) === `${API}/auth/refresh`).length;

describe("ChatWSClient", () => {
  const clients: ChatWSClient[] = [];
  const track = (client: ChatWSClient) => {
    clients.push(client);
    return client;
  };
  const logouts = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0); // no jitter, so delays are exact
    vi.stubGlobal("WebSocket", FakeWebSocket);
    FakeWebSocket.instances = [];
    logouts.mockClear();
    window.addEventListener("auth:logout", logouts);
    setTokens({ accessToken: ACCESS_1, refreshToken: "refresh-1" });
  });

  afterEach(() => {
    clients.splice(0).forEach((client) => client.close());
    window.removeEventListener("auth:logout", logouts);
    vi.useRealTimers();
  });

  it("reads the token on every attempt and keeps listeners across reconnects", async () => {
    const client = track(new ChatWSClient());
    const typing: string[] = [];
    client.on("typing_indicator", ({ userId }) => typing.push(userId));

    client.start();
    expect(latest().url).toBe(`${WS_URL}?token=${ACCESS_1}`);
    const first = latest();
    first.open();
    first.emit("typing_indicator", { roomId: "r1", userId: "u2" });
    first.drop(1006);

    setTokens({ accessToken: ACCESS_2, refreshToken: "refresh-1" });
    await vi.advanceTimersByTimeAsync(2000);
    expect(sockets()).toHaveLength(2);
    expect(latest().url).toBe(`${WS_URL}?token=${ACCESS_2}`);

    latest().open();
    latest().emit("typing_indicator", { roomId: "r1", userId: "u3" });
    first.emit("typing_indicator", { roomId: "r1", userId: "stale" }); // replaced socket: ignored
    expect(typing).toEqual(["u2", "u3"]);
  });

  it("backs off from 2s, doubling up to 30s, and onopen alone resets nothing", async () => {
    track(new ChatWSClient()).start();

    for (const delay of [2000, 4000, 8000, 16000, 30000, 30000]) {
      latest().open(); // the handshake succeeds, then the connection drops before it proves stable
      latest().drop(1006);
      const count = sockets().length;
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(sockets()).toHaveLength(count);
      await vi.advanceTimersByTimeAsync(1);
      expect(sockets()).toHaveLength(count + 1);
    }
  });

  it("resets the backoff after 10s open or a frame other than error", async () => {
    track(new ChatWSClient()).start();
    latest().drop(1006);
    await vi.advanceTimersByTimeAsync(2000); // 2nd socket; the next delay would be 4s

    latest().open();
    await vi.advanceTimersByTimeAsync(10_000); // stable
    latest().drop(1006);
    await vi.advanceTimersByTimeAsync(2000);
    expect(sockets()).toHaveLength(3);

    latest().drop(1006); // never opened: the delay grows again
    await vi.advanceTimersByTimeAsync(4000);
    expect(sockets()).toHaveLength(4);

    latest().open();
    latest().emit("read_update", { roomId: "r1", userId: "u2", lastReadAt: "2026-10-25T05:13:25Z" });
    latest().drop(1006);
    await vi.advanceTimersByTimeAsync(2000);
    expect(sockets()).toHaveLength(5);
  });

  it("reports open after the accept window and never for a rejected socket", async () => {
    installRefresh();
    const client = track(new ChatWSClient());
    const statuses: WSStatus[] = [];
    client.onStatus((status) => statuses.push(status));

    client.start();
    latest().reject("RATE_LIMITED");
    await vi.advanceTimersByTimeAsync(2000);
    latest().open();
    await vi.advanceTimersByTimeAsync(999);
    expect(client.getStatus()).toBe("connecting");
    await vi.advanceTimersByTimeAsync(1);

    expect(statuses).toEqual(["connecting", "reconnecting", "connecting", "open"]);
  });

  it("treats any frame other than error as acceptance", () => {
    const client = track(new ChatWSClient());
    client.start();
    latest().open();
    latest().emit("typing_indicator", { roomId: "r1", userId: "u2" });

    expect(client.getStatus()).toBe("open");
  });

  it("waits at least 2s after RATE_LIMITED and does not refresh", async () => {
    const fetchMock = installRefresh();
    track(new ChatWSClient()).start();

    latest().reject("RATE_LIMITED");
    await vi.advanceTimersByTimeAsync(1999);
    expect(sockets()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);

    expect(sockets()).toHaveLength(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stops at MAX_CONNECTIONS until retry()", async () => {
    const client = track(new ChatWSClient());
    client.start();

    latest().reject("MAX_CONNECTIONS");
    expect(client.getStatus()).toBe("blocked");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sockets()).toHaveLength(1);

    client.retry();
    expect(sockets()).toHaveLength(2);
  });

  it("refreshes after TOKEN_EXPIRED and reconnects 2s later with the new token", async () => {
    const fetchMock = installRefresh();
    track(new ChatWSClient()).start();

    latest().reject("TOKEN_EXPIRED");
    await vi.advanceTimersByTimeAsync(0);
    expect(getRefreshToken()).toBe("refresh-2");
    expect(sockets()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2000);

    expect(latest().url).toBe(`${WS_URL}?token=${ACCESS_2}`);
    expect(refreshCalls(fetchMock)).toBe(1);
  });

  it("refreshes once for a 1008 without an error frame", async () => {
    const fetchMock = installRefresh();
    track(new ChatWSClient()).start();

    latest().open();
    latest().drop(1008);
    await vi.advanceTimersByTimeAsync(2000);

    expect(refreshCalls(fetchMock)).toBe(1);
    expect(sockets()).toHaveLength(2);
  });

  it("ends the session when INVALID_TOKEN comes back after one refresh", async () => {
    const fetchMock = installRefresh();
    const client = track(new ChatWSClient());
    client.start();

    latest().reject("INVALID_TOKEN");
    await vi.advanceTimersByTimeAsync(2000);
    expect(sockets()).toHaveLength(2);
    latest().reject("INVALID_TOKEN");
    await vi.advanceTimersByTimeAsync(60_000);

    expect(logouts).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
    expect(client.getStatus()).toBe("closed");
    expect(sockets()).toHaveLength(2);
    expect(refreshCalls(fetchMock)).toBe(1);
  });

  it("ends the session when the refresh token is rejected", async () => {
    installRefresh(401);
    const client = track(new ChatWSClient());
    client.start();

    latest().reject("TOKEN_EXPIRED");
    await vi.advanceTimersByTimeAsync(60_000);

    expect(logouts).toHaveBeenCalledTimes(1);
    expect(client.getStatus()).toBe("closed");
    expect(sockets()).toHaveLength(1);
  });

  it("keeps the session when the refresh fails for a non-auth reason", async () => {
    installRefresh(503);
    const client = track(new ChatWSClient());
    client.start();

    latest().reject("TOKEN_EXPIRED");
    await vi.advanceTimersByTimeAsync(2000);

    expect(logouts).not.toHaveBeenCalled();
    expect(getRefreshToken()).toBe("refresh-1");
    expect(sockets()).toHaveLength(2);
  });

  it("joins the refresh an apiFetch 401 already started", async () => {
    let resolveRefresh: (res: Response) => void = () => {};
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      (input, init) => {
        if (String(input) === `${API}/auth/refresh`) {
          return new Promise<Response>((resolve) => {
            resolveRefresh = resolve;
          });
        }
        const bearer = new Headers(init?.headers).get("Authorization");
        return Promise.resolve(
          bearer === `Bearer ${ACCESS_2}`
            ? jsonResponse(200, { ok: true })
            : jsonResponse(401, { statusCode: 401, message: "Token expired" }),
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = apiFetch("/api/rooms");
    await vi.advanceTimersByTimeAsync(0); // the request got its 401 and is refreshing
    track(new ChatWSClient()).start();
    latest().reject("TOKEN_EXPIRED");
    await vi.advanceTimersByTimeAsync(0);
    resolveRefresh(jsonResponse(200, { accessToken: ACCESS_2, refreshToken: "refresh-2" }));

    await expect(request).resolves.toEqual({ ok: true });
    await vi.advanceTimersByTimeAsync(2000);
    expect(refreshCalls(fetchMock)).toBe(1);
    expect(latest().url).toBe(`${WS_URL}?token=${ACCESS_2}`);
  });

  it("refreshes an expiring token before connecting", async () => {
    installRefresh();
    setTokens({ accessToken: makeJwt(Math.floor(Date.now() / 1000) + 10), refreshToken: "refresh-1" });
    track(new ChatWSClient()).start();
    expect(sockets()).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(0);
    expect(latest().url).toBe(`${WS_URL}?token=${ACCESS_2}`);
  });

  it("opens nothing without a token and announces the logout", () => {
    window.localStorage.clear();
    const client = track(new ChatWSClient());

    client.start();

    expect(sockets()).toHaveLength(0);
    expect(logouts).toHaveBeenCalledTimes(1);
    expect(client.getStatus()).toBe("closed");
  });

  it("passes a send failure on without touching the connection", async () => {
    const fetchMock = installRefresh();
    const client = track(new ChatWSClient());
    const errors: unknown[] = [];
    client.on("error", (error) => errors.push(error));
    client.start();
    latest().open();
    await vi.advanceTimersByTimeAsync(1000);

    const failure = { code: "SEND_FAILED", message: "Not a member of this chat room", clientMessageId: "c1" };
    latest().emit("error", failure);

    expect(errors).toEqual([failure]);
    expect(client.getStatus()).toBe("open");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends only on an open socket", () => {
    const client = track(new ChatWSClient());
    client.start();
    expect(client.send("typing_start", { roomId: "r1" })).toBe(false);

    latest().open();
    expect(client.send("typing_start", { roomId: "r1" })).toBe(true);
    expect(JSON.parse(latest().sent[0])).toEqual({ type: "typing_start", data: { roomId: "r1" } });
  });

  it("drops frames outside the contract", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = track(new ChatWSClient());
    const received = vi.fn();
    client.on("new_message", received);
    client.start();
    latest().open();

    latest().emit("new_message", { id: "m1" });

    expect(received).not.toHaveBeenCalled();
    expect(client.getStatus()).toBe("connecting");
  });

  it("opens nothing after close() while a backoff timer is pending", async () => {
    const client = track(new ChatWSClient());
    client.start();
    const first = latest();
    first.open();
    first.drop(1006);

    client.close();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(sockets()).toHaveLength(1);
    expect(client.getStatus()).toBe("closed");
  });

  it("opens nothing after close() during an in-flight refresh", async () => {
    let resolveRefresh: (res: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveRefresh = resolve;
          }),
      ),
    );
    const client = track(new ChatWSClient());
    client.start();
    latest().reject("TOKEN_EXPIRED");
    await vi.advanceTimersByTimeAsync(0);

    client.close();
    resolveRefresh(jsonResponse(200, { accessToken: ACCESS_2, refreshToken: "refresh-2" }));
    await vi.advanceTimersByTimeAsync(60_000);

    expect(sockets()).toHaveLength(1);
  });

  it("closes its socket with 1000 on close()", () => {
    const client = track(new ChatWSClient());
    client.start();
    const socket = latest();

    client.close();

    expect(socket.closedWith).toBe(1000);
  });
});

// Production (Cloudflare to Render) loses the server's 1008 after a rejection
// frame: the browser reports 1006 about 20s later. The client decides from the
// frame instead (RULES.md R2).
describe("ChatWSClient when the close frame does not arrive", () => {
  const clients: ChatWSClient[] = [];
  const track = (client: ChatWSClient) => {
    clients.push(client);
    return client;
  };
  const logouts = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.stubGlobal("WebSocket", FakeWebSocket);
    FakeWebSocket.instances = [];
    logouts.mockClear();
    window.addEventListener("auth:logout", logouts);
    setTokens({ accessToken: ACCESS_1, refreshToken: "refresh-1" });
  });

  afterEach(() => {
    clients.splice(0).forEach((client) => client.close());
    window.removeEventListener("auth:logout", logouts);
    vi.useRealTimers();
  });

  /** A rejection as production delivers it: the handshake and the error frame, then no close. */
  const rejectWithoutClose = (socket: FakeWebSocket, code: string) => {
    socket.open();
    socket.emit("error", { code, message: code });
  };

  it("closes the socket itself and refreshes after TOKEN_EXPIRED", async () => {
    const fetchMock = installRefresh();
    track(new ChatWSClient()).start();
    const first = latest();

    rejectWithoutClose(first, "TOKEN_EXPIRED");
    expect(first.closedWith).toBe(1000);
    await vi.advanceTimersByTimeAsync(2000);

    expect(refreshCalls(fetchMock)).toBe(1);
    expect(latest().url).toBe(`${WS_URL}?token=${ACCESS_2}`);
  });

  it("stays blocked after MAX_CONNECTIONS when the socket drops with 1006 later", async () => {
    const client = track(new ChatWSClient());
    client.start();
    const first = latest();

    rejectWithoutClose(first, "MAX_CONNECTIONS");
    expect(client.getStatus()).toBe("blocked");
    first.drop(1006);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(client.getStatus()).toBe("blocked");
    expect(sockets()).toHaveLength(1);
  });

  it("ends the session on ACCOUNT_WITHDRAWN, even on an accepted connection", async () => {
    const fetchMock = installRefresh();
    const client = track(new ChatWSClient());
    client.start();
    latest().open();
    await vi.advanceTimersByTimeAsync(1000);
    expect(client.getStatus()).toBe("open");

    latest().emit("error", { code: "ACCOUNT_WITHDRAWN", message: "Account has been withdrawn" });
    await vi.advanceTimersByTimeAsync(60_000);

    expect(client.getStatus()).toBe("closed");
    expect(getAccessToken()).toBeNull();
    expect(logouts).toHaveBeenCalledTimes(1);
    expect(sockets()).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reconnects with backoff after the heartbeat closes a silent socket (4500)", async () => {
    const fetchMock = installRefresh();
    track(new ChatWSClient()).start();
    latest().open();
    await vi.advanceTimersByTimeAsync(10_000);

    latest().drop(4500);
    await vi.advanceTimersByTimeAsync(2000);

    expect(sockets()).toHaveLength(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps a healthy connection open on a send failure", async () => {
    const client = track(new ChatWSClient());
    client.start();
    latest().open();
    await vi.advanceTimersByTimeAsync(1000);

    latest().emit("error", { code: "SEND_FAILED", message: "Not a member of this chat room", clientMessageId: "c1" });

    expect(latest().closedWith).toBeUndefined();
    expect(client.getStatus()).toBe("open");
  });
});
