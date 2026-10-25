import { StrictMode, createElement } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { clearHash, parseHash } from "./oauthCallback";
import { endOAuthFlow, startOAuthFlow } from "./oauthFlow";
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
  beforeEach(() => {
    startOAuthFlow("google"); // the user pressed an OAuth button in this tab
  });

  it("treats the fragment as empty when this tab did not start an OAuth flow", () => {
    endOAuthFlow();
    go("/auth/success#access_token=a&refresh_token=b");

    const { result } = renderHook(() => useOAuthHash());

    expect(result.current).toEqual({});
    expect(window.location.hash).toBe(""); // the crafted tokens still leave the URL
  });

  it("uses the flow mark up, so a second link in the same tab is refused", () => {
    go("/auth/success#access_token=a&refresh_token=b");
    renderHook(() => useOAuthHash()).unmount();
    go("/auth/success#access_token=x&refresh_token=y");

    const { result } = renderHook(() => useOAuthHash());

    expect(result.current).toEqual({});
  });

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

  // renderHook is a plain client render; this exercises the real server HTML +
  // hydrateRoot path that Next takes for a prerendered callback page.
  it("matches the server HTML while hydrating, then exposes the fragment", async () => {
    go("/auth/success#access_token=a&refresh_token=b");
    function Probe() {
      const hash = useOAuthHash();
      return createElement("p", null, hash ? `token:${hash.access_token}` : "waiting");
    }
    const container = document.createElement("div");
    container.innerHTML = renderToString(createElement(Probe));
    document.body.appendChild(container);
    expect(container.textContent).toBe("waiting");
    const onRecoverableError = vi.fn(); // React reports hydration mismatches here

    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, createElement(Probe), { onRecoverableError });
    });

    expect(container.textContent).toBe("token:a");
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("");
    act(() => root?.unmount());
    container.remove();
  });
});
