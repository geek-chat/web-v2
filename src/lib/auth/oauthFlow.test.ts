import { afterEach, describe, expect, it, vi } from "vitest";
import { endOAuthFlow, hasPendingOAuthFlow, startOAuthFlow } from "./oauthFlow";

describe("OAuth flow mark", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the backend start URL and marks the flow", () => {
    expect(hasPendingOAuthFlow()).toBe(false);

    expect(startOAuthFlow("google")).toBe("http://localhost:8080/auth/google");
    expect(hasPendingOAuthFlow()).toBe(true);
  });

  it("is used up by a callback", () => {
    startOAuthFlow("naver");

    endOAuthFlow();

    expect(hasPendingOAuthFlow()).toBe(false);
  });

  it("expires after the backend's 10-minute token lifetime", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-25T12:00:00Z"));
    startOAuthFlow("google");

    vi.setSystemTime(new Date("2026-10-25T12:09:59Z"));
    expect(hasPendingOAuthFlow()).toBe(true);
    vi.setSystemTime(new Date("2026-10-25T12:10:00Z"));
    expect(hasPendingOAuthFlow()).toBe(false);
  });

  it("ignores a value it did not write", () => {
    window.sessionStorage.setItem("oauth_flow_started_at", "not-a-time");

    expect(hasPendingOAuthFlow()).toBe(false);
  });
});
