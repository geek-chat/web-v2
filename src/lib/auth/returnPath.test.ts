import { afterEach, describe, expect, it, vi } from "vitest";
import { isReturnablePath, rememberReturnPath, takeReturnPath } from "./returnPath";

describe("returnPath", () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.useRealTimers();
  });

  it("gives an invite path back once", () => {
    rememberReturnPath("/invite/AbC12dEf");

    expect(takeReturnPath()).toBe("/invite/AbC12dEf");
    expect(takeReturnPath()).toBeNull();
  });

  it("keeps nothing but invite pages on this origin", () => {
    const others = [
      "/rooms",
      "/me",
      "/invite/",
      "/invite/a/b",
      "/invite/a%2F..",
      "/invite/a\\b",
      "//evil.example/invite/AbC12dEf",
      "https://evil.example/invite/AbC12dEf",
    ];
    for (const path of others) {
      expect(isReturnablePath(path)).toBe(false);
      rememberReturnPath(path);
    }

    expect(takeReturnPath()).toBeNull();
  });

  it("forgets a path after 10 minutes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-25T12:00:00Z"));
    rememberReturnPath("/invite/AbC12dEf");

    vi.setSystemTime(new Date("2026-10-25T12:10:00Z"));

    expect(takeReturnPath()).toBeNull();
  });

  it("trusts nothing it reads back that it would not have written", () => {
    window.sessionStorage.setItem("return_path", JSON.stringify({ path: "//evil.example", at: Date.now() }));
    expect(takeReturnPath()).toBeNull();

    window.sessionStorage.setItem("return_path", "not json");
    expect(takeReturnPath()).toBeNull();
  });
});
