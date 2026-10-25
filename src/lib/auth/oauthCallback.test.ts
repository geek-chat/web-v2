import { StrictMode } from "react";
import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { clearHash, parseHash } from "./oauthCallback";
import { useOAuthHash } from "./useOAuthHash";

const go = (url: string) => window.history.replaceState(null, "", url);

describe("parseHash", () => {
  it("decodes the server's URLEncoder output", () => {
    // 홍길동 percent-encoded, and URLEncoder turns spaces into '+'
    go("/auth/oauth-complete#signup_token=t1&suggested_nickname=%ED%99%8D%EA%B8%B8%EB%8F%99+Kim");

    expect(parseHash()).toEqual({ signup_token: "t1", suggested_nickname: "홍길동 Kim" });
  });

  it("returns an empty object without a fragment", () => {
    go("/auth/success");

    expect(parseHash()).toEqual({});
  });
});

describe("clearHash", () => {
  it("drops the fragment and keeps the path and query", () => {
    go("/auth/oauth-link?x=1#link_token=abc");

    clearHash();

    expect(window.location.hash).toBe("");
    expect(window.location.pathname + window.location.search).toBe("/auth/oauth-link?x=1");
  });
});

describe("useOAuthHash", () => {
  it("returns the fragment and strips it from the URL", () => {
    go("/auth/success#access_token=a&refresh_token=b");

    const { result } = renderHook(() => useOAuthHash());

    expect(result.current).toEqual({ access_token: "a", refresh_token: "b" });
    expect(window.location.hash).toBe("");
  });

  it("keeps the captured fragment under Strict Mode's double invocation", () => {
    go("/auth/success#access_token=a&refresh_token=b");

    const { result, rerender } = renderHook(() => useOAuthHash(), { wrapper: StrictMode });
    rerender();

    expect(result.current).toEqual({ access_token: "a", refresh_token: "b" });
    expect(window.location.hash).toBe("");
  });
});
