import { describe, expect, it } from "vitest";
import { buildCsp, createNonce } from "./csp";

const directives = (csp: string) =>
  Object.fromEntries(
    csp.split("; ").map((part) => {
      const [name, ...values] = part.split(" ");
      return [name, values];
    }),
  );

const base = { nonce: "abc123", apiUrl: "https://api.example.com", wsUrl: "wss://api.example.com/ws" };

describe("buildCsp", () => {
  it("allows only nonce-stamped scripts in production", () => {
    const csp = directives(buildCsp({ ...base, isDev: false }));

    expect(csp["script-src"]).toEqual(["'self'", "'nonce-abc123'", "'strict-dynamic'"]);
    expect(csp["connect-src"]).toEqual(["'self'", base.apiUrl, base.wsUrl]);
    expect(csp["frame-ancestors"]).toEqual(["'none'"]);
  });

  it("adds eval for React only in development", () => {
    const csp = directives(buildCsp({ ...base, isDev: true }));

    expect(csp["script-src"]).toContain("'unsafe-eval'");
    expect(csp["script-src"]).not.toContain("'unsafe-inline'");
  });

  it("keeps inline styles allowed by leaving the nonce out of style-src", () => {
    const csp = directives(buildCsp({ ...base, isDev: false }));

    // A nonce in style-src would make browsers ignore 'unsafe-inline'.
    expect(csp["style-src"]).toEqual(["'self'", "'unsafe-inline'"]);
  });
});

describe("createNonce", () => {
  it("returns a fresh base64 value each time", () => {
    const a = createNonce();
    const b = createNonce();

    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});
