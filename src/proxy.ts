import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { buildCsp, createNonce } from "@/lib/csp";

/**
 * Sets the per-request CSP (src/lib/csp.ts, RULES.md R5). Next.js reads the
 * nonce from the request's CSP header while rendering, so the header goes on
 * the forwarded request as well as on the response.
 */
export function proxy(request: NextRequest) {
  const csp = buildCsp({
    nonce: createNonce(),
    isDev: process.env.NODE_ENV === "development",
    apiUrl: env.NEXT_PUBLIC_API_URL,
    wsUrl: env.NEXT_PUBLIC_WS_URL,
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Documents only: static files and router prefetches need no CSP of their own.
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
