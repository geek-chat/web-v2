/**
 * apiFetch — fetch wrapper with single-flight refresh.
 *
 * Single-flight invariant: at most one POST /auth/refresh is in flight at any
 * moment. The first 401 (or proactive expiry check) sets `refreshPromise`;
 * every concurrent caller awaits the SAME promise instead of racing to refresh
 * and burning each other's rotated tokens. The promise is cleared on settle so
 * the next 401 can start a fresh round.
 *
 * Retry budget per request is exactly one. After a successful refresh we retry
 * the original request once; if THAT also returns 401 we treat it as terminal
 * (clearTokens + emit auth:logout + AuthExpiredError). This rules out an
 * infinite refresh→retry→401 loop even if the server is misbehaving.
 */

import { env } from "@/lib/env";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "@/lib/auth/storage";
import { isExpiringSoon } from "@/lib/auth/jwt";

interface ApiErrorBody {
  statusCode: number;
  message: string;
  error?: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: ApiErrorBody | null,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Marker thrown when refresh fails terminally. Triggers client logout. */
export class AuthExpiredError extends ApiError {
  constructor(status: number, body: ApiErrorBody | null, message: string) {
    super(status, body, message);
    this.name = "AuthExpiredError";
  }
}

// Module-level single-flight slot. Holds the in-flight refresh promise that
// resolves with the new access token, or null when no refresh is running.
let refreshPromise: Promise<string> | null = null;

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

function emitLogout(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth:logout"));
  }
}

/** Read the response body once, returning a parsed error body if JSON, else null. */
async function readErrorBody(res: Response): Promise<ApiErrorBody | null> {
  try {
    const text = await res.text();
    if (!text) return null;
    const parsed: unknown = JSON.parse(text);
    if (
      parsed &&
      typeof parsed === "object" &&
      "statusCode" in parsed &&
      "message" in parsed
    ) {
      return parsed as ApiErrorBody;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Performs the actual /auth/refresh call. Caller is responsible for the
 * single-flight gate; this function just hits the network and updates storage.
 */
async function performRefresh(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new AuthExpiredError(401, null, "No refresh token available");
  }
  const res = await fetch(`${env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  // 401/403 from refresh itself is terminal — never retry refresh.
  if (res.status === 401 || res.status === 403) {
    const body = await readErrorBody(res);
    throw new AuthExpiredError(res.status, body, "Refresh token rejected");
  }
  if (!res.ok) {
    const body = await readErrorBody(res);
    throw new ApiError(res.status, body, body?.message ?? "Refresh failed");
  }
  const data = (await res.json()) as RefreshResponse;
  setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return data.accessToken;
}

/** Single-flight wrapper around performRefresh. */
function refreshOnce(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = performRefresh().finally(() => {
    // Clear the slot regardless of outcome so the next caller can retry.
    refreshPromise = null;
  });
  return refreshPromise;
}

interface ApiFetchInit extends Omit<RequestInit, "body"> {
  /** Skip auth header (e.g. for /auth/login). Defaults to true. */
  auth?: boolean;
  /** Response parser. 'none' returns undefined. Defaults to 'json'. */
  parse?: "json" | "none";
  /** Body — plain objects are auto-stringified; strings/FormData are passed through. */
  body?: BodyInit | Record<string, unknown> | null;
}

/** Plain object = not a string and not one of the standard BodyInit instances. */
function isPlainObjectBody(body: ApiFetchInit["body"]): body is Record<string, unknown> {
  if (body === null || body === undefined || typeof body !== "object") return false;
  if (body instanceof FormData) return false;
  if (body instanceof Blob) return false;
  if (body instanceof ArrayBuffer) return false;
  if (body instanceof URLSearchParams) return false;
  if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) return false;
  return true;
}

function buildHeaders(init: ApiFetchInit, token: string | null): Headers {
  const headers = new Headers(init.headers);
  // Only set Content-Type for plain-object bodies; FormData needs the browser's
  // auto-generated boundary.
  if (isPlainObjectBody(init.body) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

function serializeBody(body: ApiFetchInit["body"]): BodyInit | null | undefined {
  if (body === undefined) return undefined;
  if (body === null) return null;
  if (typeof body === "string") return body;
  if (isPlainObjectBody(body)) return JSON.stringify(body);
  return body;
}

async function parseSuccess<T>(res: Response, parse: "json" | "none"): Promise<T> {
  if (parse === "none" || res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    // Non-JSON success body — return undefined rather than throw.
    return undefined as T;
  }
}

/**
 * apiFetch — see file-top JSDoc for the single-flight invariant.
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: ApiFetchInit = {},
): Promise<T> {
  const auth = init.auth !== false;
  const parse = init.parse ?? "json";
  const url = path.startsWith("http") ? path : `${env.NEXT_PUBLIC_API_URL}${path}`;

  let token: string | null = null;
  if (auth) {
    token = getAccessToken();
    // No-token path: don't even hit the network for an authed request.
    if (!token) {
      emitLogout();
      throw new AuthExpiredError(401, null, "No access token available");
    }
    // Proactive refresh: if the token is about to expire, pre-empt the 401
    // round-trip. Single-flight so a burst of authed calls only refreshes once.
    if (isExpiringSoon(token)) {
      try {
        token = await refreshOnce();
      } catch (err) {
        if (err instanceof AuthExpiredError) {
          clearTokens();
          emitLogout();
        }
        throw err;
      }
    }
  }

  const send = async (bearer: string | null): Promise<Response> => {
    return fetch(url, {
      ...init,
      headers: buildHeaders(init, bearer),
      body: serializeBody(init.body),
    });
  };

  let res = await send(token);

  // Reactive refresh: a 401 on an authed request triggers one refresh + one retry.
  if (auth && res.status === 401) {
    let newToken: string;
    try {
      newToken = await refreshOnce();
    } catch (err) {
      if (err instanceof AuthExpiredError) {
        clearTokens();
        emitLogout();
      }
      throw err;
    }
    res = await send(newToken);
    // If the retry STILL returns 401, the new access token is somehow invalid —
    // bail out instead of looping.
    if (res.status === 401) {
      const body = await readErrorBody(res);
      clearTokens();
      emitLogout();
      throw new AuthExpiredError(401, body, body?.message ?? "Unauthorized after refresh");
    }
  }

  if (!res.ok) {
    const body = await readErrorBody(res);
    throw new ApiError(res.status, body, body?.message ?? `HTTP ${res.status}`);
  }
  return parseSuccess<T>(res, parse);
}
