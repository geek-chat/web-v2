/**
 * Test double for the browser WebSocket; the test plays the server.
 * Install with `vi.stubGlobal("WebSocket", FakeWebSocket)` and reset
 * `FakeWebSocket.instances` before each test.
 */
export class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  static latest(): FakeWebSocket {
    return FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
  }

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

  /** Frames the client sent, parsed. */
  frames(): Array<{ type: string; data: Record<string, unknown> }> {
    return this.sent.map((raw) => JSON.parse(raw));
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

export function makeJwt(expSec: number, sub = "u1"): string {
  const enc = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub, exp: expSec })}.sig`;
}
