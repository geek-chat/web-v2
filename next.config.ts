import type { NextConfig } from "next";

// CSP construction. We can't use process.env directly inside the headers()
// return because Next inlines NEXT_PUBLIC_* at build time on the client only —
// here we're in the config (Node), so direct read is correct.
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080/ws";

const csp = [
  "default-src 'self'",
  // 'unsafe-eval' kept out — Next 16 prod build does not need it.
  "script-src 'self'",
  // Tailwind requires inline styles; React event handlers also use inline styles via dangerous, but we forbid that elsewhere (RULES.md R5).
  "style-src 'self' 'unsafe-inline'",
  // Web fonts via next/font are self-hosted, so 'self' is enough.
  "font-src 'self' data:",
  // API + WebSocket targets must be explicitly allowed.
  `connect-src 'self' ${apiUrl} ${wsUrl}`,
  // Avatars / OAuth provider images may come from https. data: covers blob previews.
  "img-src 'self' data: https:",
  // Clickjacking prevention — chat content should never embed in an iframe.
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // Quiet Turbopack workspace-root inference — pin to this dir to avoid
  // "multiple lockfiles detected" warning vs the parent geek-chat repo.
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
