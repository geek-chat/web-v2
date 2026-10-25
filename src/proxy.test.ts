import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

const nonceOf = (csp: string | null) => /'nonce-([^']+)'/.exec(csp ?? "")?.[1];

describe("proxy", () => {
  it("sends a CSP whose nonce changes on every request", () => {
    const first = proxy(new NextRequest("http://localhost:3000/login"));
    const second = proxy(new NextRequest("http://localhost:3000/login"));

    const csp = first.headers.get("Content-Security-Policy");
    expect(csp).toContain("connect-src 'self' http://localhost:8080 ws://localhost:8080/ws");
    expect(nonceOf(csp)).toBeTruthy();
    expect(nonceOf(second.headers.get("Content-Security-Policy"))).not.toBe(nonceOf(csp));
  });
});
