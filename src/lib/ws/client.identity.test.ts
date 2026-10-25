import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTokens } from "@/lib/auth/storage";
import { FakeWebSocket, makeJwt } from "@/test/fakeWebSocket";
import { ChatWSClient } from "./client";

const API = "http://localhost:8080";
const inOneHour = () => Math.floor(Date.now() / 1000) + 3600;

function jsonResponse(status: number, body: unknown): Response {
  const text = JSON.stringify(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => text,
    json: async () => JSON.parse(text),
  } as unknown as Response;
}

describe("ChatWSClient account pinning and refresh timing", () => {
  const clients: ChatWSClient[] = [];
  const track = (client: ChatWSClient) => {
    clients.push(client);
    return client;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.stubGlobal("WebSocket", FakeWebSocket);
    FakeWebSocket.instances = [];
    setTokens({ accessToken: makeJwt(inOneHour(), "u1"), refreshToken: "r1" });
  });

  afterEach(() => {
    clients.splice(0).forEach((client) => client.close());
    vi.useRealTimers();
  });

  it("never connects with another account's token", async () => {
    const client = track(new ChatWSClient({ userId: "u1" }));
    client.start();
    FakeWebSocket.latest().open();
    FakeWebSocket.latest().drop(1006);

    // Another tab logs in as u2 while this tab waits to reconnect.
    setTokens({ accessToken: makeJwt(inOneHour(), "u2"), refreshToken: "r2" });
    await vi.advanceTimersByTimeAsync(60_000);

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(client.getStatus()).toBe("closed");
  });

  it("keeps reconnecting for its own account", async () => {
    const client = track(new ChatWSClient({ userId: "u1" }));
    client.start();
    FakeWebSocket.latest().drop(1006);

    setTokens({ accessToken: makeJwt(inOneHour() + 60, "u1"), refreshToken: "r2" });
    await vi.advanceTimersByTimeAsync(2000);

    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("reconnects 2s after a TOKEN_EXPIRED refresh, even after the backoff grew", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input) === `${API}/auth/refresh`
          ? jsonResponse(200, { accessToken: makeJwt(inOneHour() + 60, "u1"), refreshToken: "r2" })
          : jsonResponse(404, {}),
      ),
    );
    track(new ChatWSClient({ userId: "u1" })).start();
    FakeWebSocket.latest().drop(1006);
    await vi.advanceTimersByTimeAsync(2000);
    FakeWebSocket.latest().drop(1006);
    await vi.advanceTimersByTimeAsync(4000); // the next plain retry would wait 8s

    FakeWebSocket.latest().reject("TOKEN_EXPIRED");
    await vi.advanceTimersByTimeAsync(0); // the refresh settles
    await vi.advanceTimersByTimeAsync(1999);
    expect(FakeWebSocket.instances).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeWebSocket.instances).toHaveLength(4);
  });
});
