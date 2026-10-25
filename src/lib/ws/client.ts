/**
 * ChatWSClient: the app's single WebSocket connection. `.claude/RULES.md` R2
 * is the source of truth for the rules below; this file implements them.
 *
 * - The wrapper outlives every socket and keeps the listeners. Each attempt
 *   opens a new WebSocket and binds its callbacks again; callbacks from a
 *   replaced socket are ignored.
 * - The server checks a connection only after the handshake
 *   (ChatWebSocketHandler.afterConnectionEstablished) and sends nothing when
 *   it accepts one, so a rejected socket fires `onopen` too and then gets an
 *   `error` frame and close 1008. Two windows follow `onopen`:
 *     accepted: ACCEPT_WINDOW_MS without a rejection, or any frame other than
 *       `error`. The status turns "open", which triggers the backfill.
 *     stable: STABLE_AFTER_MS open, or any frame other than `error`. Only
 *       then are the backoff and the refresh-once guard reset.
 * - Close 1008 is branched on the rejection code that preceded it.
 * - The access token is read from storage on every attempt and refreshed only
 *   through the shared single-flight refreshOnce().
 * - close() disposes the client: timers are cancelled and every continuation
 *   re-checks `disposed`, so nothing opens a socket afterwards. The client
 *   also disposes itself once its session ends, or when storage holds another
 *   account's token (another tab logged in as someone else).
 */
import { env } from "@/lib/env";
import { getAccessToken, getRefreshToken, hasTokens } from "@/lib/auth/storage";
import { decodeJwt, isExpiringSoon } from "@/lib/auth/jwt";
import { AuthExpiredError, endSession, refreshOnce } from "@/lib/api/client";
import {
  isConnectRejectionCode,
  parseServerEvent,
  type ClientEventMap,
  type ClientEventType,
  type ConnectRejectionCode,
  type ServerEventMap,
  type ServerEventType,
} from "./events";

/** Server WebSocketSessionManager.MIN_CONNECTION_INTERVAL_MS: a reconnect sooner than this is rejected. */
export const MIN_RECONNECT_MS = 2000;
export const MAX_RECONNECT_MS = 30_000;
export const JITTER_MS = 1000;
/** The server rejects inside its handshake callback, so a rejection lands right after `onopen`. */
export const ACCEPT_WINDOW_MS = 1000;
export const STABLE_AFTER_MS = 10_000;

const NORMAL_CLOSURE = 1000;
const POLICY_VIOLATION = 1008;

export type WSStatus =
  | "idle" // not started
  | "connecting" // opening, or open but not accepted yet
  | "open" // accepted by the server
  | "reconnecting" // waiting for the backoff timer or a token refresh
  | "blocked" // MAX_CONNECTIONS: waits for retry()
  | "closed"; // disposed by close(), or because the session ended

type Handler<K extends ServerEventType> = (data: ServerEventMap[K]) => void;

export interface ChatWSClientOptions {
  url?: string;
  /** The account this client streams for (the JWT `sub`). Tokens of any other account are never used. */
  userId?: string;
}

export class ChatWSClient {
  private socket: WebSocket | null = null;
  private status: WSStatus = "idle";
  private disposed = false;
  // Handler<never> accepts a handler of any type; on() and emit() use the same key type.
  private readonly handlers = new Map<ServerEventType, Set<Handler<never>>>();
  private readonly statusListeners = new Set<(status: WSStatus) => void>();
  private reconnectMs = MIN_RECONNECT_MS;
  private authRetried = false;
  private lastRejection: ConnectRejectionCode | null = null;
  // Refresh token of the session the current socket was opened with (see endSession).
  private startedWith: string | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private acceptTimer: ReturnType<typeof setTimeout> | undefined;
  private stableTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly url: string;
  private readonly userId: string | undefined;

  constructor(options: ChatWSClientOptions = {}) {
    this.url = options.url ?? env.NEXT_PUBLIC_WS_URL;
    this.userId = options.userId;
  }

  getStatus(): WSStatus {
    return this.status;
  }

  /** Opens the first connection. Later calls do nothing. */
  start(): void {
    if (this.status === "idle") void this.connect();
  }

  /** Manual retry after MAX_CONNECTIONS, once the user has closed another tab. */
  retry(): void {
    if (this.status !== "blocked") return;
    this.reconnectMs = MIN_RECONNECT_MS;
    void this.connect();
  }

  /** Disposes the client for good. */
  close(): void {
    if (this.disposed) return;
    this.disposed = true;
    clearTimeout(this.retryTimer);
    this.clearSocketTimers();
    const socket = this.socket;
    this.socket = null;
    socket?.close(NORMAL_CLOSURE);
    this.setStatus("closed");
  }

  on<K extends ServerEventType>(type: K, handler: Handler<K>): () => void {
    let handlers = this.handlers.get(type);
    if (!handlers) {
      handlers = new Set();
      this.handlers.set(type, handlers);
    }
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  }

  onStatus(listener: (status: WSStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /** Sends one frame. False when no socket is open, so the caller can fail the message at once. */
  send<K extends ClientEventType>(type: K, data: ClientEventMap[K]): boolean {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ type, data }));
    return true;
  }

  private async connect(): Promise<void> {
    if (this.disposed) return;
    this.setStatus("connecting");
    let startedWith = getRefreshToken();
    let token = getAccessToken();
    if (!token) {
      // Same as apiFetch's no-token path: there is no session to connect with.
      endSession(startedWith);
      this.close();
      return;
    }
    if (this.isForeign(token)) return;
    // Optional in R2: refresh first instead of paying a TOKEN_EXPIRED round trip.
    if (isExpiringSoon(token)) {
      try {
        token = await refreshOnce();
        startedWith = getRefreshToken();
      } catch (err) {
        if (!this.disposed) this.handleRefreshFailure(err, startedWith);
        return;
      }
      if (this.disposed || this.isForeign(token)) return;
    }
    this.startedWith = startedWith;
    this.lastRejection = null;
    const socket = new WebSocket(`${this.url}?token=${encodeURIComponent(token)}`);
    this.socket = socket;
    socket.onopen = () => this.handleOpen(socket);
    socket.onmessage = (event) => this.handleMessage(socket, event);
    socket.onclose = (event) => this.handleClose(socket, event);
  }

  private handleOpen(socket: WebSocket): void {
    if (socket !== this.socket) return;
    // Not a reset point: a socket the server is about to reject opens too.
    this.acceptTimer = setTimeout(() => this.markAccepted(), ACCEPT_WINDOW_MS);
    this.stableTimer = setTimeout(() => this.markStable(), STABLE_AFTER_MS);
  }

  private handleMessage(socket: WebSocket, message: MessageEvent): void {
    if (socket !== this.socket) return;
    const event = parseServerEvent(message.data);
    if (!event) {
      warnDroppedFrame(message.data);
      return;
    }
    if (event.type === "error") {
      // `error` also arrives on a healthy connection (send failures). Only the
      // rejection codes decide what a following 1008 means.
      if (isConnectRejectionCode(event.data.code)) this.lastRejection = event.data.code;
    } else {
      // Only an accepted connection receives anything but an error frame.
      this.markAccepted();
      this.markStable();
    }
    this.emit(event.type, event.data);
  }

  private handleClose(socket: WebSocket, close: CloseEvent): void {
    if (socket !== this.socket) return;
    this.socket = null;
    this.clearSocketTimers();
    const rejection = this.lastRejection;
    this.lastRejection = null;
    if (close.code !== POLICY_VIOLATION) {
      this.scheduleReconnect();
      return;
    }
    switch (rejection) {
      case "MAX_CONNECTIONS":
        this.setStatus("blocked"); // no reconnect until the user asks
        return;
      case "RATE_LIMITED":
        this.scheduleReconnect(); // no refresh; the backoff waits at least 2s
        return;
      default: // TOKEN_EXPIRED, INVALID_TOKEN, NO_TOKEN, or no error frame at all
        void this.refreshAndReconnect();
    }
  }

  private async refreshAndReconnect(): Promise<void> {
    const startedWith = this.startedWith;
    if (this.authRetried) {
      // Refreshed once already and the server still refuses the token.
      this.endOrReconnect(startedWith);
      return;
    }
    this.authRetried = true;
    this.setStatus("reconnecting");
    try {
      await refreshOnce();
    } catch (err) {
      if (!this.disposed) this.handleRefreshFailure(err, startedWith);
      return;
    }
    // R2: reconnect after the minimum interval, not after a backoff grown by earlier drops.
    if (!this.disposed) this.scheduleReconnect(MIN_RECONNECT_MS);
  }

  /**
   * True, after disposing the client, when storage holds another account's
   * token: another tab logged in as someone else. This tab's stores must never
   * receive that account's events; the owner re-verifies the session instead.
   */
  private isForeign(token: string): boolean {
    if (this.userId === undefined || decodeJwt(token)?.sub === this.userId) return false;
    this.close();
    return true;
  }

  private handleRefreshFailure(err: unknown, startedWith: string | null): void {
    if (err instanceof AuthExpiredError) {
      this.endOrReconnect(startedWith);
      return;
    }
    // Network or 5xx: no token was issued, so the refresh-once guard is not used up.
    this.authRetried = false;
    this.scheduleReconnect();
  }

  /** Ends the session this client connected with, unless a newer one was stored meanwhile. */
  private endOrReconnect(startedWith: string | null): void {
    endSession(startedWith);
    if (!hasTokens()) {
      this.close();
      return;
    }
    // A login stored a new session in the meantime: connect with it.
    this.authRetried = false;
    this.scheduleReconnect();
  }

  /** Reconnects after the current backoff, which then doubles, or after `baseMs` when given. */
  private scheduleReconnect(baseMs?: number): void {
    if (this.disposed) return;
    this.setStatus("reconnecting");
    const delay = (baseMs ?? this.reconnectMs) + Math.random() * JITTER_MS;
    if (baseMs === undefined) this.reconnectMs = Math.min(this.reconnectMs * 2, MAX_RECONNECT_MS);
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      void this.connect();
    }, delay);
  }

  private markAccepted(): void {
    if (!this.socket || this.lastRejection || this.status === "open") return;
    clearTimeout(this.acceptTimer);
    this.setStatus("open");
  }

  private markStable(): void {
    if (!this.socket || this.lastRejection) return;
    clearTimeout(this.stableTimer);
    this.reconnectMs = MIN_RECONNECT_MS;
    this.authRetried = false;
  }

  private clearSocketTimers(): void {
    clearTimeout(this.acceptTimer);
    clearTimeout(this.stableTimer);
    this.acceptTimer = undefined;
    this.stableTimer = undefined;
  }

  private setStatus(status: WSStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  private emit<K extends ServerEventType>(type: K, data: ServerEventMap[K]): void {
    (this.handlers.get(type) as Set<Handler<K>> | undefined)?.forEach((handler) => handler(data));
  }
}

function warnDroppedFrame(raw: unknown): void {
  if (process.env.NODE_ENV === "production") return;
  console.warn("[ws] dropped a frame outside the contract:", String(raw).slice(0, 200));
}
